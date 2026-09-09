import { criarBloco, LARGURA_PADRAO, ALTURA_PADRAO, LARGURA_MINIMA, ALTURA_MINIMA } from './canvas';
import type { Bloco, Imagem } from './canvas';
import { figurasDoBloco, imagemDoBloco, textoSemFiguras } from './imagem';
import type { Note, TipoDoc } from './notes';

const MARCADOR = /<!--\s*ardosia:bloco([^>]*)-->/g;

export function serializar(nota: Note): string {
  const frontmatter = [
    '---',
    'ardosia: 1',
    `tipo: ${nota.tipo}`,
    `criada: ${new Date(nota.createdAt).toISOString()}`,
    `atualizada: ${new Date(nota.updatedAt).toISOString()}`,
    `fixada: ${nota.pinned}`,
    ...(nota.pinned && nota.ordem !== undefined ? [`ordem: ${nota.ordem}`] : []),
    '---',
  ].join('\n');

  const corpo = [...nota.blocos]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((bloco) => {
      const figura = bloco.imagem
        ? ` img=${bloco.imagem.src}` +
          (bloco.imagem.altura ? ` imgh=${bloco.imagem.altura}` : '') +
          (bloco.imagem.fonte ? ` fonte=${bloco.imagem.fonte}` : '')
        : '';
      const marcador = `<!-- ardosia:bloco x=${bloco.x} y=${bloco.y} w=${bloco.largura} h=${bloco.altura}${figura} -->`;
      return bloco.texto ? `${marcador}\n${bloco.texto}` : marcador;
    })
    .join('\n\n');

  return `${frontmatter}\n\n${corpo}\n`;
}

export function desserializar(texto: string, id: string): Note {
  const { createdAt, updatedAt, pinned, ordem, tipo, corpo } = extrairFrontmatter(normalizar(texto));
  const blocos = extrairBlocos(corpo);
  return {
    id,
    blocos: blocos.length > 0 ? blocos : [criarBloco(48, 48)],
    tipo,
    createdAt,
    updatedAt,
    pinned,
    ordem,
  };
}

/**
 * Editores do Windows devolvem o arquivo com CRLF, e alguns com BOM na frente.
 * Sem isto o frontmatter deixa de ser reconhecido e aparece como texto da nota.
 */
function normalizar(texto: string): string {
  return texto.replace(/^\ufeff/, '').replace(/\r\n/g, '\n');
}

type Frontmatter = {
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  ordem?: number;
  tipo: TipoDoc;
  corpo: string;
};

function extrairFrontmatter(texto: string): Frontmatter {
  const agora = Date.now();
  const match = texto.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    // um .md solto na pasta é Markdown até que se diga o contrário
    return { createdAt: agora, updatedAt: agora, pinned: false, tipo: 'markdown', corpo: texto };
  }

  const campos: Record<string, string> = {};
  for (const linha of match[1].split('\n')) {
    const i = linha.indexOf(':');
    if (i === -1) continue;
    campos[linha.slice(0, i).trim()] = linha.slice(i + 1).trim();
  }

  const criada = Date.parse(campos.criada ?? '');
  const atualizada = Date.parse(campos.atualizada ?? '');
  return {
    createdAt: Number.isFinite(criada) ? criada : agora,
    updatedAt: Number.isFinite(atualizada) ? atualizada : agora,
    pinned: campos.fixada === 'true',
    ordem: Number.isFinite(Number(campos.ordem)) && campos.ordem !== undefined ? Number(campos.ordem) : undefined,
    tipo: campos.tipo === 'texto' ? 'texto' : 'markdown',
    corpo: texto.slice(match[0].length),
  };
}

function extrairBlocos(corpo: string): Bloco[] {
  const marcas = [...corpo.matchAll(MARCADOR)];
  if (marcas.length === 0) {
    const texto = corpo.trim();
    return texto ? [blocoComTexto(48, 48, texto)] : [];
  }

  const blocos: Bloco[] = [];
  const preambulo = corpo.slice(0, marcas[0].index ?? 0).trim();
  if (preambulo) blocos.push(blocoComTexto(48, 48, preambulo));

  marcas.forEach((marca, i) => {
    const inicio = (marca.index ?? 0) + marca[0].length;
    const fim = i + 1 < marcas.length ? marcas[i + 1].index : corpo.length;
    const texto = corpo.slice(inicio, fim).trim();
    const atributos = parseAtributos(marca[1]);
    blocos.push(
      comFiguraMigrada({
        id: crypto.randomUUID(),
        x: geometriaPosicao(atributos.x),
        y: geometriaPosicao(atributos.y),
        largura: geometriaTamanho(atributos.w, LARGURA_PADRAO, LARGURA_MINIMA),
        altura: geometriaTamanho(atributos.h, ALTURA_PADRAO, ALTURA_MINIMA),
        texto,
        ...(imagemDoAtributo(atributos.img, atributos.fonte, atributos.imgh) ?? {}),
      }),
    );
  });

  return blocos;
}

function blocoComTexto(x: number, y: number, texto: string): Bloco {
  return comFiguraMigrada({ ...criarBloco(x, y), texto });
}

/** `img=anexos/abc.png` no marcador, validado como qualquer caminho de anexo. */
function imagemDoAtributo(src?: string, fonte?: string, imgh?: string): { imagem: Imagem } | null {
  const figura = src ? imagemDoBloco(`![](${src})`) : null;
  if (!figura) return null;

  const altura = Number(imgh);
  return {
    imagem: {
      src: figura.src,
      ...(fonte && ehFonteValida(fonte) ? { fonte } : {}),
      ...(Number.isFinite(altura) && altura > 0 ? { altura: Math.round(altura) } : {}),
    },
  };
}

function ehFonteValida(fonte: string): boolean {
  return imagemDoBloco(`[![](anexos/x.png)](${fonte})`) !== null;
}

/**
 * Nota escrita antes de a figura ser propriedade da seção: a imagem morava
 * numa linha de Markdown dentro do texto. Ao abrir, ela sobe para a seção — a
 * nota antiga continua abrindo, e a partir daí a foto não depende mais de o
 * arquivo ser `.md`. A linha some do texto para não haver duas verdades.
 */
function comFiguraMigrada(bloco: Bloco): Bloco {
  if (bloco.imagem) return bloco;

  const [primeira] = figurasDoBloco(bloco.texto);
  if (!primeira) return bloco;

  return {
    ...bloco,
    texto: textoSemFiguras(bloco.texto).trim(),
    imagem: { src: primeira.src, ...(primeira.fonte ? { fonte: primeira.fonte } : {}) },
  };
}

function parseAtributos(bruto: string): Record<string, string> {
  const atributos: Record<string, string> = {};
  for (const par of bruto.trim().split(/\s+/)) {
    const [chave, valor] = par.split('=');
    if (chave && valor !== undefined) atributos[chave] = valor;
  }
  return atributos;
}

function numeroOuPadrao(valor: string | undefined, padrao: number): number {
  const n = valor === undefined ? NaN : Number(valor);
  return Number.isFinite(n) ? n : padrao;
}

function geometriaPosicao(valor: string | undefined): number {
  return Math.max(0, numeroOuPadrao(valor, 0));
}

function geometriaTamanho(valor: string | undefined, padrao: number, minimo: number): number {
  return Math.max(minimo, numeroOuPadrao(valor, padrao));
}
