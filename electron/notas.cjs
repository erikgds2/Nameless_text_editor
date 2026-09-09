// Acesso ao disco. O renderer nunca manda um caminho: manda o id da nota, que e
// o nome do arquivo sem a extensao. Todo caminho nasce aqui dentro, a partir da
// pasta escolhida — e uma nota so pode existir dentro dela.
const { app, dialog, shell } = require('electron');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');

// A extensao do arquivo E o tipo da nota (item 116): `.md` e Markdown, `.txt` e
// texto puro. A ordem importa — a primeira e a padrao de quem nao disse nada.
const EXTENSOES_DE_NOTA = ['.md', '.txt'];
const EXTENSAO_PADRAO = EXTENSOES_DE_NOTA[0];

/** A extensao de nota que este nome de arquivo tem, ou null se nao for nota. */
function extensaoDoNome(nome) {
  const baixo = nome.toLowerCase();
  return EXTENSOES_DE_NOTA.find((extensao) => baixo.endsWith(extensao)) ?? null;
}

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

/**
 * Acrilico e o vidro FOSCO do Windows: borra o que esta atras e nunca fica
 * translucido de verdade. Vidro e transparencia real, como o Terminal com
 * opacidade baixa. Sao mutuamente exclusivos e so podem ser escolhidos na
 * criacao da janela, por isso ficam na config em disco e nao so no navegador.
 */
async function modoDeFundo() {
  const config = await lerConfig();
  return config.fundo === 'vidro' ? 'vidro' : 'acrilico';
}

async function gravarModoDeFundo(modo) {
  await gravarConfig({ ...(await lerConfig()), fundo: modo === 'vidro' ? 'vidro' : 'acrilico' });
}

/** A geometria da janela entre sessoes. Preferencia, e nao conteudo: vai na config. */
async function lerJanela() {
  return (await lerConfig()).janela ?? null;
}

async function gravarJanela(bounds) {
  await gravarConfig({ ...(await lerConfig()), janela: bounds });
}

/** Abre o Explorer com o arquivo da nota selecionado. */
async function mostrarNaPasta(id) {
  const base = await pasta();
  shell.showItemInFolder(caminhoDe(base, id, await extensaoAtual(base, id)));
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
function caminhoDe(base, id, extensao = EXTENSAO_PADRAO) {
  if (typeof id !== 'string' || id.length === 0 || id.length > 120) {
    throw new Error('id de nota invalido');
  }
  if (path.win32.basename(id) !== id || PROIBIDOS.test(id) || id === '.' || id === '..') {
    throw new Error('id de nota invalido');
  }
  if (!EXTENSOES_DE_NOTA.includes(extensao)) throw new Error('extensao de nota invalida');
  const destino = path.resolve(base, `${id}${extensao}`);
  if (!destino.startsWith(path.resolve(base) + path.sep)) {
    throw new Error('id de nota invalido');
  }
  return destino;
}

/** A extensao do arquivo que existe hoje para este id, ou a padrao. */
async function extensaoAtual(base, id) {
  for (const extensao of EXTENSOES_DE_NOTA) {
    try {
      await fs.access(path.resolve(base, `${id}${extensao}`));
      return extensao;
    } catch {
      // segue para a proxima
    }
  }
  return EXTENSAO_PADRAO;
}

async function listar() {
  const base = await pasta();
  const arquivos = (await fs.readdir(base, { withFileTypes: true })).filter(
    (entrada) => entrada.isFile() && extensaoDoNome(entrada.name) !== null,
  );

  const notas = [];
  const porId = new Map();
  for (const arquivo of arquivos) {
    const completo = path.join(base, arquivo.name);
    try {
      const [texto, info] = await Promise.all([fs.readFile(completo, 'utf8'), fs.stat(completo)]);
      const extensao = extensaoDoNome(arquivo.name);
      const id = arquivo.name.slice(0, -extensao.length);

      // `aula.md` e `aula.txt` na mesma pasta sao dois arquivos com o mesmo id.
      // O app trata a extensao como o TIPO da nota, entao os dois nao podem
      // coexistir na lista: fica o mais recente, que e o que alguem editou por
      // ultimo, e o outro e ignorado com o motivo dito em voz alta.
      const anterior = porId.get(id);
      if (anterior && anterior.atualizadoEm >= info.mtimeMs) {
        console.error(`Duas notas com o id ${id}: ${arquivo.name} foi ignorada, e a mais recente ficou.`);
        continue;
      }
      if (anterior) {
        console.error(`Duas notas com o id ${id}: a mais antiga foi ignorada, e ${arquivo.name} ficou.`);
        notas.splice(notas.indexOf(anterior), 1);
      }

      const nota = { id, texto, atualizadoEm: info.mtimeMs, extensao };
      porId.set(id, nota);
      notas.push(nota);
    } catch (err) {
      // uma nota ilegivel nao pode derrubar a lista inteira
      console.error(`Não foi possível ler ${arquivo.name}:`, err);
    }
  }
  return notas;
}

/**
 * Grava pelo temporario e so entao troca: uma queda no meio nao trunca a nota.
 *
 * A extensao vem de fora porque ela E o tipo da nota. Trocar de Markdown para
 * texto puro grava com o nome novo e apaga o antigo — o arquivo mudou de nome,
 * como no "Salvar como" de qualquer editor, e nao virou dois.
 */
async function escrever(id, texto, extensao = EXTENSAO_PADRAO) {
  const base = await pasta();
  const destino = caminhoDe(base, id, extensao);
  const temporario = `${destino}.escrevendo`;
  digitaisGravadas.set(id, digital(texto));
  await fs.writeFile(temporario, texto, 'utf8');
  await fs.rename(temporario, destino);

  for (const outra of EXTENSOES_DE_NOTA) {
    if (outra !== extensao) await fs.rm(caminhoDe(base, id, outra), { force: true });
  }
}

/**
 * Renomeia so quando o novo nome esta livre; se estiver ocupado, mantem o atual.
 * O tipo nao muda no caminho: o arquivo troca de nome, e nao de extensao.
 */
async function renomear(de, para) {
  if (de === para) return de;
  const base = await pasta();
  const extensao = await extensaoAtual(base, de);
  const origem = caminhoDe(base, de, extensao);
  const destino = caminhoDe(base, para, extensao);
  try {
    await fs.access(destino);
    return de;
  } catch {
    await fs.rename(origem, destino);
    return para;
  }
}

/** Apaga a nota, seja qual for a extensao com que ela esteja no disco. */
async function apagar(id) {
  const base = await pasta();
  for (const extensao of EXTENSOES_DE_NOTA) {
    await fs.rm(caminhoDe(base, id, extensao), { force: true });
  }
}

async function abrirPasta() {
  await shell.openPath(await pasta());
}

// ---------------------------------------------------------------------------
// Anexos: imagens coladas da area de transferencia. Ficam numa subpasta ao lado
// das notas, como faz o Obsidian, para a pasta continuar sendo so arquivos.

const EXTENSOES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };

/** O nome vem do conteudo: colar a mesma imagem duas vezes nao gera dois arquivos. */
async function salvarAnexo(bytes, tipo, nomePedido) {
  const conteudo = Buffer.from(bytes);
  const extensao = EXTENSOES[tipo];

  // Imagem se chama pelo conteudo: colar o mesmo print duas vezes nao gera dois
  // arquivos. Um anexo qualquer conserva o nome que tinha — e chega aqui ja
  // limpo de acento e espaco — porque e por ele que a pessoa vai reconhece-lo
  // na seção e na pasta. Nome ocupado ganha sufixo, e nada e sobrescrito.
  if (!extensao && !nomePedido) throw new Error(`tipo de anexo nao suportado: ${tipo}`);
  const base = await pasta();

  const nome = extensao
    ? `${crypto.createHash('sha1').update(conteudo).digest('hex').slice(0, 12)}.${extensao}`
    : await nomeLivreDeAnexo(base, nomePedido);
  const destino = caminhoDoAnexo(base, nome);

  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.writeFile(destino, conteudo);
  return nome;
}

/** `prova.pdf`, `prova-2.pdf`, `prova-3.pdf`: nunca por cima do que ja existe. */
async function nomeLivreDeAnexo(base, nome) {
  const ponto = nome.lastIndexOf('.');
  const corpo = ponto > 0 ? nome.slice(0, ponto) : nome;
  const fim = ponto > 0 ? nome.slice(ponto) : '';

  for (let tentativa = 1; tentativa < 1000; tentativa++) {
    const candidato = tentativa === 1 ? nome : `${corpo}-${tentativa}${fim}`;
    try {
      await fs.access(caminhoDoAnexo(base, candidato));
    } catch {
      return candidato;
    }
  }
  throw new Error('nao ha nome livre para este anexo');
}

/** Abre o Explorer com o anexo selecionado. Mostrar, e nao executar. */
async function mostrarAnexo(src) {
  const base = await pasta();
  const nome = typeof src === 'string' ? src.replace(/^anexos\//, '') : '';
  shell.showItemInFolder(caminhoDoAnexo(base, nome));
}

/** Mesma defesa do caminho das notas, um andar abaixo. */
function caminhoDoAnexo(base, nome) {
  if (typeof nome !== 'string' || nome.length === 0 || nome.length > 120) {
    throw new Error('nome de anexo invalido');
  }
  if (path.win32.basename(nome) !== nome || PROIBIDOS.test(nome) || nome === '.' || nome === '..') {
    throw new Error('nome de anexo invalido');
  }
  const anexos = path.resolve(base, 'anexos');
  const destino = path.resolve(anexos, nome);
  if (!destino.startsWith(anexos + path.sep)) throw new Error('nome de anexo invalido');
  return destino;
}

/**
 * Traduz uma url ardosia://anexos/<nome> no arquivo, ou falha.
 *
 * Cuidado com uma sutileza: o construtor de URL ja resolve ".." sozinho, entao
 * o nome que chega aqui nunca sobe de pasta. Ainda assim so servimos extensao
 * de imagem — este protocolo existe para mostrar figura, e qualquer outra coisa
 * na pasta nao tem por que ser alcancavel pela janela.
 */
async function anexoDaUrl(url) {
  const { host, pathname } = new URL(url);
  if (host !== 'anexos') throw new Error('url de anexo invalida');

  const nome = decodeURIComponent(pathname.replace(/^\//, ''));
  const extensao = path.extname(nome).slice(1).toLowerCase();
  if (!Object.values(EXTENSOES).includes(extensao)) {
    throw new Error('url de anexo invalida');
  }
  return caminhoDoAnexo(await pasta(), nome);
}

// ---------------------------------------------------------------------------
// Vigia da pasta: editar a nota no Bloco de Notas com o app aberto tem de
// aparecer na tela. O que o proprio app gravou nao conta como mudanca externa —
// senao cada tecla digitada mandaria a nota recarregar.
//
// A distincao e feita pelo conteudo, nao pelo relogio: guardamos a digital do
// que gravamos e comparamos com o que esta em disco. Uma janela de tempo seria
// mais simples, mas deixaria o app cego para uma edicao externa que caisse logo
// depois de um salvamento nosso.

const AGRUPAMENTO = 300;

const digitaisGravadas = new Map();
let vigia = null;
let aviso = null;
const mudados = new Set();

function digital(texto) {
  return crypto.createHash('sha1').update(texto).digest('hex');
}

function pararDeVigiar() {
  if (vigia) vigia.close();
  if (aviso) clearTimeout(aviso);
  vigia = null;
  aviso = null;
  mudados.clear();
}

/** Verdadeiro se o arquivo em disco nao e o que este app gravou por ultimo. */
async function mudouPorFora(base, id) {
  try {
    const texto = await fs.readFile(caminhoDe(base, id, await extensaoAtual(base, id)), 'utf8');
    return digitaisGravadas.get(id) !== digital(texto);
  } catch {
    // sumiu ou ficou ilegivel: se conheciamos o arquivo, alguem mexeu nele
    const conheciamos = digitaisGravadas.delete(id);
    return conheciamos;
  }
}

async function vigiar(janela) {
  pararDeVigiar();
  const base = await pasta();

  vigia = fsSync.watch(base, { persistent: false }, (_evento, arquivo) => {
    if (typeof arquivo !== 'string') return;
    const extensao = extensaoDoNome(arquivo);
    if (!extensao) return;
    mudados.add(arquivo.slice(0, -extensao.length));

    // o sistema dispara varios eventos por salvamento; um aviso basta
    if (aviso) clearTimeout(aviso);
    aviso = setTimeout(async () => {
      aviso = null;
      const candidatos = [...mudados];
      mudados.clear();
      const externas = await Promise.all(candidatos.map((id) => mudouPorFora(base, id)));
      if (externas.some(Boolean) && !janela.isDestroyed()) {
        janela.webContents.send('ardosia:pasta-mudou');
      }
    }, AGRUPAMENTO);
  });

  janela.on('closed', pararDeVigiar);
}

module.exports = {
  pasta,
  lerJanela,
  gravarJanela,
  mostrarNaPasta,
  modoDeFundo,
  gravarModoDeFundo,
  salvarAnexo,
  mostrarAnexo,
  anexoDaUrl,
  escolherPasta,
  listar,
  escrever,
  renomear,
  apagar,
  abrirPasta,
  vigiar,
  caminhoDe,
};
