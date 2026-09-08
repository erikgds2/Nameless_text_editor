const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const notas = require('./notas.cjs');

const isDev = !app.isPackaged;

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
    titleBarOverlay: { color: '#00000000', symbolColor: '#C8C2B8', height: 38 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
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
}

app.whenReady().then(() => {
  registrarCanais();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
