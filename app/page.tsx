'use client';

import { useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ConversionResult, convertEncore } from './lib/enc-converter';

gsap.registerPlugin(useGSAP);

type Publication = { title: string; summary: string; year: number; tags: string[]; href: string };

const researchLines = [
  { icon: '𝄞', title: 'Preservação digital', text: 'Recuperação de acervos musicais em formatos legados, como o Encore, para garantir acesso a longo prazo.' },
  { icon: '♫', title: 'Interoperabilidade', text: 'Conversão para MusicXML, padrão aberto compatível com MuseScore, Finale e Sibelius.' },
  { icon: '⌘', title: 'Software livre', text: 'Desenvolvimento aberto sob GPL-3.0, com atribuição integral aos autores originais.' },
  { icon: '✎', title: 'Educação musical', text: 'Apoio a professores e estudantes que precisam editar partituras antigas em ferramentas atuais.' },
];

const publications: Publication[] = [
  { title: 'Enc2MusicXML: conversor de partituras Encore', summary: 'Projeto original em C++ que interpreta os blocos binários do formato .enc e gera MusicXML.', year: 2018, tags: ['Conversão', 'Software livre'], href: 'https://github.com/lvinken/Enc2MusicXML' },
  { title: 'enc2ly: do Encore ao LilyPond', summary: 'Trabalho de referência sobre a estrutura do formato Encore, creditado pelo autor original.', year: 2005, tags: ['Formato Encore', 'Engenharia reversa'], href: 'https://github.com/lvinken/Enc2MusicXML' },
  { title: 'Enc2MusicXML Web', summary: 'Port em TypeScript que roda inteiramente no navegador, sem envio de arquivos a servidores.', year: 2025, tags: ['Conversão', 'Web'], href: 'https://github.com/GlauberLASantiago/encore-to-musicxml' },
  { title: 'Guia de migração de acervos para MusicXML', summary: 'Boas práticas para revisar partituras convertidas e validar o resultado em editores modernos.', year: 2025, tags: ['Educação', 'Web'], href: '#conversor' },
];

const team = [
  { name: 'Prof. Glauber Santiago', role: 'Coordenação · UFSCar', initials: 'GS' },
  { name: 'Leon Vinken', role: 'Projeto original', initials: 'LV' },
  { name: 'Felipe E. F. de Castro', role: 'Trabalho de referência', initials: 'FC' },
  { name: 'Han-Wen Nienhuys', role: 'Trabalho de referência', initials: 'HN' },
];

type State = 'idle' | 'reading' | 'done' | 'error';

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const previousState = useRef<State | null>(null);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<State>('idle');
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('Todos');

  const filters = ['Todos', ...Array.from(new Set(publications.map(item => String(item.year)))).sort().reverse(), ...Array.from(new Set(publications.flatMap(item => item.tags))).sort().map(tag => '#' + tag)];
  const visible = publications.filter(item => filter === 'Todos' || filter === String(item.year) || item.tags.some(tag => '#' + tag === filter));

  useGSAP(() => {
    const stateBeforeUpdate = previousState.current;
    previousState.current = state;

    if (stateBeforeUpdate === null) return;

    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      if (state === 'idle') {
        gsap.fromTo(
          '.dropzone',
          { autoAlpha: 0.75, y: 8 },
          { autoAlpha: 1, y: 0, duration: 0.28, ease: 'power2.out' },
        );
        return;
      }

      gsap.fromTo(
        '.resultCard',
        { autoAlpha: 0.8, y: 8 },
        { autoAlpha: 1, y: 0, duration: 0.28, ease: 'power2.out' },
      );

      if (state === 'done') {
        gsap.fromTo(
          '.resultCard small, .resultCard strong, .resultCard p, .stats span, .actions button',
          { autoAlpha: 0, y: 7 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.2,
            stagger: 0.045,
            delay: 0.04,
            ease: 'power2.out',
          },
        );
      }
    });

    return () => media.revert();
  }, { scope: heroRef, dependencies: [state], revertOnUpdate: true });

  async function process(file?: File) {
    if (!file) return;
    setFileName(file.name); setState('reading'); setError(''); setResult(null);
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error('O arquivo ultrapassa o limite de segurança de 100 MB.');
      const converted = convertEncore(await file.arrayBuffer());
      setResult(converted); setState('done');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível converter este arquivo.'); setState('error');
    }
  }

  function download() {
    if (!result) return;
    const blob = new Blob([result.xml], { type: 'application/vnd.recordare.musicxml+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = fileName.replace(/\.enc$/i, '') + '.musicxml'; link.click(); URL.revokeObjectURL(url);
  }

  function reset() { setState('idle'); setResult(null); setError(''); setFileName(''); if (inputRef.current) inputRef.current.value = ''; }

  return (
    <>
      {/* ===== 1. Header institucional ===== */}
      <header className="siteHeader">
        <div className="container headerInner">
          <a className="brand" href="#inicio" onClick={reset} aria-label="Enc2MusicXML Web — início"><span className="brandMark" aria-hidden="true">𝄞</span><span>Enc2MusicXML <b>Web</b></span></a>
          <nav className="navLinks" aria-label="Principal">
            <a href="#linhas">Linhas</a><a href="#publicacoes">Publicações</a><a href="#equipe">Equipe</a>
          </nav>
        </div>
      </header>

      <main id="inicio">
        {/* ===== 2. Hero com missão + conversor ===== */}
        <section ref={heroRef} id="conversor" className={`hero ${state !== 'idle' ? 'compact' : ''}`} aria-labelledby="hero-title">
          <div className="container">
            <p className="eyebrow">Universidade Federal de São Carlos · Departamento de Música</p>
            <h1 id="hero-title">Partituras Encore, <em>acessíveis para sempre.</em></h1>
            <p className="lede">Nossa missão é preservar acervos musicais em formatos legados. Abra uma partitura <code>.enc</code>, converta e baixe um MusicXML compatível com MuseScore e outros editores. Seus dados nunca saem do computador.</p>

            {state === 'idle' && <div className={`dropzone ${dragging ? 'dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); process(event.dataTransfer.files[0]); }} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} aria-label="Escolher arquivo Encore para converter" onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inputRef.current?.click(); } }}>
              <input ref={inputRef} type="file" accept=".enc,application/octet-stream" hidden onChange={event => process(event.target.files?.[0])} />
              <span className="fileIcon" aria-hidden="true">♫</span><strong>Solte seu arquivo Encore aqui</strong><span>ou clique para escolher um arquivo .enc</span><button type="button" tabIndex={-1}>Escolher arquivo</button>
            </div>}

            {state === 'reading' && <div className="resultCard processing" role="status"><span className="spinner"/><div><small>Interpretando partitura</small><strong>{fileName}</strong><p>Lendo blocos Encore e preparando o MusicXML…</p></div></div>}

            {state === 'error' && <div className="resultCard errorCard" role="alert"><span className="statusIcon">!</span><div><small>Não foi possível converter</small><strong>{fileName}</strong><p>{error}</p><button className="secondary" onClick={reset}>Tentar outro arquivo</button></div></div>}

            {state === 'done' && result && <div className="resultCard successCard" role="status"><span className="statusIcon">✓</span><div className="resultMain"><small>Conversão concluída</small><strong>{result.stats.title}</strong><p className="filename">{fileName}</p><div className="stats"><span><b>{result.stats.parts}</b> partes</span><span><b>{result.stats.measures}</b> compassos</span><span><b>{result.stats.notes}</b> notas</span><span><b>{result.stats.rests}</b> pausas</span></div>{result.stats.warnings.length > 0 && <p className="warning">Atenção: {result.stats.warnings.join(' ')}</p>}<div className="actions"><button onClick={download}>Baixar MusicXML</button><button className="secondary" onClick={reset}>Converter outro</button></div></div></div>}

            <div className="trustRow" aria-label="Características"><span><i>✓</i> Processamento local</span><span><i>✓</i> Sem cadastro</span><span><i>✓</i> Código aberto</span></div>
          </div>
        </section>

        {/* ===== 3. Vitrine de linhas de pesquisa ===== */}
        <section id="linhas" className="section" aria-labelledby="linhas-title">
          <div className="container">
            <div className="sectionHead"><h2 id="linhas-title">Linhas de pesquisa</h2></div>
            <div className="grid linesGrid">
              {researchLines.map(line => <article key={line.title} className="card"><span className="cardIcon" aria-hidden="true">{line.icon}</span><h3>{line.title}</h3><p>{line.text}</p></article>)}
            </div>
          </div>
        </section>

        {/* ===== 4. Publicações com filtro ano/tag ===== */}
        <section id="publicacoes" className="section" aria-labelledby="pub-title">
          <div className="container">
            <div className="sectionHead">
              <h2 id="pub-title">Publicações e projetos</h2>
              <div className="filters" role="group" aria-label="Filtrar por ano ou tag">
                {filters.map(item => <button key={item} type="button" className={`pill ${filter === item ? 'active' : ''}`} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}
              </div>
            </div>
            <div className="grid pubGrid" aria-live="polite">
              {visible.map(item => <article key={item.title} className="card pubCard">
                <div className="pubMeta"><span className="year">{item.year}</span>{item.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}</div>
                <h3>{item.title}</h3><p>{item.summary}</p>
                <a className="pdfLink" href={item.href} target={item.href.startsWith('#') ? undefined : '_blank'} rel="noreferrer">Ler PDF →</a>
              </article>)}
            </div>
          </div>
        </section>

        {/* ===== 5. Grade de equipe ===== */}
        <section id="equipe" className="section" aria-labelledby="team-title">
          <div className="container">
            <div className="sectionHead"><h2 id="team-title">Equipe e créditos</h2></div>
            <div className="grid teamGrid">
              {team.map(person => <article key={person.name} className="member"><span className="avatar" aria-hidden="true">{person.initials}</span><h3>{person.name}</h3><p>{person.role}</p></article>)}
            </div>
            <aside className="note">Esta versão preserva a atribuição aos autores e projetos que tornaram a conversão possível. Licença <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noreferrer">GPL-3.0-or-later</a>.</aside>
          </div>
        </section>
      </main>

      {/* ===== 6. Rodapé institucional ===== */}
      <footer className="siteFooter"><div className="container footerInner"><span>Enc2MusicXML Web · Prof. Glauber Santiago — UFSCar</span><span>Sem upload de arquivos · <a href="https://github.com/lvinken/Enc2MusicXML" target="_blank" rel="noreferrer">Projeto original ↗</a></span></div></footer>
    </>
  );
}
