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
// aceita um anexo de verdade no argumento, para ver o caso que falhou
const ICONE = process.argv[2] || path.join(RAIZ, 'build', 'icone.png');

protocol.registerSchemesAsPrivileged([
  { scheme: 'ardosia', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

const PAGINA = (css) => `<!doctype html>
<html data-theme="carvao"><head><meta charset="utf-8"><style>${css}
  body { background: var(--base); }
  .canvas { height: 560px; }
</style></head>
<body>
  <div class="canvas">
    <!-- o caso que o usuario relatou: colou no quadrado que ja tinha texto -->
    <div class="bloco bloco--ativo" id="misto" style="left:40px;top:24px;width:360px;height:300px">
      <div class="bloco__alca"></div>
      <button class="bloco__excluir" style="opacity:1"></button>
      <div class="bloco__espelho">Anatomia do f&ecirc;mur<br>![](anexos/icone.png)</div>
      <textarea class="bloco__texto" style="bottom:180px">Anatomia do fêmur
![](anexos/icone.png)</textarea>
      <div class="bloco__figuras">
        <div class="bloco__figura">
          <img class="bloco__imagem" src="ardosia://anexos/icone.png" alt="">
        </div>
      </div>
      <div class="bloco__canto"></div>
    </div>

    <!-- bloco que e so a figura, do tamanho dela -->
    <div class="bloco" id="figura" style="left:440px;top:24px;width:253px;height:78px">
      <div class="bloco__alca"></div>
      <div class="bloco__figuras bloco__figuras--inteira">
        <div class="bloco__figura">
          <img class="bloco__imagem" src="ardosia://anexos/icone.png" alt="">
        </div>
      </div>
      <div class="bloco__canto"></div>
    </div>
  </div>
</body></html>`;

app.whenReady().then(async () => {
 try {
  protocol.handle('ardosia', async () => net.fetch(pathToFileURL(ICONE).toString()));

  const css = await fs.readFile(path.join(RAIZ, 'src', 'styles.css'), 'utf8');
  const pagina = path.join(os.tmpdir(), 'ardosia-fumaca-figura.html');
  await fs.writeFile(pagina, PAGINA(css), 'utf8');

  const win = new BrowserWindow({ width: 620, height: 520, show: false });
  await win.loadFile(pagina);
  await new Promise((pronto) => setTimeout(pronto, 600));

  const medida = await win.webContents.executeJavaScript(`
    (() => {
      const falta = ['#figura .bloco__imagem', '#figura .bloco__alca', '#misto .bloco__texto', '#misto .bloco__figuras']
        .filter((selector) => !document.querySelector(selector));
      if (falta.length) return { erro: 'nao achei na pagina: ' + falta.join(', ') };

      const img = document.querySelector('#figura .bloco__imagem');
      const alca = document.querySelector('#figura .bloco__alca');
      // o ponto vem da propria alca: a pagina de fumaca nao tem a barra de
      // titulo do app, e coordenada chutada mede o lugar errado
      const caixa = alca.getBoundingClientRect();
      const noAlto = document.elementFromPoint(caixa.left + caixa.width / 2, caixa.top + caixa.height / 2);
      const campo = document.querySelector('#misto .bloco__texto').getBoundingClientRect();
      const foto = document.querySelector('#misto .bloco__figuras').getBoundingClientRect();
      return {
        semSobreposicao: campo.bottom <= foto.top + 1,
        carregou: img.complete && img.naturalWidth > 0,
        largura: Math.round(img.getBoundingClientRect().width),
        altura: Math.round(img.getBoundingClientRect().height),
        alcaAlcancavel: noAlto === alca,
      };
    })()
  `);

  if (medida.erro) throw new Error(medida.erro);
  console.log('imagem carregou pelo protocolo:', medida.carregou ? 'ok' : 'RUIM');
  console.log('figura desenhada em:', medida.largura, 'x', medida.altura);
  console.log('alca de arrastar alcancavel por cima da foto:', medida.alcaAlcancavel ? 'ok' : 'RUIM');
  console.log('texto e figura sem se cobrir:', medida.semSobreposicao ? 'ok' : 'RUIM');

  const tiro = await win.webContents.capturePage();
  const destino = path.join(os.tmpdir(), 'ardosia-figura.png');
  await fs.writeFile(destino, tiro.toPNG());
  console.log('captura em:', destino);

  win.destroy();
 } catch (err) {
  // sem isto, um seletor que nao casa deixa a promessa pendurada e o Electron
  // fica vivo para sempre, sem dizer o que houve
  console.error('fumaca falhou:', err && err.message ? err.message : err);
 }
 app.quit();
});
