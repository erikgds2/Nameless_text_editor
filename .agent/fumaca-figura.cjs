// Prova, na tela, que o bloco de figura desenha a imagem: o protocolo
// ardosia:// carrega dentro do canvas (e nao so na pre-visualizacao), a foto
// cabe no bloco sem esticar e as alcas continuam alcancaveis por cima dela.
//
// Nao toca nas notas do usuario: monta uma pagina propria com o CSS de verdade
// e serve como anexo o icone do proprio aplicativo.
//
//   npx electron .agent/fumaca-figura.cjs
const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const { pathToFileURL } = require('node:url');

const RAIZ = path.resolve(__dirname, '..');
const ICONE = path.join(RAIZ, 'build', 'icone.png');

protocol.registerSchemesAsPrivileged([
  { scheme: 'ardosia', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

const PAGINA = (css) => `<!doctype html>
<html data-theme="carvao"><head><meta charset="utf-8"><style>${css}
  /* a arvore do app inteiro nao interessa aqui; o que se mede e o bloco */
  body { background: var(--base); }
  .canvas { height: 480px; }
</style></head>
<body>
  <div class="canvas">
    <div class="bloco" style="left:40px;top:24px;width:320px;height:120px">
      <div class="bloco__alca"></div>
      <div class="bloco__espelho">Anatomia do fêmur</div>
      <textarea class="bloco__texto">Anatomia do fêmur</textarea>
      <div class="bloco__canto"></div>
    </div>
    <div id="figura" class="bloco" style="left:40px;top:160px;width:480px;height:270px">
      <div class="bloco__alca"></div>
      <button class="bloco__excluir" style="opacity:1"></button>
      <a class="bloco__origem" style="opacity:1" href="https://exemplo.org"></a>
      <img class="bloco__imagem" src="ardosia://anexos/icone.png" alt="">
      <div class="bloco__canto"></div>
    </div>
  </div>
</body></html>`;

app.whenReady().then(async () => {
  protocol.handle('ardosia', async () => net.fetch(pathToFileURL(ICONE).toString()));

  const css = await fs.readFile(path.join(RAIZ, 'src', 'styles.css'), 'utf8');
  const pagina = path.join(os.tmpdir(), 'ardosia-fumaca-figura.html');
  await fs.writeFile(pagina, PAGINA(css), 'utf8');

  const win = new BrowserWindow({ width: 620, height: 520, show: false });
  await win.loadFile(pagina);
  await new Promise((pronto) => setTimeout(pronto, 600));

  const medida = await win.webContents.executeJavaScript(`
    (() => {
      const img = document.querySelector('.bloco__imagem');
      const alca = document.querySelector('#figura .bloco__alca');
      // o ponto vem da propria alca: a pagina de fumaca nao tem a barra de
      // titulo do app, e coordenada chutada mede o lugar errado
      const caixa = alca.getBoundingClientRect();
      const noAlto = document.elementFromPoint(caixa.left + caixa.width / 2, caixa.top + caixa.height / 2);
      return {
        carregou: img.complete && img.naturalWidth > 0,
        largura: Math.round(img.getBoundingClientRect().width),
        altura: Math.round(img.getBoundingClientRect().height),
        alcaAlcancavel: noAlto === alca,
      };
    })()
  `);

  console.log('imagem carregou pelo protocolo:', medida.carregou ? 'ok' : 'RUIM');
  console.log('imagem cabe no bloco (480x270):', medida.largura, 'x', medida.altura);
  console.log('alça de arrastar por cima da foto:', medida.alcaAlcancavel ? 'ok' : 'RUIM');

  const tiro = await win.webContents.capturePage();
  const destino = path.join(os.tmpdir(), 'ardosia-figura.png');
  await fs.writeFile(destino, tiro.toPNG());
  console.log('captura em:', destino);

  win.destroy();
  app.quit();
});
