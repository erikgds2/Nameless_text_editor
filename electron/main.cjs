const { app, BrowserWindow, globalShortcut, ipcMain, net, protocol, screen, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const notas = require('./notas.cjs');
const { autoUpdater } = require('electron-updater');
const { boundsVisiveis, cortarLog, linhaDeErro } = require('./geometria.cjs');
const fs = require('node:fs');

const isDev = !app.isPackaged;

// ---------------------------------------------------------------------------
// Registro de erros em arquivo. Sem isto, diagnosticar o app instalado depende
// de abrir o console de quem esta usando — que ninguem vai abrir. O arquivo
// fica ao lado da config, nunca na pasta de notas: nao e conteudo.

function caminhoDoLog() {
  return path.join(app.getPath('userData'), 'erros.log');
}

function registrarErro(origem, mensagem) {
  try {
    const arquivo = caminhoDoLog();
    const anterior = fs.existsSync(arquivo) ? fs.readFileSync(arquivo, 'utf8') : '';
    const novo = anterior + linhaDeErro(new Date(), origem, mensagem) + '\n';
    fs.writeFileSync(arquivo, cortarLog(novo), 'utf8');
  } catch {
    // um erro ao registrar erro nao pode derrubar o app
  }
}

// O esquema precisa ser declarado antes do app ficar pronto para o Chromium
// tratar as imagens dos anexos como conteudo de origem normal.
protocol.registerSchemesAsPrivileged([
  { scheme: 'ardosia', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

/**
 * Os dois fundos possiveis, e eles nao convivem:
 *
 * - `acrilico` usa o material do Windows 11 — vidro FOSCO. Borra o que esta
 *   atras e nunca fica realmente translucido, por mais que se baixe a tinta.
 * - `vidro` usa uma janela transparente de verdade, como o Terminal com
 *   opacidade baixa: da para ler o que esta atras. Quem decide quanto e o CSS.
 *
 * A escolha so vale na criacao da janela, entao trocar de modo recria a janela.
 */
function createWindow(modo, bounds) {
  const vidro = modo === 'vidro';
  const win = new BrowserWindow({
    ...(bounds ?? { width: 1100, height: 720 }),
    minWidth: 760,
    minHeight: 480,
    title: 'Ardósia',
    icon: path.join(__dirname, '..', 'build', 'icone.ico'),
    backgroundColor: '#00000000',
    ...(vidro ? { transparent: true } : { backgroundMaterial: 'acrylic' }),
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

  // Lembrar onde a janela estava. So depois que ela para de se mexer: gravar a
  // cada pixel de um arraste escreveria no disco centenas de vezes por segundo.
  let aviso = null;
  const guardar = () => {
    if (aviso) clearTimeout(aviso);
    aviso = setTimeout(() => {
      if (win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return;
      notas.gravarJanela(win.getNormalBounds()).catch(() => {});
    }, 400);
  };
  win.on('resize', guardar);
  win.on('move', guardar);

  // Link externo — a origem de um print colado, um endereco na nota — abre no
  // navegador do sistema, e nunca numa janela deste app: janela nova do
  // Electron carregaria site de fora com o preload junto. So http e https
  // passam; o resto e recusado em silencio.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

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
  return win;
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

// ---------------------------------------------------------------------------
// Atualizacao. O app instalado pergunta ao GitHub se ha versao nova toda vez
// que abre, baixa em segundo plano e so troca quando voce mandar — reiniciar
// sozinho no meio de uma nota escrita seria pior que ficar desatualizado.

function avisarJanela(estado, extra = {}) {
  if (janelaPrincipal && !janelaPrincipal.isDestroyed()) {
    janelaPrincipal.webContents.send('ardosia:atualizacao', { estado, ...extra });
  }
}

function vigiarAtualizacoes() {
  // em desenvolvimento nao ha versao publicada com que comparar
  if (isDev) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => avisarJanela('baixando', { versao: info.version }));
  autoUpdater.on('update-not-available', () => avisarJanela('atual'));
  autoUpdater.on('update-downloaded', (info) => avisarJanela('pronta', { versao: info.version }));
  autoUpdater.on('error', (erro) => {
    // ficar sem internet nao e motivo para incomodar ninguem
    console.error('Não foi possível verificar atualizações:', erro?.message ?? erro);
    avisarJanela('falhou');
  });

  autoUpdater.checkForUpdates().catch(() => avisarJanela('falhou'));
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
  ipcMain.handle('ardosia:modo-de-fundo', () => notas.modoDeFundo());
  ipcMain.handle('ardosia:versao', () => app.getVersion());
  ipcMain.handle('ardosia:mostrar-na-pasta', (_evento, id) => notas.mostrarNaPasta(id));
  ipcMain.handle('ardosia:registrar-erro', (_evento, mensagem) => registrarErro('janela', mensagem));
  ipcMain.handle('ardosia:instalar-atualizacao', () => autoUpdater.quitAndInstall());

  // Trocar o fundo exige uma janela nova: transparencia e material do sistema
  // sao decididos no nascimento dela. A posicao e o tamanho vao junto, para a
  // troca parecer uma mudanca de aparencia e nao um reinicio.
  ipcMain.handle('ardosia:trocar-modo-de-fundo', async (evento, modo) => {
    if ((await notas.modoDeFundo()) === modo) return;
    await notas.gravarModoDeFundo(modo);

    const antiga = BrowserWindow.fromWebContents(evento.sender);
    const bounds = antiga?.getBounds();
    createWindow(modo, bounds);
    antiga?.destroy();
  });

  // A captura grava pelo mesmo caminho das outras notas, entao o vigia da pasta
  // reconhece a escrita como nossa e nao avisa ninguem. O aviso vem daqui.
  ipcMain.handle('ardosia:fechar-captura', (_evento, gravou) => {
    janelaDeCaptura?.hide();
    if (gravou && janelaPrincipal && !janelaPrincipal.isDestroyed()) {
      janelaPrincipal.webContents.send('ardosia:pasta-mudou');
    }
  });
}

process.on('uncaughtException', (erro) => registrarErro('main', erro?.stack ?? erro));
process.on('unhandledRejection', (motivo) => registrarErro('main', motivo?.stack ?? motivo));

app.whenReady().then(async () => {
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
  const lembrada = boundsVisiveis(await notas.lerJanela(), screen.getAllDisplays());
  createWindow(await notas.modoDeFundo(), lembrada ?? undefined);

  vigiarAtualizacoes();

  if (!globalShortcut.register(ATALHO_DE_CAPTURA, abrirCaptura)) {
    console.error(`Outro programa já usa ${ATALHO_DE_CAPTURA}; a captura rápida ficou sem atalho.`);
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(await notas.modoDeFundo());
  });
});

app.on('will-quit', () => globalShortcut.unregisterAll());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
