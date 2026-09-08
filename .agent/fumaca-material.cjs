// Abre janelas lado a lado com combinacoes diferentes de material, para
// descobrir qual delas o Windows 11 realmente deixa translucida.
//
//   npx electron .agent/fumaca-material.cjs
const { app, BrowserWindow } = require('electron');

const PAGINA = (rotulo) =>
  'data:text/html,' +
  encodeURIComponent(`
    <style>
      html, body { height: 100%; margin: 0; background: transparent; }
      p { font: 600 20px "Segoe UI", sans-serif; color: #ded8ce; padding: 24px; margin: 0; }
    </style>
    <p>${rotulo}</p>
  `);

const VARIACOES = [
  { rotulo: 'A: como esta hoje', opcoes: {
    backgroundColor: '#00000000', backgroundMaterial: 'acrylic',
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#00000000', symbolColor: '#C8C2B8', height: 40 },
  } },
  { rotulo: 'B: sem titleBarOverlay', opcoes: {
    backgroundColor: '#00000000', backgroundMaterial: 'acrylic', titleBarStyle: 'hidden',
  } },
  { rotulo: 'C: mica', opcoes: {
    backgroundColor: '#00000000', backgroundMaterial: 'mica', titleBarStyle: 'hidden',
  } },
  { rotulo: 'D: transparent true', opcoes: {
    backgroundColor: '#00000000', transparent: true, frame: false,
  } },
];

app.whenReady().then(async () => {
  const janelas = VARIACOES.map((variacao, i) => {
    const win = new BrowserWindow({
      width: 380,
      height: 300,
      x: 60 + i * 400,
      y: 120,
      show: false,
      ...variacao.opcoes,
    });
    win.loadURL(PAGINA(variacao.rotulo));
    win.once('ready-to-show', () => win.show());
    return { win, rotulo: variacao.rotulo };
  });

  await new Promise((resolve) => setTimeout(resolve, 3000));
  for (const { win, rotulo } of janelas) {
    console.log(`${rotulo} -> getBackgroundColor(): ${win.getBackgroundColor()}`);
  }
  console.log('janelas abertas; capture a tela agora');

  await new Promise((resolve) => setTimeout(resolve, 12000));
  app.quit();
});
