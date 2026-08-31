/*
 * Browser port of the parsing/conversion logic from Enc2MusicXML.
 * Original copyright (C) 2018 Leon Vinken. GPL-3.0-or-later.
 */

export type ConversionStats = {
  title: string;
  format: string;
  measures: number;
  parts: number;
  notes: number;
  rests: number;
  warnings: string[];
};

export type ConversionResult = { xml: string; stats: ConversionStats };

type Header = { magic: string; version: number; marker: number; lineCount: number; instrumentCount: number; staffPerSystem: number; measureCount: number };
type Instrument = { name: string; nstaves: number; show: boolean; midiProgram: number };
type StaffData = { clef: number; key: number; show: boolean; staffType: number; instrumentIndex: number; staffIndex: number };
type Line = { start: number; measureCount: number; staves: StaffData[] };
type BaseElem = { kind: string; tick: number; type: number; voice: number; size: number; staff: number; x: number; realDuration: number };
type NoteElem = BaseElem & { kind: 'note'; face: number; grace1: number; grace2: number; position: number; tuplet: number; dot: number; pitch: number; playback: number; velocity: number; options: number; accidental: number; artUp: number; artDown: number };
type RestElem = BaseElem & { kind: 'rest'; face: number; tuplet: number; dot: number };
type KeyElem = BaseElem & { kind: 'key'; value: number };
type TieElem = BaseElem & { kind: 'tie'; start: boolean };
type OrnamentElem = BaseElem & { kind: 'ornament'; ornament: number; endMeasure: number; x2: number; mirror: number; beatNote: number; tempo: number; textIndex: number };
type ChordElem = BaseElem & { kind: 'chord-symbol'; text: string };
type Elem = NoteElem | RestElem | KeyElem | TieElem | OrnamentElem | ChordElem | BaseElem;
type Measure = { bpm: number; beatTicks: number; durTicks: number; beats: number; beatType: number; barStart: number; barEnd: number; alternative: number; repeat: number; elements: Elem[] };
type Score = { header: Header; instruments: Instrument[]; lines: Line[]; measures: Measure[]; texts: string[]; title: string; subtitles: string[]; authors: string[]; instructions: string[]; copyrights: string[]; warnings: string[] };

const KNOWN = new Set(['LINE', 'MEAS', 'TITL', 'TEXT']);
const dec = new TextDecoder('windows-1252');

class Reader {
  readonly bytes: Uint8Array;
  readonly view: DataView;
  pos = 0;
  little = true;
  constructor(buffer: ArrayBuffer) { this.bytes = new Uint8Array(buffer); this.view = new DataView(buffer); }
  ensure(n: number) { if (this.pos + n > this.bytes.length) throw new Error('Arquivo Encore truncado ou corrompido.'); }
  u8() { this.ensure(1); return this.bytes[this.pos++]; }
  i8() { const n = this.u8(); return n > 127 ? n - 256 : n; }
  u16() { this.ensure(2); const n = this.view.getUint16(this.pos, this.little); this.pos += 2; return n; }
  i16() { this.ensure(2); const n = this.view.getInt16(this.pos, this.little); this.pos += 2; return n; }
  u32() { this.ensure(4); const n = this.view.getUint32(this.pos, this.little); this.pos += 4; return n; }
  seek(pos: number) { this.pos = Math.max(0, Math.min(pos, this.bytes.length)); }
  skip(n: number) { this.seek(this.pos + n); }
  ascii(pos: number, length: number) { return String.fromCharCode(...this.bytes.slice(pos, pos + length)); }
  string8(max: number) { const start = this.pos; let end = start; while (end < start + max && end < this.bytes.length && this.bytes[end] !== 0 && this.bytes[end] !== 4) end++; this.pos = Math.min(start + max, this.bytes.length); return dec.decode(this.bytes.slice(start, end)); }
  string16(max: number) { const chars: number[] = []; const end = Math.min(this.pos + max, this.bytes.length); while (this.pos + 1 < end) { const c = this.view.getUint16(this.pos, true); this.pos += 2; if (c === 0) { this.seek(end); break; } chars.push(c); } this.seek(end); return String.fromCharCode(...chars); }
}

function isInstrumentMagic(id: string) { return /^TK\d\d$/.test(id); }
function findMagic(r: Reader): string | null {
  for (let p = r.pos; p + 4 <= r.bytes.length; p++) {
    const id = r.ascii(p, 4);
    if (KNOWN.has(id) || isInstrumentMagic(id)) { r.seek(p + 4); return id; }
  }
  r.seek(r.bytes.length); return null;
}

function parseHeader(r: Reader): Header {
  if (r.bytes.length < 0xc2) throw new Error('O arquivo é pequeno demais para ser uma partitura Encore.');
  const magic = r.ascii(0, 4);
  if (magic !== 'SCOW' && magic !== 'SCO5') throw new Error('Formato não reconhecido: esperado um arquivo Encore SCOW/SCO5.');
  r.little = magic === 'SCOW';
  r.seek(4); const marker = r.u8();
  r.seek(0x28); const version = r.u16(); r.u16(); r.u16();
  const lineCount = r.i16(); r.i16();
  const instrumentCount = r.i8(); const staffPerSystem = r.i8(); const measureCount = r.i16();
  r.seek(0xc2);
  return { magic, version, marker, lineCount, instrumentCount: Math.max(0, instrumentCount), staffPerSystem: Math.max(0, staffPerSystem), measureCount };
}

function parseInstrument(r: Reader, size: number, probe: boolean): Instrument {
  const start = r.pos; const offset = size & 0xffff; let two = offset > 250;
  if (probe && !two && r.pos + 1 < r.bytes.length) two = r.bytes[r.pos] >= 0x20 && r.bytes[r.pos] < 0x7f && r.bytes[r.pos + 1] === 0;
  const available = Math.max(0, offset - 8);
  const name = two ? r.string16(available) : r.string8(available);
  r.seek(start + available);
  return { name: name.trim(), nstaves: 1, show: true, midiProgram: 0 };
}

function parseLine(r: Reader, size: number, staffCount: number): Line {
  const start = r.pos; r.skip(10); const lineStart = r.u16(); const measureCount = r.u8(); const staves: StaffData[] = [];
  for (let i = 0; i < staffCount && r.pos + 30 <= r.bytes.length; i++) {
    const s = r.pos; r.skip(14); const clef = r.i8(); const key = r.u8(); r.u8(); r.u8(); r.u8(); const show = r.u8() !== 0; const staffType = r.u8(); const packed = r.u8();
    staves.push({ clef, key, show, staffType, instrumentIndex: packed & 0x3f, staffIndex: packed >> 6 }); r.seek(s + 30);
  }
  r.seek(start + Math.max(0, size));
  return { start: lineStart, measureCount, staves };
}

function baseElem(r: Reader, start: number, tick: number, type: number, voice: number): BaseElem {
  r.seek(start + 3); const size = r.u8(); const staff = r.u8() & 0x3f;
  return { kind: 'other', tick, type, voice, size, staff, x: 0, realDuration: -1 };
}

function parseElem(r: Reader, start: number, tick: number, type: number, voice: number): Elem {
  const b = baseElem(r, start, tick, type, voice);
  const u8 = (off: number) => start + off < r.bytes.length ? r.bytes[start + off] : 0;
  const i8 = (off: number) => { const n = u8(off); return n > 127 ? n - 256 : n; };
  const u16 = (off: number) => start + off + 1 < r.bytes.length ? r.view.getUint16(start + off, r.little) : 0;
  b.x = u8(10);
  if (type === 2) return { ...b, kind: 'key', value: u8(5) } as KeyElem;
  if (type === 3) return { ...b, kind: 'tie', start: u8(5) === 0xfe } as TieElem;
  if (type === 5) return { ...b, kind: 'ornament', ornament: u8(5), endMeasure: u8(18), x2: u8(20), mirror: u8(26) & 3, beatNote: u8(28), tempo: u8(30), textIndex: u8(32) } as OrnamentElem;
  if (type === 7) {
    const hasText = (u8(6) & 1) !== 0; let text = '';
    if (hasText) { const chars: number[] = []; for (let p = start + 14; p + 1 < Math.min(start + 50, r.bytes.length); p += 2) { const c = r.view.getUint16(p, true); if (!c) break; chars.push(c); } text = String.fromCharCode(...chars); }
    return { ...b, kind: 'chord-symbol', text } as ChordElem;
  }
  if (type === 8) return { ...b, kind: 'rest', face: u8(5), tuplet: u8(13), dot: u8(14) } as RestElem;
  if (type === 9) {
    let tuplet = u8(13); let pitch = u8(15); if (b.size === 22) { pitch = tuplet; tuplet = 0; }
    return { ...b, kind: 'note', face: u8(5), grace1: u8(6), grace2: u8(7), position: i8(12), tuplet, dot: u8(14), pitch, playback: u16(16), velocity: u8(19), options: u8(20), accidental: u8(21), artUp: u8(24), artDown: u8(26) } as NoteElem;
  }
  return b;
}

function calculateRealDurations(measure: Measure) {
  const groups = new Map<string, Elem[]>();
  for (const e of measure.elements) if ((e.kind === 'note' || e.kind === 'rest') && e.tick <= measure.durTicks) { const key = `${e.staff}:${e.voice}`; if (!groups.has(key)) groups.set(key, []); groups.get(key)!.push(e); }
  for (const elems of groups.values()) {
    elems.sort((a, b) => a.tick - b.tick);
    for (let i = 0; i < elems.length; i++) { let j = i + 1; while (j < elems.length && elems[j].tick - elems[i].tick < 4) j++; const next = j < elems.length ? elems[j].tick : measure.durTicks; if (next > elems[i].tick) elems[i].realDuration = next - elems[i].tick; }
  }
}

function parseMeasure(r: Reader, size: number, veryOld: boolean): Measure {
  const start = r.pos; const u8 = (o: number) => r.bytes[start + o] ?? 0; const u16 = (o: number) => start + o + 1 < r.bytes.length ? r.view.getUint16(start + o, r.little) : 0; const u32 = (o: number) => start + o + 3 < r.bytes.length ? r.view.getUint32(start + o, r.little) : 0;
  const elemOffset = veryOld ? 0x3e : 0x36;
  const measure: Measure = { bpm: u16(0), beatTicks: u16(4), durTicks: u16(6), beats: u8(8), beatType: u8(9), barStart: u8(12), barEnd: u8(13), alternative: u8(15), repeat: (u32(0x19) >>> 8) & 0xff, elements: [] };
  const end = Math.min(r.bytes.length, start + size + elemOffset); let p = start + elemOffset; let count = 0;
  while (p + 4 < end && count++ < 10000) {
    const tick = r.view.getUint16(p, r.little); if (tick === 0xffff) break;
    const tv = r.bytes[p + 2]; if (tv === 0xff) break; const type = tv >> 4; const voice = tv & 15; const elem = parseElem(r, p, tick, type, voice);
    if (type !== 0) measure.elements.push(elem);
    const spacing = veryOld ? elem.size * 2 : elem.size; if (spacing < 4) break; p += spacing;
  }
  calculateRealDurations(measure); r.seek(end); return measure;
}

function parseText(r: Reader, size: number): string[] {
  const start = r.pos; r.skip(2); const count = r.u16(); r.skip(4); const texts: string[] = [];
  for (let i = 0; i < count && r.pos + 16 <= r.bytes.length; i++) { const n = r.u16(); r.skip(14); texts.push(r.string8(Math.max(0, n - 14))); }
  r.seek(Math.min(r.bytes.length, start + size)); return texts;
}

function parseTitle(r: Reader, size: number, twoHint: boolean) {
  const start = r.pos; const two = size >= 10000 || twoHint; r.skip(2); const items: string[] = [];
  for (let i = 0; i < 20; i++) { r.skip(30); items.push(two ? r.string16(1026) : r.string8(66)); }
  r.seek(Math.min(r.bytes.length, start + size));
  return { title: items[0] || '', subtitles: items.slice(1, 3), instructions: items.slice(3, 6), authors: items.slice(6, 10), copyrights: items.slice(14, 20) };
}

function parseScore(buffer: ArrayBuffer): Score {
  const r = new Reader(buffer); const header = parseHeader(r); const instruments: Instrument[] = []; const lines: Line[] = []; const measures: Measure[] = []; let texts: string[] = []; let title = ''; let subtitles: string[] = []; let authors: string[] = []; let instructions: string[] = []; let copyrights: string[] = []; let twoHint = false; const warnings: string[] = [];
  while (r.pos < r.bytes.length) {
    const id = findMagic(r); if (!id || r.pos + 4 > r.bytes.length) break; const size = r.u32();
    try {
      if (id === 'LINE') lines.push(parseLine(r, size, header.staffPerSystem));
      else if (id === 'MEAS') measures.push(parseMeasure(r, size, header.marker === 0xa6));
      else if (id === 'TEXT') texts = parseText(r, size);
      else if (id === 'TITL') ({ title, subtitles, authors, instructions, copyrights } = parseTitle(r, size, twoHint));
      else if (isInstrumentMagic(id)) { const inst = parseInstrument(r, size, header.marker !== 0xc2 && header.marker !== 0xa6); instruments.push(inst); twoHint = (size & 0xffff) > 250; }
    } catch { warnings.push(`Bloco ${id} incompleto; a conversão continuou com os dados disponíveis.`); }
  }
  while (instruments.length < header.instrumentCount) instruments.push({ name: `Parte ${instruments.length + 1}`, nstaves: 1, show: true, midiProgram: 0 });
  if (!instruments.length) for (let i = 0; i < Math.max(1, header.instrumentCount); i++) instruments.push({ name: `Parte ${i + 1}`, nstaves: 1, show: true, midiProgram: 0 });
  if (lines[0]) for (let i = 0; i < instruments.length; i++) { const matches = lines[0].staves.filter(s => s.instrumentIndex === i); instruments[i].nstaves = Math.max(1, matches.length); if (matches[0]) instruments[i].show = matches[0].show; }
  if (header.marker !== 0xc2 && header.marker !== 0xa6) for (let i = 0; i < instruments.length; i++) { const namePos = 202 + i * 2158; if (!instruments[i].name && namePos + 2 < r.bytes.length && r.bytes[namePos + 1] === 0) { r.seek(namePos); instruments[i].name = r.string16(Math.min(512, r.bytes.length - namePos)); } const prgPos = 2278 + i * 2158; const p = r.bytes[prgPos]; if (p >= 1 && p <= 128) instruments[i].midiProgram = p; }
  if (!measures.length) throw new Error('Nenhum compasso Encore legível foi encontrado.');
  return { header, instruments, lines, measures, texts, title, subtitles, authors, instructions, copyrights, warnings };
}

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
const e = (name: string, value?: unknown, attrs = '') => value === undefined ? `<${name}${attrs}/>` : `<${name}${attrs}>${esc(value)}</${name}>`;
const faceDuration = (face: number) => [0, 960, 480, 240, 120, 60, 30, 15, 7][face & 15] || 0;
const faceType = (face: number) => ['', 'whole', 'half', 'quarter', 'eighth', '16th', '32nd', '64th', '128th'][face & 15] || 'quarter';
const standardDurations = new Set([960,480,240,120,60,30,15,7,720,360,180,90,45,840,420,210,105,900,450,225,640,320,160,80,40,20]);
function grace(n: NoteElem) { const a = n.grace1 & 0x30, b = n.grace2 & 5; return a === 0x20 && b === 4 ? 'acciaccatura' : a > 0x10 && b !== 1 ? 'appoggiatura' : ''; }
function detectTuplet(duration: number, face: number): [number, number] { const base = faceDuration(face); if (duration === base * 2 / 3) return [3,2]; if (duration === base * 4 / 5) return [5,4]; return [0,0]; }
function noteDuration(n: NoteElem) { if (grace(n)) return 0; if (n.realDuration > 0 && (standardDurations.has(n.realDuration) || detectTuplet(n.realDuration, n.face)[0])) return n.realDuration; return faceDuration(n.face); }
function restDuration(n: RestElem) { return faceDuration(n.face); }
function dots(duration: number, face: number) { const base = faceDuration(face); return duration === base * 3 / 2 ? 1 : duration === base * 7 / 4 ? 2 : duration === base * 15 / 8 ? 3 : 0; }
function correctedType(duration: number, face: number) { const map: Record<number,string> = {960:'whole',480:'half',240:'quarter',120:'eighth',60:'16th',30:'32nd',15:'64th',720:'half',360:'quarter',180:'eighth',90:'16th',45:'32nd',640:'whole',320:'half',160:'quarter',80:'eighth',40:'16th',20:'32nd',10:'64th'}; return map[duration] || faceType(face); }
function theoreticalDuration(m: Measure) { const unit: Record<number,number> = {1:960,2:480,4:240,8:120,16:60,32:30,64:15}; return m.beats && m.beatType ? m.beats * (unit[m.beatType] || 240) : m.durTicks; }
function fifths(key: number) { return [0,-1,-2,-3,-4,-5,-6,-7,1,2,3,4,5,6,7][key] ?? 0; }
function clefData(clef: number) { return ({0:['G',2,0],1:['F',4,0],2:['C',3,0],3:['C',4,0],4:['G',2,1],5:['G',2,-1],6:['F',4,-1],7:['percussion',2,0],8:['TAB',5,0]} as Record<number,[string,number,number]>)[clef]; }
function pitchXml(n: NoteElem, currentFifths: number) { const sharp = [0,1,0,1,0,0,1,0,1,0,1,0], names = ['C','C','D','D','E','F','F','G','G','A','A','B']; let step: string, alter: number, octave: number; if (n.accidental === 2 || (sharp[n.pitch % 12] && n.accidental === 0 && currentFifths < 0)) { step = names[(n.pitch + 1) % 12]; alter = -1; octave = Math.floor((n.pitch + 1) / 12) - 1; } else { step = names[n.pitch % 12]; alter = sharp[n.pitch % 12]; octave = Math.floor(n.pitch / 12) - 1; } return `<pitch>${e('step',step)}${alter ? e('alter',alter) : ''}${e('octave',octave)}</pitch>`; }

function indentXml(xml: string) { let level = 0; return xml.replace(/></g, '>\n<').split('\n').map(line => { if (/^<\//.test(line)) level--; const out = '  '.repeat(Math.max(0,level)) + line; if (/^<[^!?/][^>]*>$/.test(line) && !/<\/|\/>$/.test(line)) level++; return out; }).join('\n'); }

function convert(score: Score): string {
  const visible = score.instruments.map((inst,i) => ({inst,i})).filter(({inst,i}) => inst.show && score.lines[0]?.staves[i]?.staffType !== 1 && score.lines[0]?.staves[i]?.clef !== 8);
  if (!visible.length) throw new Error('A partitura não contém pautas visíveis compatíveis.');
  const authors = score.authors.filter(Boolean).join('\n'), rights = score.copyrights.filter(Boolean).join('\n'), lyricist = score.instructions.filter(Boolean).join('\n');
  let xml = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd"><score-partwise version="3.1"><work>${e('work-title',score.title)}${score.subtitles.filter(Boolean).length ? e('work-number',score.subtitles.filter(Boolean).join('\n')) : ''}</work><identification>${authors ? `<creator type="composer">${esc(authors)}</creator>` : ''}${lyricist ? `<creator type="lyricist">${esc(lyricist)}</creator>` : ''}${rights ? e('rights',rights) : ''}<encoding>${e('software','Enc2MusicXML Web')}</encoding></identification><part-list>`;
  visible.forEach(({inst},x) => { xml += `<score-part id="P${x+1}">${e('part-name',inst.name || `Parte ${x+1}`)}${inst.midiProgram ? `<midi-instrument id="P${x+1}-I1">${e('midi-program',inst.midiProgram)}</midi-instrument>` : ''}</score-part>`; }); xml += '</part-list>';
  visible.forEach(({inst,i: partIndex},xmlIndex) => {
    let currentFifths = fifths(score.lines[0]?.staves[partIndex]?.key || 0); xml += `<part id="P${xmlIndex+1}">`;
    score.measures.forEach((m,mi) => {
      xml += `<measure number="${mi+1}">`;
      if (m.barStart === 2 || m.barStart === 3 || (m.alternative && (mi === 0 || score.measures[mi-1].alternative !== m.alternative))) { xml += '<barline location="left">'; if (m.barStart === 3) xml += e('bar-style','light-light'); if (m.alternative) xml += `<ending number="${[1,2,3,4].filter(n => m.alternative & (1 << (n-1))).join(', ')}" type="start"/>`; if (m.barStart === 2) xml += '<repeat direction="forward"/>'; xml += '</barline>'; }
      const keyChange = m.elements.find(x => x.kind === 'key') as KeyElem | undefined; const timeChange = mi > 0 && (m.beats !== score.measures[mi-1].beats || m.beatType !== score.measures[mi-1].beatType);
      if (mi === 0 || keyChange || timeChange) { if (keyChange) currentFifths = fifths(keyChange.value); xml += '<attributes>'; if (mi === 0) xml += e('divisions',240); if (mi === 0 || keyChange) xml += `<key>${e('fifths',currentFifths)}</key>`; if (mi === 0 || timeChange) xml += `<time>${e('beats',m.beats || 4)}${e('beat-type',m.beatType || 4)}</time>`; if (mi === 0 && inst.nstaves > 1) xml += e('staves',inst.nstaves); if (mi === 0) { const count = Math.max(1,inst.nstaves); for (let s=0;s<count;s++) { const c = clefData(score.lines[0]?.staves[partIndex+s]?.clef ?? 0); if (c) xml += `<clef${count>1?` number="${s+1}"`:''}>${e('sign',c[0])}${e('line',c[1])}${c[2]?e('clef-octave-change',c[2]):''}</clef>`; } } xml += '</attributes>'; }
      if (xmlIndex === 0 && (m.repeat === 0x85 || m.repeat === 0x89 || m.repeat === 0x88)) xml += `<direction placement="above"><direction-type>${m.repeat === 0x88 ? '<segno/>' : '<coda/>'}</direction-type></direction>`;
      const voices = [...new Set(m.elements.filter(x => x.staff === partIndex).map(x => x.voice))].sort((a,b)=>a-b); let previousVoiceTicks = 0;
      voices.forEach((voice,voiceIx) => {
        if (voiceIx && previousVoiceTicks) xml += `<backup>${e('duration',previousVoiceTicks)}</backup>`;
        const source = m.elements.filter(x => x.staff === partIndex && x.voice === voice && (x.kind === 'note' || x.kind === 'rest')) as (NoteElem|RestElem)[]; const accepted: (NoteElem|RestElem)[] = []; let firstPassTick=0, root=-999;
        for (const item of source) { const duration = item.kind === 'note' ? noteDuration(item) : restDuration(item); const chord = item.kind === 'note' && item.tick-root >= 0 && item.tick-root < 8; if (!chord) root=item.tick; if (duration<=0 && item.kind==='rest') continue; if (!chord && firstPassTick+duration>theoreticalDuration(m)) continue; if (item.kind==='note' && item.realDuration>4 && item.realDuration<15 && faceDuration(item.face)>15) continue; accepted.push(item); if (!chord) firstPassTick+=duration; }
        let tick=0; root=-999; let lastRootDur=0; let tupletOpen=false; const measureDur=theoreticalDuration(m);
        accepted.forEach((item,index) => {
          const chord = item.kind === 'note' && item.tick-root >= 0 && item.tick-root < 8; if (!chord) root=item.tick; const rawDuration = item.kind==='note'?noteDuration(item):restDuration(item); const duration = chord && lastRootDur ? lastRootDur : rawDuration; if (!chord) lastRootDur=duration;
          let actual = item.tuplet >> 4, normal = item.tuplet & 15; if (!actual && item.kind==='note') [actual,normal]=detectTuplet(duration,item.face);
          let noteXml='<note>'; if (item.kind==='note' && grace(item)) noteXml += grace(item)==='acciaccatura'?'<grace slash="yes"/>':'<grace/>'; if (chord) noteXml+='<chord/>';
          if (item.kind==='note') noteXml += pitchXml(item,currentFifths); else noteXml += '<rest/>'; if (!(item.kind==='note'&&grace(item))) noteXml += e('duration',duration);
          const tieStart = item.kind==='note' && m.elements.some(t => t.kind==='tie' && (t as TieElem).start && t.voice===item.voice && t.staff===item.staff && item.tick-t.tick>=0 && item.tick-t.tick<4); let tieStop=false; if(item.kind==='note') { const prevMeasures=[...score.measures.slice(0,mi),m]; outer: for(let pm=prevMeasures.length-1;pm>=0;pm--){ const candidates=prevMeasures[pm].elements.filter(x=>x.kind==='note'&&x.staff===item.staff&&x.voice===item.voice) as NoteElem[]; for(let q=candidates.length-1;q>=0;q--){const candidate=candidates[q]; if(candidate===item) continue; if(candidate.pitch===item.pitch){tieStop=prevMeasures[pm].elements.some(t=>t.kind==='tie'&&(t as TieElem).start&&t.staff===candidate.staff&&t.voice===candidate.voice&&candidate.tick-t.tick>=0&&candidate.tick-t.tick<4); break outer;}}}}
          if (tieStop) noteXml+='<tie type="stop"/>'; if (tieStart) noteXml+='<tie type="start"/>'; if (voices.length>1) noteXml+=e('voice',voice+1); noteXml+=e('type',correctedType(duration,item.face)); noteXml+='<dot/>'.repeat(dots(duration,item.face)); if(actual&&normal) noteXml+=`<time-modification>${e('actual-notes',actual)}${e('normal-notes',normal)}</time-modification>`; if(inst.nstaves>1) noteXml+=e('staff',voice<4?1:2);
          const next=accepted[index+1]; const nextTuplet=next?((next.tuplet>>4)>0||detectTuplet(next.kind==='note'?noteDuration(next):restDuration(next),next.face)[0]>0):false; const notation:string[]=[]; if(actual&&!tupletOpen){notation.push('<tuplet type="start"/>');tupletOpen=true;} if(tupletOpen&&!nextTuplet){notation.push('<tuplet type="stop"/>');tupletOpen=false;} if(tieStop)notation.push('<tied type="stop"/>');if(tieStart)notation.push('<tied type="start"/>');if(item.kind==='note'&&(item.artUp===0x20||item.artDown===0x20))notation.push('<fermata/>');if(notation.length)noteXml+=`<notations>${notation.join('')}</notations>`; noteXml+='</note>'; xml+=noteXml; if(!chord)tick+=rawDuration;
        });
        if (tick<measureDur) { const gap=measureDur-tick; xml+=`<note><rest measure="${tick===0?'yes':'no'}"/>${e('duration',gap)}${voices.length>1?e('voice',voice+1):''}${inst.nstaves>1?e('staff',voice<4?1:2):''}</note>`; tick=measureDur; } previousVoiceTicks=tick;
      });
      if (xmlIndex===0) { const words:Record<number,string>={0x80:'D.C. al Coda',0x81:'D.S. al Coda',0x82:'D.C. al Fine',0x83:'D.S. al Fine',0x84:'D.S.',0x86:'Fine',0x87:'D.C.'}; if(words[m.repeat])xml+=`<direction placement="above"><direction-type>${e('words',words[m.repeat])}</direction-type></direction>`; }
      const altEnd=m.alternative&&(mi===score.measures.length-1||score.measures[mi+1].alternative!==m.alternative); if(m.barEnd===4||m.barEnd===5||m.barEnd===6||altEnd){xml+='<barline location="right">';if(m.barEnd===5)xml+=e('bar-style','light-heavy');if(m.barEnd===6)xml+=e('bar-style','light-light');if(altEnd)xml+=`<ending number="${[1,2,3,4].filter(n=>m.alternative&(1<<(n-1))).join(', ')}" type="stop"/>`;if(m.barEnd===4)xml+='<repeat direction="backward"/>';xml+='</barline>';}
      xml+='</measure>';
    }); xml+='</part>';
  });
  return indentXml(xml+'</score-partwise>');
}

export function convertEncore(buffer: ArrayBuffer): ConversionResult {
  const score = parseScore(buffer); const xml = convert(score); const notes = score.measures.flatMap(m=>m.elements).filter(e=>e.kind==='note').length; const rests = score.measures.flatMap(m=>m.elements).filter(e=>e.kind==='rest').length;
  return { xml, stats: { title: score.title || 'Sem título', format: `${score.header.magic} / 0x${score.header.marker.toString(16).toUpperCase()}`, measures: score.measures.length, parts: score.instruments.length, notes, rests, warnings: score.warnings } };
}
