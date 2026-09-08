// Exercita a camada de disco de verdade, sem UI: escrever, ler, renomear, apagar.
const { app } = require('electron');
const notas = require('../electron/notas.cjs');

app.whenReady().then(async () => {
  const pasta = await notas.pasta();
  console.log('pasta:', pasta);

  const texto = [
    '---',
    'ardosia: 1',
    'criada: 2026-09-08T12:00:00.000Z',
    'atualizada: 2026-09-08T12:00:00.000Z',
    'fixada: false',
    '---',
    '',
    '<!-- ardosia:bloco x=48 y=48 w=320 h=120 -->',
    '# Fase 2 no disco',
    '',
    'Esta nota é um arquivo .md de verdade.',
    '',
  ].join('\n');

  await notas.escrever('nota-fumaca', texto);
  let lista = await notas.listar();
  console.log('depois de escrever:', lista.map((n) => n.id));
  console.log('conteudo bate:', lista.find((n) => n.id === 'nota-fumaca').texto === texto);

  const idFinal = await notas.renomear('nota-fumaca', 'fase-2-no-disco');
  console.log('renomeado para:', idFinal);

  await notas.escrever('fase-2-no-disco', texto.replace('Esta nota', 'Editada, esta nota'));
  lista = await notas.listar();
  console.log('conteudo atualizado:', lista.find((n) => n.id === 'fase-2-no-disco').texto.includes('Editada'));

  await notas.escrever('ocupado', 'outra');
  console.log('renomear para nome ocupado devolve o atual:', await notas.renomear('fase-2-no-disco', 'ocupado'));

  await notas.apagar('ocupado');
  console.log('sobrou:', (await notas.listar()).map((n) => n.id));

  try {
    await notas.escrever('../../fora-da-pasta', 'nao deveria existir');
    console.log('TRAVESSIA PASSOU — RUIM');
  } catch {
    console.log('travessia bloqueada no caminho real: ok');
  }

  app.quit();
});
