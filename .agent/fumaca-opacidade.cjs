// Abre o app e força a opacidade em 0% para ver se o acrílico do sistema
// realmente aparece através da interface inteira, e não só do body.
//
//   npx electron .agent/fumaca-opacidade.cjs     (com o vite rodando)
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const notas = require('../electron/notas.cjs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1100,
    height: 700,
    x: 80,
    y: 80,
    backgroundColor: '#00000000',
    transparent: true,
    show: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: '#C8C2B8', height: 40 },
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const { ipcMain } = require('electron');
  ipcMain.handle('ardosia:pasta', () => notas.pasta());
  ipcMain.handle('ardosia:listar', () => notas.listar());
  ipcMain.handle('ardosia:escrever', (_e, id, texto) => notas.escrever(id, texto));
  ipcMain.handle('ardosia:renomear', (_e, de, para) => notas.renomear(de, para));
  ipcMain.handle('ardosia:apagar', (_e, id) => notas.apagar(id));

  await win.loadURL('http://localhost:5173');
  win.show();
  await new Promise((r) => setTimeout(r, 2500));

  // 0% = o material do sistema deve passar inteiro
  await win.webContents.executeJavaScript(`
    localStorage.setItem('ardosia:ajustes:v1', JSON.stringify({
      tema: 'acrilico', tipoPadrao: 'markdown', preview: false, corpo: 15,
      acento: '#d8934a', opacidade: 45, fundo: 'vidro', divisoria: 50,
    }));
    location.reload();
  `);

  await new Promise((r) => setTimeout(r, 3000));
  const conferencia = await win.webContents.executeJavaScript(`
    (() => {
      const opacos = [];
      for (const el of document.querySelectorAll('body, #root, .app, .workspace, .sidebar, .editor, .canvas, .titlebar, .notelist')) {
        const cor = getComputedStyle(el).backgroundColor;
        const m = cor.match(/[\\d.]+/g) || [];
        const alfa = cor.includes('/') ? Number(cor.split('/')[1].replace(')', '')) : (m.length === 4 ? Number(m[3]) : 1);
        if (alfa > 0.5) opacos.push((el.className ? '.' + String(el.className).split(' ')[0] : el.tagName) + ' -> ' + cor);
      }
      return { opacidade: getComputedStyle(document.documentElement).getPropertyValue('--opacidade').trim(), opacos };
    })()
  `);
  console.log(JSON.stringify(conferencia, null, 2));
  console.log('janela com 0% aberta; capture agora');

  await new Promise((r) => setTimeout(r, 12000));
  app.quit();
});
