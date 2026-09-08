// A primeira gravacao de uma nota com titulo: o arquivo provisorio ainda nao
// existe. Renomear antes de escrever, como o app fazia, e erro no disco de
// verdade — este script prova em qual ordem funciona.
//
//   npx electron .agent/fumaca-primeira-nota.cjs
const { app } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const notas = require('../electron/notas.cjs');

app.whenReady().then(async () => {
  const base = await notas.pasta();
  const provisorio = 'nota-teste-ordem';
  const comTitulo = 'teste-de-ordem';

  await fs.rm(path.join(base, `${provisorio}.md`), { force: true });
  await fs.rm(path.join(base, `${comTitulo}.md`), { force: true });

  console.log('--- ordem antiga: renomear e depois escrever ---');
  try {
    await notas.renomear(provisorio, comTitulo);
    console.log('renomeou um arquivo inexistente: NAO deveria');
  } catch (err) {
    console.log('recusou renomear o que nao existe:', err.code ?? err.message);
  }

  console.log('--- ordem nova: escrever e depois renomear ---');
  await notas.escrever(provisorio, '# Teste de ordem\n');
  const id = await notas.renomear(provisorio, comTitulo);
  const existe = await fs
    .stat(path.join(base, `${id}.md`))
    .then(() => true)
    .catch(() => false);
  console.log('id final:', id, '| arquivo no disco:', existe ? 'sim' : 'NAO');

  await fs.rm(path.join(base, `${id}.md`), { force: true });
  app.quit();
});
