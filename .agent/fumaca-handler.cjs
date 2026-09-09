// Compara as duas formas de responder no protocol.handle, com a pagina
// carregada de DENTRO do app.asar instalado — que e como o app de verdade
// roda, e a unica variavel que ainda nao tinha sido testada.
//
//   npx electron .agent/fumaca-handler.cjs
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, protocol, net } = require('electron');

const ANEXO = path.join(os.homedir(), 'Documents', 'Ardósia', 'anexos', 'ce6f5be94668.png');
const PAGINA_DO_ASAR = 'C:/Program Files/ardosia/resources/app.asar/dist/index.html';

protocol.registerSchemesAsPrivileged([
  { scheme: 'ardosia', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** Devolve a resposta do net.fetch como ela veio — a forma da versao 0.4.5. */
async function direto() {
  return net.fetch(pathToFileURL(ANEXO).toString());
}

/** Reembrulha a resposta para poder mexer nos cabecalhos — a forma da 0.4.6. */
async function reembrulhado() {
  const resposta = await net.fetch(pathToFileURL(ANEXO).toString());
  const cabecalhos = new Headers(resposta.headers);
  cabecalhos.set('Cache-Control', 'no-store');
  return new Response(resposta.body, { status: resposta.status, headers: cabecalhos });
}

/** Le os bytes e responde com eles: nada de repassar o corpo de outra resposta. */
async function comBytes() {
  const dados = await fs.promises.readFile(ANEXO);
  return new Response(dados, {
    status: 200,
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
  });
}

const FORMAS = { direto, reembrulhado, comBytes };

app.whenReady().then(async () => {
  let forma = 'direto';
  protocol.handle('ardosia', async () => {
    try {
      return await FORMAS[forma]();
    } catch (err) {
      console.log('   handler lancou:', err.message);
      return new Response('erro', { status: 404 });
    }
  });

  const win = new BrowserWindow({ width: 500, height: 400, show: false });
  await win.loadFile(PAGINA_DO_ASAR);
  await esperar(1500);

  for (const nome of Object.keys(FORMAS)) {
    forma = nome;
    const resultado = await win.webContents.executeJavaScript(`
      new Promise((pronto) => {
        const img = new Image();
        img.onload = () => pronto('CARREGOU ' + img.naturalWidth + 'x' + img.naturalHeight);
        img.onerror = () => pronto('QUEBRADA');
        img.src = 'ardosia://anexos/x.png?forma=${nome}&t=' + Date.now();
      })
    `);
    console.log(`${nome.padEnd(14)} ${resultado}`);
  }

  win.destroy();
  app.quit();
});
