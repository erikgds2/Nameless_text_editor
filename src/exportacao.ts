/**
 * Exportação de notas para documentos autônomos em HTML limpo,
 * utilizando a estética e tipografia quente do Ardósia.
 *
 * Módulo puro do núcleo: não depende de React ou DOM.
 */
import { renderizar } from './markdown';
import { textoDaNota, type Bloco } from './canvas';
import { escapar } from './inline';
import type { TipoDoc } from './notes';

export function gerarHtmlAutonomo(
  titulo: string,
  blocos: Bloco[],
  tipo: TipoDoc = 'markdown',
): string {
  const texto = textoDaNota(blocos);
  const conteudoHtml =
    tipo === 'markdown'
      ? renderizar(texto)
      : `<pre class="texto-puro">${escapar(texto)}</pre>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapar(titulo)}</title>
  <style>
    :root {
      --base: #F2EFE9;
      --ink: #33302B;
      --ink-strong: #1A1714;
      --ink-soft: #6B645C;
      --accent: #A4551A;
      --rule: rgba(26, 23, 20, 0.10);
      --marker: rgba(164, 85, 26, 0.16);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --base: #1A1714;
        --ink: #C2BCB2;
        --ink-strong: #DED8CE;
        --ink-soft: #8E8880;
        --accent: #D8934A;
        --rule: rgba(255, 255, 255, 0.07);
        --marker: rgba(216, 147, 74, 0.20);
      }
    }
    body {
      background: var(--base);
      color: var(--ink);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.65;
      margin: 0;
      padding: 48px 24px;
    }
    .folha {
      max-width: 720px;
      margin: 0 auto;
    }
    h1, h2, h3, h4, h5, h6 {
      color: var(--ink-strong);
      font-weight: 600;
      line-height: 1.3;
      margin-top: 1.5em;
    }
    h1.titulo-nota {
      margin-top: 0;
      border-bottom: 1px solid var(--rule);
      padding-bottom: 16px;
      margin-bottom: 32px;
    }
    a {
      color: var(--accent);
      text-decoration: underline;
    }
    code, pre {
      font-family: "Cascadia Mono", Consolas, monospace;
      font-size: 13px;
    }
    pre {
      background: rgba(128, 128, 128, 0.08);
      padding: 16px;
      border-radius: 4px;
      overflow-x: auto;
    }
    blockquote {
      border-left: 2px solid var(--accent);
      margin-left: 0;
      padding-left: 16px;
      color: var(--ink-soft);
    }
    mark.md-grifo {
      background: var(--marker);
      color: inherit;
      border-radius: 2px;
      padding: 0 2px;
    }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <article class="folha">
    <h1 class="titulo-nota">${escapar(titulo)}</h1>
    <div class="conteudo">
      ${conteudoHtml}
    </div>
  </article>
</body>
</html>`;
}
