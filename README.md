# Enc2MusicXML Web

Conversor de arquivos Encore (`.enc`) para MusicXML que roda inteiramente no navegador. É um port independente, em TypeScript/JavaScript, da lógica do projeto [lvinken/Enc2MusicXML](https://github.com/lvinken/Enc2MusicXML).

## Como usar

1. Instale Node.js 22.13 ou superior.
2. Na pasta do projeto, execute `npm install`.
3. Execute `npm run dev` e abra o endereço mostrado no terminal.
4. Arraste um arquivo `.enc` para a página e baixe o `.musicxml` gerado.

Para gerar a versão de produção, execute `npm run build`; para servi-la localmente, use `npm start`.

## Publicação no GitHub Pages

O projeto inclui o fluxo `.github/workflows/pages.yml`. Para publicar:

1. Envie todos os arquivos deste projeto para a branch `main` do seu repositório.
2. No GitHub, abra **Settings → Pages**.
3. Em **Build and deployment → Source**, escolha **GitHub Actions**.
4. Abra a aba **Actions** para acompanhar a publicação.

Em cada envio para a branch `main`, o GitHub gera a versão estática com `npm run build:pages` e publica o conteúdo automaticamente. O caminho relativo dos recursos já está configurado para funcionar em páginas de projeto, como `usuario.github.io/repositorio/`.

## O que foi portado

- Leitura dos contêineres Encore `SCOW` e `SCO5`, incluindo variantes 0xA6, 0xC2 e 0xC4.
- Blocos de instrumentos, sistemas/pautas, compassos, textos e títulos.
- Notas, pausas, acordes simultâneos, múltiplas vozes e múltiplas partes.
- Valores rítmicos, pontos, quiálteras, apojaturas/acciaccaturas, ligaduras de prolongamento e fermatas.
- Claves, armaduras, fórmulas de compasso, repetições, casas alternativas e programas MIDI.
- Filtro básico de artefatos de gravação MIDI e cálculo de durações a partir dos ticks.
- Exportação MusicXML 3.1 e download local, sem upload da partitura.

## Limitações técnicas

- O formato Encore é proprietário e não tem uma especificação pública completa. Arquivos produzidos por versões pouco comuns podem conter blocos ainda não conhecidos.
- O port cobre a lógica principal, mas não reproduz integralmente o `NoteConnector` em C++: slurs, wedges, textos de pauta e marcações de andamento complexas podem ser omitidos ou exigir ajuste manual.
- Símbolos de acordes e letras ainda não são exportados. Letras também não são suportadas pelo conversor original.
- Quiálteras aninhadas e algumas articulações não padronizadas não são suportadas, acompanhando as limitações do projeto original.
- A saída deve ser revisada no MuseScore ou em outro editor, sobretudo para partituras gravadas via MIDI ou com formatação avançada.

## Privacidade

O arquivo é lido por `File.arrayBuffer()` e convertido na própria aba. Não existe endpoint de upload nem armazenamento persistente.

## Licença e créditos

### Projeto original e trabalhos de referência

- **Enc2MusicXML** — Leon Vinken — copyright © 2018 — [repositório original](https://github.com/lvinken/Enc2MusicXML).
- **enc2ly** — Felipe E. F. de Castro — projeto creditado pelo autor original.
- **go-enc2ly** — Han-Wen Nienhuys — projeto creditado pelo autor original.

### Versão web

- **Prof. Glauber Santiago — Universidade Federal de São Carlos (UFSCar)** — idealização, curadoria e publicação da versão para navegador.

Este trabalho derivado é distribuído sob a **GNU General Public License v3 ou posterior**, em conformidade com a licença do Enc2MusicXML. O aviso de copyright do autor original e o texto integral da licença devem permanecer no repositório e nas redistribuições. Consulte `LICENSE` e `THIRD_PARTY_NOTICES.md`.
