const { app, BrowserWindow } = require('electron');
const path = require('node:path');

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 760,
    minHeight: 480,
    backgroundColor: '#F7F4ED',
    show: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#F1EDE3', symbolColor: '#6B645C', height: 38 },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
