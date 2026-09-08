// O usuario relatou: "o fosco fica fosco 1x e depois fica totalmente escuro".
// A suspeita e que o acrilico do Windows 11 so e desenhado enquanto a janela
// esta ATIVA — perdeu o foco, o DWM troca por uma cor chapada. Este script
// prova ou desmente, sem depender do meu palpite:
//
//   1. abre uma janela laranja solida
//   2. poe por cima uma janela acrilica de corpo totalmente transparente
//   3. fotografa a tela com a acrilica em foco
//   4. tira o foco dela e fotografa de novo
//
// Se a segunda foto perder o laranja, a suspeita esta certa.
//
//   npx electron .agent/fumaca-foco.cjs
const { app, BrowserWindow } = require('electron');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');

const CAIXA = { x: 120, y: 120, width: 880, height: 520 };
const saida = (nome) => path.join(os.tmpdir(), nome);

const pagina = (css, texto) =>
  'data:text/html,' +
  encodeURIComponent(
    `<style>html,body{height:100%;margin:0;${css}}` +
      `p{font:600 22px "Segoe UI",sans-serif;color:#ded8ce;padding:28px;margin:0}</style>` +
      `<p>${texto}</p>`,
  );

function fotografar(arquivo) {
  const script = [
    'Add-Type -AssemblyName System.Drawing;',
    `$b = New-Object System.Drawing.Bitmap ${CAIXA.width}, ${CAIXA.height};`,
    '$g = [System.Drawing.Graphics]::FromImage($b);',
    `$g.CopyFromScreen(${CAIXA.x}, ${CAIXA.y}, 0, 0, $b.Size);`,
    `$b.Save('${arquivo.split(path.sep).join('/')}');`,
  ].join(' ');
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
  console.log('foto:', arquivo);
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const atras = new BrowserWindow({
    ...CAIXA,
    frame: false,
    show: true,
    title: 'atras',
  });
  await atras.loadURL(pagina('background:#e07a1f;', 'JANELA DE TRAS — laranja solido'));

  const vidraca = new BrowserWindow({
    ...CAIXA,
    backgroundColor: '#00000000',
    backgroundMaterial: 'acrylic',
    alwaysOnTop: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: '#C8C2B8', height: 40 },
    show: false,
  });
  await vidraca.loadURL(pagina('background:transparent;', 'ACRILICO — corpo 100% transparente'));
  vidraca.show();
  vidraca.focus();

  await espera(2500);
  fotografar(saida('ardosia-foco.png'));

  // tirar o foco sem tirar a janela da frente: a de tras nao sobe porque a
  // acrilica esta com alwaysOnTop
  atras.focus();
  await espera(2500);
  fotografar(saida('ardosia-sem-foco.png'));

  app.quit();
});
