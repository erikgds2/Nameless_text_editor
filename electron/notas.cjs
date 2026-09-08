// Acesso ao disco. O renderer nunca manda um caminho: manda o id da nota, que e
// o nome do arquivo sem a extensao. Todo caminho nasce aqui dentro, a partir da
// pasta escolhida — e uma nota so pode existir dentro dela.
const { app, dialog, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const ARQUIVO_CONFIG = () => path.join(app.getPath('userData'), 'config.json');
const PROIBIDOS = /[<>:"|?*\u0000-\u001f]/;

let pastaEmMemoria = null;

async function pastaPadrao() {
  return path.join(app.getPath('documents'), 'Ardósia');
}

async function lerConfig() {
  try {
    return JSON.parse(await fs.readFile(ARQUIVO_CONFIG(), 'utf8'));
  } catch {
    return {};
  }
}

async function gravarConfig(config) {
  await fs.writeFile(ARQUIVO_CONFIG(), JSON.stringify(config, null, 2), 'utf8');
}

/** A pasta das notas, ja criada em disco. */
async function pasta() {
  if (!pastaEmMemoria) {
    const config = await lerConfig();
    pastaEmMemoria = config.pasta || (await pastaPadrao());
  }
  await fs.mkdir(pastaEmMemoria, { recursive: true });
  return pastaEmMemoria;
}

async function escolherPasta(janela) {
  const escolha = await dialog.showOpenDialog(janela, {
    title: 'Onde guardar suas notas',
    defaultPath: await pasta(),
    properties: ['openDirectory', 'createDirectory'],
  });
  if (escolha.canceled || escolha.filePaths.length === 0) return null;
  pastaEmMemoria = escolha.filePaths[0];
  await gravarConfig({ ...(await lerConfig()), pasta: pastaEmMemoria });
  return pastaEmMemoria;
}

/**
 * Traduz um id em caminho, ou falha. Duas defesas somadas: o id tem de ser um
 * nome de arquivo puro — sem separador nem caractere que o Windows recusa — e o
 * caminho final tem de cair dentro da pasta, o que barra o que passar da primeira.
 */
function caminhoDe(base, id) {
  if (typeof id !== 'string' || id.length === 0 || id.length > 120) {
    throw new Error('id de nota invalido');
  }
  if (path.win32.basename(id) !== id || PROIBIDOS.test(id) || id === '.' || id === '..') {
    throw new Error('id de nota invalido');
  }
  const destino = path.resolve(base, `${id}.md`);
  if (!destino.startsWith(path.resolve(base) + path.sep)) {
    throw new Error('id de nota invalido');
  }
  return destino;
}

async function listar() {
  const base = await pasta();
  const arquivos = (await fs.readdir(base, { withFileTypes: true }))
    .filter((entrada) => entrada.isFile() && entrada.name.toLowerCase().endsWith('.md'));

  const notas = [];
  for (const arquivo of arquivos) {
    const completo = path.join(base, arquivo.name);
    try {
      const [texto, info] = await Promise.all([fs.readFile(completo, 'utf8'), fs.stat(completo)]);
      notas.push({ id: arquivo.name.slice(0, -3), texto, atualizadoEm: info.mtimeMs });
    } catch (err) {
      // uma nota ilegivel nao pode derrubar a lista inteira
      console.error(`Não foi possível ler ${arquivo.name}:`, err);
    }
  }
  return notas;
}

/** Grava pelo temporario e so entao troca: uma queda no meio nao trunca a nota. */
async function escrever(id, texto) {
  const base = await pasta();
  const destino = caminhoDe(base, id);
  const temporario = `${destino}.escrevendo`;
  await fs.writeFile(temporario, texto, 'utf8');
  await fs.rename(temporario, destino);
}

/** Renomeia so quando o novo nome esta livre; se estiver ocupado, mantem o atual. */
async function renomear(de, para) {
  if (de === para) return de;
  const base = await pasta();
  const origem = caminhoDe(base, de);
  const destino = caminhoDe(base, para);
  try {
    await fs.access(destino);
    return de;
  } catch {
    await fs.rename(origem, destino);
    return para;
  }
}

async function apagar(id) {
  const base = await pasta();
  await fs.rm(caminhoDe(base, id), { force: true });
}

async function abrirPasta() {
  await shell.openPath(await pasta());
}

module.exports = { pasta, escolherPasta, listar, escrever, renomear, apagar, abrirPasta, caminhoDe };
