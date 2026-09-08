// Prova que o vigia da pasta avisa quando alguem edita um .md por fora, e que
// NAO avisa quando quem gravou foi o proprio app. Precisa do Electron de
// verdade: e fs.watch sobre a pasta real.
//
//   npx electron .agent/fumaca-vigia.cjs
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const notas = require('../electron/notas.cjs');

const espera = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.whenReady().then(async () => {
  const janela = new BrowserWindow({ show: false });
  let avisos = 0;

  // troca o canal de verdade por um contador
  janela.webContents.send = (canal) => {
    if (canal === 'ardosia:pasta-mudou') avisos += 1;
  };

  const base = await notas.pasta();
  await notas.vigiar(janela);
  console.log('vigiando:', base);

  // 1) alguem edita por fora
  await fs.writeFile(path.join(base, 'vinda-de-fora.md'), '# escrita por fora\n', 'utf8');
  await espera(900);
  console.log('editou por fora  -> avisos:', avisos, avisos === 1 ? '(ok)' : '(RUIM)');

  // 2) o proprio app grava: nao pode avisar
  const antes = avisos;
  await notas.escrever('vinda-de-fora', '# agora pelo app\n');
  await espera(900);
  console.log('gravou pelo app  -> avisos:', avisos, avisos === antes ? '(ok)' : '(RUIM)');

  // 3) varios salvamentos seguidos viram um aviso so
  const antesDoBurburinho = avisos;
  for (let i = 0; i < 5; i += 1) {
    await fs.writeFile(path.join(base, 'vinda-de-fora.md'), `# versao ${i}\n`, 'utf8');
    await espera(40);
  }
  await espera(900);
  console.log(
    'cinco salvamentos -> avisos:',
    avisos - antesDoBurburinho,
    avisos - antesDoBurburinho === 1 ? '(ok)' : '(RUIM)',
  );

  await fs.rm(path.join(base, 'vinda-de-fora.md'), { force: true });
  await espera(600);
  app.quit();
});
