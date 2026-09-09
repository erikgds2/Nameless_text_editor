// A janela do app, com as MESMAS opcoes do main.cjs, carregando o dist de
// verdade — e uma imagem `ardosia://` injetada nela. E o unico jeito de saber
// se o que falha e o protocolo, a pagina, ou o que o React poe no src.
//
//   npx electron .agent/fumaca-janela-real.cjs
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, protocol, net } = require('electron');

const RAIZ = path.resolve(__dirname, '..');
const notas = require('../electron/notas.cjs');

protocol.registerSchemesAsPrivileged([
  { scheme: 'ardosia', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

app.whenReady().then(async () => {
  let erroDoProtocolo = null;
  protocol.handle('ardosia', async (requisicao) => {
    try {
      return await net.fetch(pathToFileURL(await notas.anexoDaUrl(requisicao.url)).toString());
    } catch (err) {
      erroDoProtocolo = `${requisicao.url} -> ${err.message}`;
      return new Response('anexo nao encontrado', { status: 404 });
    }
  });

  const anexos = fs.readdirSync(path.join(await notas.pasta(), 'anexos'));
  const alvo = anexos[anexos.length - 1];

  // exatamente as webPreferences do main.cjs, nos dois modos de fundo
  for (const vidro of [false, true]) {
    const win = new BrowserWindow({
      width: 900,
      height: 600,
      backgroundColor: '#00000000',
      ...(vidro ? { transparent: true } : { backgroundMaterial: 'acrylic' }),
      show: false,
      titleBarStyle: 'hidden',
      webPreferences: {
        preload: path.join(RAIZ, 'electron', 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    await win.loadFile(path.join(RAIZ, 'dist', 'index.html'));
    await new Promise((pronto) => setTimeout(pronto, 800));

    const resultado = await win.webContents.executeJavaScript(`
      new Promise((pronto) => {
        const img = new Image();
        img.onload = () => pronto({ ok: true, w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => pronto({ ok: false });
        img.src = 'ardosia://anexos/${alvo}';
        document.body.appendChild(img);
      })
    `);

    console.log(
      `${vidro ? 'vidro     ' : 'acrilico  '} ${alvo}: ${
        resultado.ok ? `CARREGOU ${resultado.w}x${resultado.h}` : 'QUEBRADA'
      }`,
    );

    // e o que o app de verdade poe no src, lido da propria pagina
    const naPagina = await win.webContents.executeJavaScript(`
      [...document.querySelectorAll('img.bloco__imagem')].map((i) => ({
        src: i.getAttribute('src'),
        completo: i.complete,
        largura: i.naturalWidth,
      }))
    `);
    console.log('           imagens que o app desenhou:', JSON.stringify(naPagina));

    win.destroy();
  }

  if (erroDoProtocolo) console.log('erro do protocolo:', erroDoProtocolo);
  app.quit();
});
