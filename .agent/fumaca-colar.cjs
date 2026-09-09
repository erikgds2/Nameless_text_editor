// Persegue a imagem colada byte a byte, no caminho de verdade: renderer ->
// preload -> IPC -> disco -> protocolo ardosia:// -> <img> na tela.
//
// Existe porque a imagem chegou corrompida na 0.4.0, e o teste de componente
// nao alcanca esse trecho: no jsdom nao ha IPC, nao ha disco e nao ha decoder
// de PNG. So o Electron de verdade responde onde os bytes se perdem.
//
// Nao toca nas notas do usuario: userData e pasta de notas vao para o temp.
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const crypto = require('node:crypto');

const RAIZ = path.resolve(__dirname, '..');
const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ardosia-colar-'));
const PASTA = path.join(TEMP, 'notas');
fs.mkdirSync(PASTA, { recursive: true });

const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const { pathToFileURL } = require('node:url');

// antes de qualquer coisa: a config do app passa a morar no temp
app.setPath('userData', TEMP);
fs.writeFileSync(path.join(TEMP, 'config.json'), JSON.stringify({ pasta: PASTA }), 'utf8');

const notas = require('../electron/notas.cjs');

protocol.registerSchemesAsPrivileged([
  { scheme: 'ardosia', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

// Tres imagens, porque o tamanho e a suspeita: uma minuscula, o icone do
// proprio app e um print de verdade (1600x900). O arquivo grande so entra se
// existir — quem quiser testar com o print dele passa o caminho no argumento.
const MIUDA = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAHElEQVQI12P8z8DAwMDAxMDAwMDAwMTAwMDAAAAeAAlEZ6ThAAAAAElFTkSuQmCC',
  'base64',
);

const CASOS = [
  { nome: 'miuda 4x3', bytes: MIUDA, esperado: '4x3' },
  ...(fs.existsSync(path.join(RAIZ, 'build', 'icone.png'))
    ? [{ nome: 'icone do app', bytes: fs.readFileSync(path.join(RAIZ, 'build', 'icone.png')) }]
    : []),
  ...(process.argv[2] && fs.existsSync(process.argv[2])
    ? [{ nome: path.basename(process.argv[2]), bytes: fs.readFileSync(process.argv[2]) }]
    : []),
];

app.whenReady().then(async () => {
  protocol.handle('ardosia', async (requisicao) => {
    try {
      return await net.fetch(pathToFileURL(await notas.anexoDaUrl(requisicao.url)).toString());
    } catch (err) {
      return new Response(`anexo nao encontrado: ${err.message}`, { status: 404 });
    }
  });

  ipcMain.handle('ardosia:salvar-anexo', (_e, bytes, tipo) => notas.salvarAnexo(bytes, tipo));
  ipcMain.handle('ardosia:pasta', () => notas.pasta());

  const win = new BrowserWindow({
    width: 500,
    height: 400,
    show: false,
    webPreferences: {
      preload: path.join(RAIZ, 'electron', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const pagina = path.join(TEMP, 'colar.html');
  fs.writeFileSync(pagina, '<!doctype html><meta charset="utf-8"><body></body>', 'utf8');
  await win.loadFile(pagina);

  let tudoBem = true;
  for (const caso of CASOS) {
  // O renderer refaz o que a colagem faz: monta um File como o da area de
  // transferencia, le os bytes e manda pela ponte.
  const resultado = await win.webContents.executeJavaScript(`
    (async () => {
      const base64 = ${JSON.stringify(caso.bytes.toString('base64'))};
      const binario = atob(base64);
      const cru = new Uint8Array(binario.length);
      for (let i = 0; i < binario.length; i++) cru[i] = binario.charCodeAt(i);

      const arquivo = new File([cru], 'print.png', { type: 'image/png' });
      const bytes = new Uint8Array(await arquivo.arrayBuffer());

      const nome = await window.ardosia.salvarAnexo(bytes, arquivo.type);

      // e o mesmo caminho que o bloco de figura usa para desenhar
      const img = new Image();
      const carregou = await new Promise((pronto) => {
        img.onload = () => pronto(true);
        img.onerror = () => pronto(false);
        img.src = 'ardosia://anexos/' + nome;
      });

      return {
        nome,
        bytesEnviados: bytes.length,
        carregou,
        largura: img.naturalWidth,
        altura: img.naturalHeight,
      };
    })()
  `);

  const destino = path.join(PASTA, 'anexos', resultado.nome);
  const gravado = fs.readFileSync(destino);
  const identico =
    crypto.createHash('sha256').update(gravado).digest('hex') ===
    crypto.createHash('sha256').update(caso.bytes).digest('hex');
  const desenhou = resultado.carregou && resultado.largura > 0;
  if (!identico || !desenhou) tudoBem = false;

  console.log(`
--- ${caso.nome} ---`);
  console.log('bytes origem/enviados/disco:', caso.bytes.length, '/', resultado.bytesEnviados, '/', gravado.length);
  console.log('arquivo identico ao original:', identico ? 'ok' : 'RUIM');
  console.log('a janela desenhou:', desenhou ? `ok (${resultado.largura}x${resultado.altura})` : 'RUIM');
  }

  console.log(`
${tudoBem ? 'colagem integra em todos os casos' : 'ALGUM CASO FALHOU'}`);
  win.destroy();
  // o cache do Chromium ainda esta aberto: apagar o temp aqui da EPERM, e o
  // proprio Windows limpa a pasta depois
  app.quit();
});
