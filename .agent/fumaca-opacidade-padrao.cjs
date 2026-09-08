// Os três consertos, medidos na janela de verdade e no dist/ empacotado:
//
//   1. quem abre pela primeira vez vê uma janela sólida
//   2. quem vinha da v1 com o zero de fábrica também
//   3. perder o foco não deixa o app à mercê do cinza do Windows
//
//   npx electron .agent/fumaca-opacidade-padrao.cjs
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const MEDIR = `(() => {
  const raiz = document.documentElement;
  const corpo = getComputedStyle(document.body).backgroundColor;
  const alfa = corpo.startsWith('rgba') ? Number(corpo.split(',')[3]) : 1;
  return {
    opacidade: raiz.style.getPropertyValue('--opacidade').trim(),
    native: raiz.dataset.native ?? '(nao)',
    fundo: raiz.dataset.fundo ?? '(nao)',
    foco: raiz.dataset.foco ?? '(nao marcado)',
    corpo,
    solido: alfa === 1,
  };
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1000,
    height: 640,
    show: false,
    backgroundColor: '#00000000',
    backgroundMaterial: 'acrylic',
    titleBarStyle: 'hidden',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  const abrir = async () => {
    await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    await espera(1800);
  };

  await abrir();

  // 1. usuario novo: nada guardado
  await win.webContents.executeJavaScript('localStorage.clear()');
  await abrir();
  console.log('1) primeira abertura   ', JSON.stringify(await win.webContents.executeJavaScript(MEDIR)));

  // 2. usuario que ja tinha a v1 com o zero de fabrica
  await win.webContents.executeJavaScript(
    `localStorage.clear(); localStorage.setItem('ardosia:ajustes:v1', JSON.stringify({ tema: 'acrilico', acento: '#7fa06a', opacidade: 0, fundo: 'acrilico' }))`,
  );
  await abrir();
  const migrado = await win.webContents.executeJavaScript(MEDIR);
  const acento = await win.webContents.executeJavaScript(
    "document.documentElement.style.getPropertyValue('--acento').trim()",
  );
  console.log('2) vindo da v1 com zero', JSON.stringify(migrado), '| acento preservado:', acento);

  // 3. a mesma janela, agora com transparencia escolhida, perdendo o foco
  await win.webContents.executeJavaScript(
    `localStorage.setItem('ardosia:ajustes:v2', JSON.stringify({ tema: 'acrilico', opacidade: 20, fundo: 'acrilico' }))`,
  );
  await abrir();
  console.log('3) com foco, a 20%     ', JSON.stringify(await win.webContents.executeJavaScript(MEDIR)));

  await win.webContents.executeJavaScript("window.dispatchEvent(new Event('blur'))");
  await espera(300);
  console.log('4) sem foco, a 20%     ', JSON.stringify(await win.webContents.executeJavaScript(MEDIR)));

  await win.webContents.executeJavaScript("window.dispatchEvent(new Event('focus'))");
  await espera(300);
  console.log('5) foco de volta       ', JSON.stringify(await win.webContents.executeJavaScript(MEDIR)));

  app.quit();
});
