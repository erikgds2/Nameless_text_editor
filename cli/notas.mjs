/**
 * As notas em disco, do lado da linha de comando.
 *
 * A pasta é a mesma do aplicativo, lida da mesma configuração: a CLI não tem
 * um caderno próprio, ela escreve no caderno que está aberto. Por isso a
 * gravação é atômica como a do app — o vigia da pasta reage a cada mudança, e
 * um arquivo lido pela metade apareceria na tela como nota truncada.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { blocoNoFim, escreverNota, lerNota, textoDaNota, tituloDaNota } from './formato.mjs';
import { nomeDisponivel, slugDeTitulo } from './nomes.mjs';

const PROIBIDOS = /[<>:"|?*\u0000-\u001f]/;
const EXTENSOES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };

export class ErroDaCli extends Error {}

/**
 * Onde o Electron guarda a configuração do app. É o mesmo caminho que
 * `app.getPath('userData')` devolve, montado à mão porque aqui não há Electron
 * — o nome da pasta vem do `productName` do package.json.
 */
function caminhoDaConfig() {
  const nome = 'Ardósia';
  if (process.platform === 'win32') {
    const base = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(base, nome, 'config.json');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', nome, 'config.json');
  }
  return path.join(os.homedir(), '.config', nome, 'config.json');
}

async function lerConfig() {
  try {
    return JSON.parse(await fs.readFile(caminhoDaConfig(), 'utf8'));
  } catch {
    return {};
  }
}

async function gravarConfig(config) {
  const destino = caminhoDaConfig();
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.writeFile(destino, JSON.stringify(config, null, 2), 'utf8');
}

/**
 * A pasta das notas, já criada. `ARDOSIA_PASTA` vem antes de tudo: é como um
 * agente trabalha numa pasta de teste sem mexer no caderno de verdade.
 */
export async function pastaDasNotas() {
  const escolhida =
    process.env.ARDOSIA_PASTA ||
    (await lerConfig()).pasta ||
    path.join(os.homedir(), 'Documents', 'Ardósia');
  await fs.mkdir(escolhida, { recursive: true });
  return escolhida;
}

export async function definirPasta(destino) {
  const absoluto = path.resolve(destino);
  await fs.mkdir(absoluto, { recursive: true });
  await gravarConfig({ ...(await lerConfig()), pasta: absoluto });
  return absoluto;
}

/** A mesma defesa do app: o id é nome de arquivo puro, e não sai da pasta. */
function caminhoDe(base, id) {
  if (typeof id !== 'string' || id.length === 0 || id.length > 120) {
    throw new ErroDaCli(`id de nota inválido: ${id}`);
  }
  if (path.win32.basename(id) !== id || PROIBIDOS.test(id) || id === '.' || id === '..') {
    throw new ErroDaCli(`id de nota inválido: ${id}`);
  }
  const destino = path.resolve(base, `${id}.md`);
  if (!destino.startsWith(path.resolve(base) + path.sep)) {
    throw new ErroDaCli(`id de nota inválido: ${id}`);
  }
  return destino;
}

export async function listar() {
  const base = await pastaDasNotas();
  const entradas = await fs.readdir(base, { withFileTypes: true });

  const notas = [];
  for (const entrada of entradas) {
    if (!entrada.isFile() || !entrada.name.toLowerCase().endsWith('.md')) continue;
    const completo = path.join(base, entrada.name);
    try {
      const [bruto, info] = await Promise.all([fs.readFile(completo, 'utf8'), fs.stat(completo)]);
      const nota = lerNota(bruto);
      notas.push({
        id: entrada.name.slice(0, -3),
        titulo: tituloDaNota(textoDaNota(nota.blocos)),
        tipo: nota.tipo,
        fixada: nota.fixada,
        atualizadaEm: new Date(nota.atualizada || info.mtimeMs).toISOString(),
        caminho: completo,
      });
    } catch {
      // uma nota ilegível não pode derrubar a listagem inteira
    }
  }
  return notas.sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm));
}

export async function ler(id) {
  const base = await pastaDasNotas();
  try {
    return lerNota(await fs.readFile(caminhoDe(base, id), 'utf8'));
  } catch (err) {
    if (err instanceof ErroDaCli) throw err;
    throw new ErroDaCli(`nota não encontrada: ${id}`);
  }
}

/** Grava pelo temporário e só então troca: o vigia nunca vê nota pela metade. */
export async function gravar(id, nota) {
  const base = await pastaDasNotas();
  const destino = caminhoDe(base, id);
  const temporario = `${destino}.escrevendo`;
  await fs.writeFile(temporario, escreverNota({ ...nota, atualizada: Date.now() }), 'utf8');
  await fs.rename(temporario, destino);
  return destino;
}

/**
 * Qual nota é "Aula de Kant"? O id exato vem primeiro; depois o título escrito
 * por extenso, sem diferença de caixa nem de acento. Dois candidatos param o
 * comando: escolher por conta própria seria escrever na nota errada.
 */
export async function resolver(termo) {
  const notas = await listar();
  const exato = notas.find((nota) => nota.id === termo);
  if (exato) return exato.id;

  const alvo = slugDeTitulo(termo);
  const candidatos = notas.filter(
    (nota) => nota.id === alvo || slugDeTitulo(nota.titulo) === alvo,
  );
  if (candidatos.length === 1) return candidatos[0].id;
  if (candidatos.length > 1) {
    throw new ErroDaCli(
      `"${termo}" casa com mais de uma nota: ${candidatos.map((n) => n.id).join(', ')}`,
    );
  }
  throw new ErroDaCli(`nota não encontrada: ${termo}`);
}

export async function criar(titulo, tipo = 'markdown') {
  const existentes = (await listar()).map((nota) => nota.id);
  const id = nomeDisponivel(slugDeTitulo(titulo), existentes);
  const agora = Date.now();

  await gravar(id, {
    tipo,
    criada: agora,
    atualizada: agora,
    fixada: false,
    ordem: undefined,
    blocos: [blocoNoFim([], titulo)],
  });
  return id;
}

/** Acrescenta um bloco ao fim da página. Devolve o id e o caminho no disco. */
export async function escrever(id, texto) {
  const nota = await ler(id);
  nota.blocos.push(blocoNoFim(nota.blocos, texto));
  return { id, caminho: await gravar(id, nota) };
}

export async function buscar(termo) {
  const alvo = normalizar(termo);
  if (alvo.trim() === '') return [];

  const achados = [];
  for (const nota of await listar()) {
    const texto = textoDaNota((await ler(nota.id)).blocos);
    const onde = normalizar(texto).indexOf(alvo);
    if (onde === -1) continue;
    achados.push({ id: nota.id, titulo: nota.titulo, trecho: trechoAoRedor(texto, onde, alvo.length) });
  }
  return achados;
}

/**
 * Guarda a imagem em `anexos/`, com o nome vindo do conteúdo — colar duas vezes
 * a mesma figura não gera dois arquivos —, e acrescenta o bloco que a mostra.
 */
export async function anexar(id, arquivo, origem = null) {
  const extensao = path.extname(arquivo).toLowerCase();
  if (!EXTENSOES[extensao]) throw new ErroDaCli(`tipo de imagem não suportado: ${extensao || arquivo}`);

  let conteudo;
  try {
    conteudo = await fs.readFile(arquivo);
  } catch {
    throw new ErroDaCli(`arquivo não encontrado: ${arquivo}`);
  }

  const base = await pastaDasNotas();
  const nome = `${crypto.createHash('sha1').update(conteudo).digest('hex').slice(0, 12)}${extensao === '.jpeg' ? '.jpg' : extensao}`;
  await fs.mkdir(path.join(base, 'anexos'), { recursive: true });
  await fs.writeFile(path.join(base, 'anexos', nome), conteudo);

  // a figura entra como propriedade da secao nova, e nao como texto: e o que a
  // faz aparecer tambem numa nota que nao e Markdown
  const nota = await ler(id);
  const bloco = blocoNoFim(nota.blocos, '');
  nota.blocos.push({ ...bloco, imagem: { src: `anexos/${nome}`, ...(origem ? { fonte: origem } : {}) } });
  return { nome, caminho: await gravar(id, nota) };
}

function normalizar(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function trechoAoRedor(texto, onde, tamanho) {
  const inicio = Math.max(0, onde - 30);
  const fim = Math.min(texto.length, onde + tamanho + 30);
  const corpo = texto.slice(inicio, fim).replace(/\s+/g, ' ').trim();
  return `${inicio > 0 ? '…' : ''}${corpo}${fim < texto.length ? '…' : ''}`;
}
