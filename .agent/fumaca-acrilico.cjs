// Por que a janela nao parece translucida? Este script abre a janela de verdade
// e pergunta a ela o que esta pintando o fundo.
//
//   npx electron .agent/fumaca-acrilico.cjs     (com o vite ja rodando)
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    backgroundColor: '#00000000',
    backgroundMaterial: 'acrylic',
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

  await win.loadURL('http://localhost:5173');
  win.show();
  await new Promise((resolve) => setTimeout(resolve, 2500));

  const diagnostico = await win.webContents.executeJavaScript(`
    (() => {
      const raiz = document.documentElement;
      const estilo = (el) => getComputedStyle(el).backgroundColor;
      const opacos = [];
      for (const el of document.querySelectorAll('html, body, #root, .app, .workspace, .sidebar, .editor, .canvas, .editor__corpo')) {
        const cor = estilo(el);
        const alfa = cor.startsWith('rgba') ? Number(cor.split(',')[3]) : (cor === 'rgba(0, 0, 0, 0)' ? 0 : 1);
        if (alfa > 0.9) opacos.push(el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '') + ' -> ' + cor);
      }
      return {
        dataNative: raiz.dataset.native ?? null,
        dataTheme: raiz.dataset.theme ?? null,
        opacidade: getComputedStyle(raiz).getPropertyValue('--opacidade').trim() || '(nao definida)',
        fundoDoHtml: estilo(raiz),
        fundoDoBody: estilo(document.body),
        userAgentTemElectron: navigator.userAgent.includes('Electron'),
        elementosOpacosNoCaminho: opacos,
      };
    })()
  `);

  console.log(JSON.stringify(diagnostico, null, 2));
  console.log('backgroundColor da janela:', win.getBackgroundColor());
  app.quit();
});
