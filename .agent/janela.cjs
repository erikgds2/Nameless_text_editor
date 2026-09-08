// Abre a janela DE VERDADE do Ardósia — o main.cjs completo, com IPC, acrílico,
// protocolo de anexos e atalho global — e roda um pedaço de JavaScript dentro
// dela, devolvendo o resultado.
//
// Existe porque validar no navegador e usar no desktop são coisas diferentes:
// o navegador não tem pasta, nem acrílico, nem protocolo próprio, nem captura
// rápida. O que passa lá pode falhar aqui, e foi o que aconteceu mais de uma vez.
//
//   npx electron .agent/janela.cjs "document.querySelectorAll('.noteitem').length"
//   npx electron .agent/janela.cjs "..." --ficar      (deixa aberta para você ver)
//
// Com o vite rodando (npm run dev:web), reflete o código do momento; sem ele,
// carrega o que estiver em dist/.
require('../electron/main.cjs');
const { app, BrowserWindow } = require('electron');

const script = process.argv[2] ?? 'document.title';
const ficar = process.argv.includes('--ficar');
const espera = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.whenReady().then(async () => {
  // o main.cjs cria a janela no seu próprio whenReady; esperamos ela aparecer
  let janela = null;
  for (let tentativa = 0; tentativa < 40 && !janela; tentativa += 1) {
    await espera(250);
    janela = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) ?? null;
  }
  if (!janela) {
    console.error('a janela não abriu');
    app.quit();
    return;
  }

  await espera(2500);

  try {
    const resultado = await janela.webContents.executeJavaScript(
      `(async () => { ${script.includes('return') ? script : `return (${script})`} })()`,
    );
    console.log(typeof resultado === 'string' ? resultado : JSON.stringify(resultado, null, 2));
  } catch (erro) {
    console.error('erro dentro da janela:', erro.message);
  }

  if (ficar) {
    console.log('--ficar: a janela continua aberta; feche-a para encerrar');
    return;
  }
  app.quit();
});
