'use client';

import { useRef, useState } from 'react';
import { ConversionResult, convertEncore } from './lib/enc-converter';

type State = 'idle' | 'reading' | 'done' | 'error';

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<State>('idle');
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState('');

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
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={reset} aria-label="Enc2MusicXML Web — início"><span className="brandMark">𝄞</span><span>Enc2MusicXML <b>Web</b></span></a>
        <a className="sourceLink" href="https://github.com/lvinken/Enc2MusicXML" target="_blank" rel="noreferrer">Projeto original ↗</a>
      </header>

      <section className={`hero ${state !== 'idle' ? 'compact' : ''}`}>
        <p className="eyebrow">Conversor local de partituras</p>
        <h1>Encore para MusicXML,<br /><em>direto no navegador.</em></h1>
        <p className="lede">Abra uma partitura <code>.enc</code>, converta e baixe um arquivo compatível com MuseScore e outros editores. Seus dados nunca saem do computador.</p>

        {state === 'idle' && <div className={`dropzone ${dragging ? 'dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); process(event.dataTransfer.files[0]); }} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click(); }}>
          <input ref={inputRef} type="file" accept=".enc,application/octet-stream" hidden onChange={event => process(event.target.files?.[0])} />
          <span className="fileIcon" aria-hidden="true">♫</span><strong>Solte seu arquivo Encore aqui</strong><span>ou clique para escolher um arquivo .enc</span><button type="button">Escolher arquivo</button>
        </div>}

        {state === 'reading' && <div className="resultCard processing" role="status"><span className="spinner"/><div><small>Interpretando partitura</small><strong>{fileName}</strong><p>Lendo blocos Encore e preparando o MusicXML…</p></div></div>}

        {state === 'error' && <div className="resultCard errorCard" role="alert"><span className="statusIcon">!</span><div><small>Não foi possível converter</small><strong>{fileName}</strong><p>{error}</p><button className="secondary" onClick={reset}>Tentar outro arquivo</button></div></div>}

        {state === 'done' && result && <div className="resultCard successCard" role="status"><span className="statusIcon">✓</span><div className="resultMain"><small>Conversão concluída</small><strong>{result.stats.title}</strong><p className="filename">{fileName}</p><div className="stats"><span><b>{result.stats.parts}</b> partes</span><span><b>{result.stats.measures}</b> compassos</span><span><b>{result.stats.notes}</b> notas</span><span><b>{result.stats.rests}</b> pausas</span></div>{result.stats.warnings.length > 0 && <p className="warning">Atenção: {result.stats.warnings.join(' ')}</p>}<div className="actions"><button onClick={download}>Baixar MusicXML</button><button className="secondary" onClick={reset}>Converter outro</button></div></div></div>}

        <div className="trustRow" aria-label="Características"><span><i>✓</i> Processamento local</span><span><i>✓</i> Sem cadastro</span><span><i>✓</i> Código aberto</span></div>
      </section>

      <section className="how" aria-labelledby="how-title"><div><p className="eyebrow">Fluxo simples</p><h2 id="how-title">Da partitura antiga ao editor moderno.</h2></div><ol><li><b>01</b><strong>Abra</strong><span>Selecione um arquivo criado no Encore.</span></li><li><b>02</b><strong>Converta</strong><span>A estrutura musical é interpretada localmente.</span></li><li><b>03</b><strong>Continue</strong><span>Baixe o MusicXML e abra no seu editor.</span></li></ol></section>

      <section className="credits" aria-labelledby="credits-title">
        <div className="creditsIntro"><p className="eyebrow">Créditos e licença</p><h2 id="credits-title">Construído sobre trabalho de código aberto.</h2><p>Esta versão preserva a atribuição aos autores e projetos que tornaram a conversão possível.</p></div>
        <div className="creditGrid">
          <article><span className="creditLabel">Projeto original</span><h3>Enc2MusicXML</h3><p><strong>Leon Vinken</strong><br />Copyright © 2018</p><a href="https://github.com/lvinken/Enc2MusicXML" target="_blank" rel="noreferrer">Ver repositório original ↗</a></article>
          <article><span className="creditLabel">Trabalhos de referência</span><h3>enc2ly e go-enc2ly</h3><p><strong>Felipe E. F. de Castro</strong><br /><strong>Han-Wen Nienhuys</strong></p><span className="creditNote">Projetos creditados pelo autor original.</span></article>
          <article className="authorCredit"><span className="creditLabel">Versão web</span><h3>Prof. Glauber Santiago</h3><p><strong>Universidade Federal de São Carlos — UFSCar</strong></p><span className="creditNote">Idealização, curadoria e publicação da versão para navegador.</span></article>
        </div>
      </section>

      <footer><span>Enc2MusicXML Web · Prof. Glauber Santiago — UFSCar</span><span><a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noreferrer">GPL-3.0-or-later</a> · Sem upload de arquivos</span></footer>
    </main>
  );
}
