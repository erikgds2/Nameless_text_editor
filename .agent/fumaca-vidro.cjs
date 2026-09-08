// O acrilico do Windows e vidro FOSCO: borra o que esta atras. O CMD com
// opacidade baixa usa transparencia REAL: deixa ver nitidamente. Este teste
// descobre se da para ter transparencia real sem perder os botoes da janela.
//
//   npx electron .agent/fumaca-vidro.cjs
const { app, BrowserWindow } = require('electron');

const PAGINA = (rotulo, fundo) =>
  'data:text/html,' +
  encodeURIComponent(`
    <style>
      html, body { height: 100%; margin: 0; background: ${fundo}; }
      p { font: 600 17px "Segoe UI", sans-serif; color: #ded8ce; padding: 56px 20px 0; margin: 0; }
      small { display:block; font-weight:400; color:#8e8880; padding: 8px 20px; }
    </style>
    <p>${rotulo}</p><small>${fundo}</small>
  `);

const VARIACOES = [
  {
    rotulo: 'ACRILICO (hoje)',
    fundo: 'transparent',
    opcoes: {
      backgroundColor: '#00000000',
      backgroundMaterial: 'acrylic',
      titleBarStyle: 'hidden',
      titleBarOverlay: { color: '#00000000', symbolColor: '#C8C2B8', height: 40 },
    },
  },
  {
    rotulo: 'VIDRO 60%',
    fundo: 'rgba(26, 23, 20, 0.6)',
    opcoes: {
      backgroundColor: '#00000000',
      transparent: true,
      titleBarStyle: 'hidden',
      titleBarOverlay: { color: '#00000000', symbolColor: '#C8C2B8', height: 40 },
    },
  },
  {
    rotulo: 'VIDRO 25%',
    fundo: 'rgba(26, 23, 20, 0.25)',
    opcoes: {
      backgroundColor: '#00000000',
      transparent: true,
      titleBarStyle: 'hidden',
      titleBarOverlay: { color: '#00000000', symbolColor: '#C8C2B8', height: 40 },
    },
  },
];

app.whenReady().then(async () => {
  VARIACOES.forEach((variacao, i) => {
    const win = new BrowserWindow({
      width: 360,
      height: 260,
      x: 100 + i * 380,
      y: 150,
      show: false,
      resizable: true,
      ...variacao.opcoes,
    });
    win.loadURL(PAGINA(variacao.rotulo, variacao.fundo));
    win.once('ready-to-show', () => win.show());
  });

  console.log('tres janelas abertas; capture agora');
  await new Promise((resolve) => setTimeout(resolve, 14000));
  app.quit();
});
