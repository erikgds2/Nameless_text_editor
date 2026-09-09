/**
 * O formato das notas, do lado da linha de comando.
 *
 * É o mesmo `.md` que o aplicativo grava: frontmatter com as datas e um
 * comentário `<!-- ardosia:bloco ... -->` antes de cada bloco, guardando onde
 * ele fica na página. Existe uma segunda implementação porque a do app é
 * TypeScript compilado para o navegador, e a CLI é Node puro — mas as duas não
 * podem divergir nunca: `formato.test.ts` compara uma com a outra, e é esse
 * teste que impede a nota escrita aqui de virar lixo lá.
 *
 * Escrever daqui não precisa saber desenhar a página: um bloco novo entra
 * abaixo do último, na mesma coluna. Quem quiser mover, move no app.
 */

const MARCADOR = /<!--\s*ardosia:bloco([^>]*)-->/g;

/** Os mesmos padrões de `src/canvas.ts`; um bloco novo nasce assim. */
export const LARGURA_PADRAO = 320;
export const ALTURA_PADRAO = 120;
export const LARGURA_MINIMA = 120;
export const ALTURA_MINIMA = 60;

/** Respiro entre um bloco e o que a CLI acrescenta abaixo dele. */
const ESPACO = 24;

/**
 * Editores do Windows devolvem o arquivo com CRLF, e alguns com BOM na frente.
 * Sem isto o frontmatter deixa de ser reconhecido e vira texto da nota.
 */
function normalizar(texto) {
  return texto.replace(/^\ufeff/, '').replace(/\r\n/g, '\n');
}

export function lerNota(bruto) {
  const texto = normalizar(bruto);
  const agora = Date.now();
  const match = texto.match(/^---\n([\s\S]*?)\n---\n?/);

  if (!match) {
    // um .md solto na pasta é Markdown até que se diga o contrário
    return {
      tipo: 'markdown',
      criada: agora,
      atualizada: agora,
      fixada: false,
      ordem: undefined,
      blocos: extrairBlocos(texto),
    };
  }

  const campos = {};
  for (const linha of match[1].split('\n')) {
    const i = linha.indexOf(':');
    if (i === -1) continue;
    campos[linha.slice(0, i).trim()] = linha.slice(i + 1).trim();
  }

  const criada = Date.parse(campos.criada ?? '');
  const atualizada = Date.parse(campos.atualizada ?? '');
  return {
    tipo: campos.tipo === 'texto' ? 'texto' : 'markdown',
    criada: Number.isFinite(criada) ? criada : agora,
    atualizada: Number.isFinite(atualizada) ? atualizada : agora,
    fixada: campos.fixada === 'true',
    ordem:
      campos.ordem !== undefined && Number.isFinite(Number(campos.ordem))
        ? Number(campos.ordem)
        : undefined,
    blocos: extrairBlocos(texto.slice(match[0].length)),
  };
}

export function escreverNota(nota) {
  const frontmatter = [
    '---',
    'ardosia: 1',
    `tipo: ${nota.tipo}`,
    `criada: ${new Date(nota.criada).toISOString()}`,
    `atualizada: ${new Date(nota.atualizada).toISOString()}`,
    `fixada: ${nota.fixada}`,
    ...(nota.fixada && nota.ordem !== undefined ? [`ordem: ${nota.ordem}`] : []),
    '---',
  ].join('\n');

  const corpo = emOrdemDeLeitura(nota.blocos)
    .map((bloco) => {
      const marcador = `<!-- ardosia:bloco x=${bloco.x} y=${bloco.y} w=${bloco.largura} h=${bloco.altura} -->`;
      return bloco.texto ? `${marcador}\n${bloco.texto}` : marcador;
    })
    .join('\n\n');

  return `${frontmatter}\n\n${corpo}\n`;
}

/** O texto da nota inteira, na ordem em que se lê a página. */
export function textoDaNota(blocos) {
  return emOrdemDeLeitura(blocos)
    .filter((bloco) => bloco.texto.trim().length > 0)
    .map((bloco) => bloco.texto)
    .join('\n');
}

/** O título é sempre a primeira linha com conteúdo — não há campo separado. */
export function tituloDaNota(texto) {
  const primeira = texto.split('\n').find((linha) => linha.trim().length > 0);
  if (!primeira) return 'Nota sem título';
  return semMarcacao(primeira).slice(0, 80) || 'Nota sem título';
}

/**
 * Um bloco novo, abaixo do mais baixo que já existe e alinhado com ele. É a
 * decisão que a CLI toma no lugar de quem não está vendo a página.
 */
export function blocoNoFim(blocos, texto) {
  const abaixo = blocos.reduce(
    (mais, bloco) => (bloco.y + bloco.altura > mais.y + mais.altura ? bloco : mais),
    blocos[0],
  );
  return {
    x: abaixo ? abaixo.x : 48,
    y: abaixo ? abaixo.y + abaixo.altura + ESPACO : 48,
    largura: abaixo ? abaixo.largura : LARGURA_PADRAO,
    altura: ALTURA_PADRAO,
    texto,
  };
}

function extrairBlocos(corpo) {
  const marcas = [...corpo.matchAll(MARCADOR)];
  if (marcas.length === 0) {
    const texto = corpo.trim();
    return texto ? [blocoComTexto(48, 48, texto)] : [];
  }

  const blocos = [];
  const preambulo = corpo.slice(0, marcas[0].index ?? 0).trim();
  if (preambulo) blocos.push(blocoComTexto(48, 48, preambulo));

  marcas.forEach((marca, i) => {
    const inicio = (marca.index ?? 0) + marca[0].length;
    const fim = i + 1 < marcas.length ? marcas[i + 1].index : corpo.length;
    const atributos = parseAtributos(marca[1]);
    blocos.push({
      x: posicao(atributos.x),
      y: posicao(atributos.y),
      largura: tamanho(atributos.w, LARGURA_PADRAO, LARGURA_MINIMA),
      altura: tamanho(atributos.h, ALTURA_PADRAO, ALTURA_MINIMA),
      texto: corpo.slice(inicio, fim).trim(),
    });
  });

  return blocos;
}

function blocoComTexto(x, y, texto) {
  return { x, y, largura: LARGURA_PADRAO, altura: ALTURA_PADRAO, texto };
}

function parseAtributos(bruto) {
  const atributos = {};
  for (const par of bruto.trim().split(/\s+/)) {
    const [chave, valor] = par.split('=');
    if (chave && valor !== undefined) atributos[chave] = valor;
  }
  return atributos;
}

function posicao(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.max(0, numero) : 48;
}

function tamanho(valor, padrao, minimo) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.max(minimo, numero) : padrao;
}

/** De cima para baixo; empatou na altura, da esquerda para a direita. */
function emOrdemDeLeitura(blocos) {
  return [...blocos].sort((a, b) => a.y - b.y || a.x - b.x);
}

// "# Revisão" é o título "Revisão": os sinais do Markdown são instrução de
// formato, não parte do nome da nota — e é deste nome que sai o do arquivo.
function semMarcacao(linha) {
  return linha
    .trim()
    .replace(/^#{1,6}\s+/, '')
    .replace(/^>\s+/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/[*`~]/g, '')
    .trim();
}
