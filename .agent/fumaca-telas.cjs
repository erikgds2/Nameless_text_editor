// Mostra, na tela, as duas superficies novas que teste de componente nao
// verifica: a faixa de conflito com o arquivo e a ajuda de atalhos.
//
// Nao toca nas notas do usuario: monta uma pagina propria com o CSS de verdade.
//
//   npx electron .agent/fumaca-telas.cjs
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');

const RAIZ = path.resolve(__dirname, '..');

const ATALHOS = [
  ['Notas', [['Ctrl + N', 'Nova nota'], ['Ctrl + Shift + D', 'Nota de hoje'], ['Ctrl + K', 'Paleta de comandos']]],
  ['Escrita', [['Ctrl + F', 'Buscar dentro da nota'], ['Esc', 'Sair do bloco para a lista'], ['[[', 'Ligar para outra nota']]],
  ['Janela', [['Ctrl + E', 'Pre-visualizacao'], ['Ctrl + /', 'Esta lista']]],
];

const listaDeAtalhos = ATALHOS.map(
  ([secao, itens]) => `<div class="atalhos__grupo">
      <h2 class="atalhos__secao">${secao}</h2>
      ${itens
        .map(
          ([tecla, oQueFaz]) =>
            `<p class="atalhos__linha"><kbd class="atalhos__tecla">${tecla}</kbd><span class="atalhos__texto">${oQueFaz}</span></p>`,
        )
        .join('')}
    </div>`,
).join('');

const PAGINA = (css) => `<!doctype html>
<html data-theme="carvao"><head><meta charset="utf-8"><style>${css}
  body { background: var(--base); }
  .editor { display: block; }
</style></head>
<body>
  <main class="editor">
    <header class="editor__header">
      <div class="editor__meta">
        <h1 class="editor__title">Anatomia do f&ecirc;mur</h1>
        <span class="editor__time">Editado em 09 de setembro, 12:40</span>
      </div>
    </header>
    <div class="conflito" role="alert">
      <span class="conflito__aviso">Este arquivo mudou por fora enquanto voc&ecirc; escrevia aqui.</span>
      <button class="conflito__acao">Ficar com o meu</button>
      <button class="conflito__acao">Usar o do disco</button>
    </div>
  </main>
  <div class="atalhos__fundo" style="inset:0">
    <section class="atalhos">${listaDeAtalhos}</section>
  </div>
</body></html>`;

app.whenReady().then(async () => {
  const css = await fs.readFile(path.join(RAIZ, 'src', 'styles.css'), 'utf8');
  const pagina = path.join(os.tmpdir(), 'ardosia-fumaca-telas.html');
  await fs.writeFile(pagina, PAGINA(css), 'utf8');

  const win = new BrowserWindow({ width: 820, height: 640, show: false });
  await win.loadFile(pagina);
  await new Promise((pronto) => setTimeout(pronto, 400));

  const medida = await win.webContents.executeJavaScript(`
    (() => {
      const faixa = document.querySelector('.conflito').getBoundingClientRect();
      const caixa = document.querySelector('.atalhos').getBoundingClientRect();
      const teclas = [...document.querySelectorAll('.atalhos__tecla')];
      const texto = [...document.querySelectorAll('.atalhos__texto')];
      // as teclas alinhadas numa coluna so: se alguma escapar, a lista fica torta
      const colunas = new Set(teclas.map((t) => Math.round(t.getBoundingClientRect().left)));
      const cortado = texto.some((t) => t.scrollWidth > t.clientWidth + 1);
      return {
        faixaVisivel: faixa.height > 0 && faixa.width > 0,
        atalhosNaTela: caixa.bottom <= window.innerHeight,
        colunas: colunas.size,
        cortado,
      };
    })()
  `);

  console.log('faixa de conflito aparece:', medida.faixaVisivel ? 'ok' : 'RUIM');
  console.log('ajuda de atalhos cabe na janela:', medida.atalhosNaTela ? 'ok' : 'RUIM');
  console.log('colunas de tecla (uma por grupo):', medida.colunas);
  console.log('texto de atalho cortado:', medida.cortado ? 'RUIM' : 'nao');

  const tiro = await win.webContents.capturePage();
  const destino = path.join(os.tmpdir(), 'ardosia-telas.png');
  await fs.writeFile(destino, tiro.toPNG());
  console.log('captura em:', destino);

  win.destroy();
  app.quit();
});
