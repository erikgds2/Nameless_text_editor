// Tenta carregar os anexos REAIS do usuario pelo mesmo caminho que o app usa:
// protocol.handle('ardosia') -> notas.anexoDaUrl -> net.fetch(file://).
//
// Existe porque a imagem aparece na tela com o icone de quebrada, e ate agora
// eu vinha medindo o DESENHO em vez do CARREGAMENTO. So le a pasta; nao grava
// nada nela.
//
//   npx electron .agent/fumaca-protocolo.cjs
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const { app, BrowserWindow, protocol, net } = require('electron');
const { pathToFileURL } = require('node:url');

const notas = require('../electron/notas.cjs');

protocol.registerSchemesAsPrivileged([
  { scheme: 'ardosia', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

app.whenReady().then(async () => {
  let ultimoErro = null;

  // exatamente o handler do main.cjs
  protocol.handle('ardosia', async (requisicao) => {
    try {
      const caminho = await notas.anexoDaUrl(requisicao.url);
      return await net.fetch(pathToFileURL(caminho).toString());
    } catch (err) {
      ultimoErro = `${requisicao.url} -> ${err.message}`;
      return new Response('anexo nao encontrado', { status: 404 });
    }
  });

  const pasta = await notas.pasta();
  const dirAnexos = path.join(pasta, 'anexos');
  const arquivos = fs.existsSync(dirAnexos) ? fs.readdirSync(dirAnexos) : [];

  console.log('pasta de notas:', pasta);
  console.log('anexos encontrados:', arquivos.length ? arquivos.join(', ') : '(nenhum)');

  // o caminho que o protocolo resolve, antes de qualquer janela
  for (const nome of arquivos) {
    try {
      const resolvido = await notas.anexoDaUrl(`ardosia://anexos/${nome}`);
      console.log(`  resolve ${nome}: ${fs.existsSync(resolvido) ? 'existe' : 'NAO EXISTE'} -> ${resolvido}`);
    } catch (err) {
      console.log(`  resolve ${nome}: RECUSADO -> ${err.message}`);
    }
  }

  const pagina = path.join(os.tmpdir(), 'ardosia-protocolo.html');
  fs.writeFileSync(pagina, '<!doctype html><meta charset="utf-8"><body></body>', 'utf8');

  const win = new BrowserWindow({ width: 400, height: 300, show: false });
  await win.loadFile(pagina);

  for (const nome of arquivos) {
    const resultado = await win.webContents.executeJavaScript(`
      new Promise((pronto) => {
        const img = new Image();
        img.onload = () => pronto({ ok: true, w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => pronto({ ok: false });
        img.src = 'ardosia://anexos/${nome}';
      })
    `);
    console.log(
      `  <img> ${nome}: ${resultado.ok ? `CARREGOU ${resultado.w}x${resultado.h}` : 'QUEBRADA'}`,
    );
  }

  if (ultimoErro) console.log('ultimo erro do protocolo:', ultimoErro);

  win.destroy();
  app.quit();
});
