const { app, BrowserWindow, globalShortcut, ipcMain, net, protocol } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const notas = require('./notas.cjs');

const isDev = !app.isPackaged;

// O esquema precisa ser declarado antes do app ficar pronto para o Chromium
// tratar as imagens dos anexos como conteudo de origem normal.
protocol.registerSchemesAsPrivileged([
  { scheme: 'ardosia', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 760,
    minHeight: 480,
    title: 'Ardósia',
    icon: path.join(__dirname, '..', 'build', 'icone.ico'),
    // acrilico do Windows 11: o mesmo material do Windows Terminal.
    // exige fundo totalmente transparente para o material aparecer.
    backgroundColor: '#00000000',
    backgroundMaterial: 'acrylic',
    show: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: '#C8C2B8', height: 40 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  janelaPrincipal = win;

  // A janela de captura fica escondida, nao fechada. Sem isto ela seguraria o
  // app vivo depois que a janela principal fosse fechada.
  win.on('closed', () => {
    janelaPrincipal = null;
    janelaDeCaptura?.destroy();
    janelaDeCaptura = null;
  });

  win.once('ready-to-show', () => {
    win.show();
    notas.vigiar(win).catch((err) => console.error('Não foi possível vigiar a pasta:', err));
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

// ---------------------------------------------------------------------------
// Captura rapida: um atalho do sistema abre uma janelinha em qualquer lugar do
// Windows, voce escreve, e ela some. E o principio "capturar em dois segundos"
// do PROJETO.md — se custar mais que isso, a ideia se perde no caminho.

const ATALHO_DE_CAPTURA = 'CommandOrControl+Alt+N';
let janelaDeCaptura = null;
let janelaPrincipal = null;

function urlDo(modo) {
  const consulta = modo ? `?modo=${modo}` : '';
  return isDev
    ? `http://localhost:5173/${consulta}`
    : `file://${path.join(__dirname, '..', 'dist', 'index.html')}${consulta}`;
}

function abrirCaptura() {
  if (janelaDeCaptura) {
    janelaDeCaptura.show();
    janelaDeCaptura.focus();
    return;
  }

  janelaDeCaptura = new BrowserWindow({
    width: 620,
    height: 240,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    center: true,
    title: 'Captura rápida',
    backgroundColor: '#00000000',
    backgroundMaterial: 'acrylic',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  janelaDeCaptura.loadURL(urlDo('captura'));
  janelaDeCaptura.once('ready-to-show', () => janelaDeCaptura.show());
  // clicar fora fecha: uma janela de captura que fica atras de tudo e um estorvo
  janelaDeCaptura.on('blur', () => janelaDeCaptura?.hide());
  janelaDeCaptura.on('closed', () => {
    janelaDeCaptura = null;
  });
}

function registrarCanais() {
  ipcMain.handle('ardosia:pasta', () => notas.pasta());
  ipcMain.handle('ardosia:escolher-pasta', async (evento) => {
    const janela = BrowserWindow.fromWebContents(evento.sender);
    const escolhida = await notas.escolherPasta(janela);
    // a pasta antiga deixa de interessar; o vigia acompanha a nova
    if (escolhida && janela) await notas.vigiar(janela);
    return escolhida;
  });
  ipcMain.handle('ardosia:abrir-pasta', () => notas.abrirPasta());
  ipcMain.handle('ardosia:listar', () => notas.listar());
  ipcMain.handle('ardosia:escrever', (_evento, id, texto) => notas.escrever(id, texto));
  ipcMain.handle('ardosia:renomear', (_evento, de, para) => notas.renomear(de, para));
  ipcMain.handle('ardosia:apagar', (_evento, id) => notas.apagar(id));
  ipcMain.handle('ardosia:salvar-anexo', (_evento, bytes, tipo) => notas.salvarAnexo(bytes, tipo));

  // A captura grava pelo mesmo caminho das outras notas, entao o vigia da pasta
  // reconhece a escrita como nossa e nao avisa ninguem. O aviso vem daqui.
  ipcMain.handle('ardosia:fechar-captura', (_evento, gravou) => {
    janelaDeCaptura?.hide();
    if (gravou && janelaPrincipal && !janelaPrincipal.isDestroyed()) {
      janelaPrincipal.webContents.send('ardosia:pasta-mudou');
    }
  });
}

app.whenReady().then(() => {
  // ardosia://anexos/<arquivo> serve as imagens coladas. E o unico caminho pelo
  // qual a janela le arquivo do disco, e ele so alcanca a subpasta de anexos.
  protocol.handle('ardosia', async (requisicao) => {
    try {
      return await net.fetch(pathToFileURL(await notas.anexoDaUrl(requisicao.url)).toString());
    } catch (err) {
      console.error('Anexo não encontrado:', err.message);
      return new Response('anexo não encontrado', { status: 404 });
    }
  });

  registrarCanais();
  createWindow();

  if (!globalShortcut.register(ATALHO_DE_CAPTURA, abrirCaptura)) {
    console.error(`Outro programa já usa ${ATALHO_DE_CAPTURA}; a captura rápida ficou sem atalho.`);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => globalShortcut.unregisterAll());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
