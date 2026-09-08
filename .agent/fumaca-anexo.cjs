// Prova que a imagem colada vira arquivo na subpasta certa e que a url
// ardosia:// nao alcanca nada fora dela.
//
//   npx electron .agent/fumaca-anexo.cjs
const { app } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const notas = require('../electron/notas.cjs');

// o menor PNG valido que existe: 1x1 transparente
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

app.whenReady().then(async () => {
  const base = await notas.pasta();

  const nome = await notas.salvarAnexo(PNG, 'image/png');
  const destino = path.join(base, 'anexos', nome);
  console.log('salvou:', nome);
  console.log('esta em anexos:', (await fs.stat(destino)).size, 'bytes');

  const denovo = await notas.salvarAnexo(PNG, 'image/png');
  console.log('mesma imagem, mesmo arquivo:', denovo === nome ? 'ok' : 'RUIM');

  try {
    await notas.salvarAnexo(PNG, 'application/x-msdownload');
    console.log('aceitou executavel como imagem: RUIM');
  } catch {
    console.log('recusou tipo que nao e imagem: ok');
  }

  console.log('url legitima resolve:', (await notas.anexoDaUrl(`ardosia://anexos/${nome}`)) === destino ? 'ok' : 'RUIM');

  // O construtor de URL ja resolve ".." antes de chegar na validacao, entao a
  // primeira nem chega a apontar para fora — mas nao e imagem, e isso basta.
  const hostis = [
    'ardosia://anexos/../../segredo.txt',
    'ardosia://anexos/..%2F..%2Fsegredo.txt',
    'ardosia://notas/kant.md',
    'ardosia://anexos/sub/foto.png',
    'ardosia://anexos/',
    'ardosia://anexos/config.json',
    'ardosia://anexos/kant.md',
    'ardosia://anexos/foto.png.exe',
  ];
  for (const url of hostis) {
    try {
      const caminho = await notas.anexoDaUrl(url);
      console.log('PASSOU (RUIM):', url, '->', caminho);
    } catch {
      console.log('bloqueado:', url);
    }
  }

  await fs.rm(destino, { force: true });
  app.quit();
});
