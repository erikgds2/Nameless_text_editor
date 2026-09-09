/**
 * Imagem colada como figura na página, e não como marcação no meio do texto.
 *
 * Quem cola um print numa nota de estudo quer vê-lo ali, do tamanho certo, e
 * poder arrastá-lo — é o que o OneNote faz. O bloco continua sendo o mesmo
 * bloco de sempre: o que muda é que, quando o texto dele é só a marcação de
 * uma imagem, o canvas desenha a figura no lugar do campo de escrita.
 *
 * O arquivo não muda de formato por causa disso. `![](anexos/x.png)` já era o
 * que ia para o `.md`, e a origem do print cabe na forma que o motor de
 * Markdown deste projeto já entende: `[![](anexos/x.png)](https://origem)`.
 * Aberta no Obsidian ou no Bloco de Notas, a nota continua fazendo sentido.
 */
import { ALTURA_MINIMA, LARGURA_MINIMA } from './canvas';

/** Um bloco de imagem não passa disto; maior que a tela não ajuda ninguém. */
export const LADO_MAXIMO = 480;

/**
 * Altura da faixa de figuras no rodapé de um bloco que também tem texto. É o
 * espaço que a colagem acrescenta ao bloco, para a foto caber sem empurrar o
 * que já estava escrito.
 */
export const ALTURA_DA_FIGURA = 180;

/** Fora do `anexos/` da própria pasta, só o que veio da web aberta. */
const RE_ANEXO = /^anexos\/[^/\\]+$/;
const RE_EXTERNA = /^https?:\/\/\S+$/i;

const SO_IMAGEM = /^!\[([^\]]*)\]\(([^()\s]+)\)$/;
const SO_LINK_IMAGEM = /^\[!\[([^\]]*)\]\(([^()\s]+)\)\]\(([^()\s]+)\)$/;

export type Figura = {
  src: string;
  /** De onde o print veio, quando a área de transferência soube dizer. */
  fonte: string | null;
};

/**
 * A figura de um bloco que é SÓ uma figura. Texto misturado devolve `null`, e
 * o bloco segue sendo um bloco de escrita — trocar a régua no meio da frase
 * seria pior do que não ter figura nenhuma.
 */
export function imagemDoBloco(texto: string): Figura | null {
  const limpo = texto.trim();

  const comFonte = limpo.match(SO_LINK_IMAGEM);
  if (comFonte && ehSrcAceita(comFonte[2]) && RE_EXTERNA.test(comFonte[3])) {
    return { src: comFonte[2], fonte: comFonte[3] };
  }

  const sozinha = limpo.match(SO_IMAGEM);
  if (sozinha && ehSrcAceita(sozinha[2])) {
    return { src: sozinha[2], fonte: null };
  }
  return null;
}

/**
 * As figuras de um bloco que também tem texto: cada linha que é só uma imagem.
 *
 * É o que permite colar um print DENTRO do quadrado onde já se estava
 * escrevendo, em vez de abrir outro ao lado. O texto continua no campo de
 * escrita, com a marcação à vista como todo o resto do Markdown deste editor,
 * e a figura aparece no rodapé do mesmo bloco.
 */
export function figurasDoBloco(texto: string): Figura[] {
  const figuras: Figura[] = [];
  for (const linha of texto.split('\n')) {
    const figura = imagemDoBloco(linha);
    if (figura) figuras.push(figura);
  }
  return figuras;
}

/** O que sobra do bloco depois de tirar as linhas que são só figura. */
export function textoSemFiguras(texto: string): string {
  return texto
    .split('\n')
    .filter((linha) => imagemDoBloco(linha) === null)
    .join('\n');
}

/** A marcação que vai para o `.md`. Com origem conhecida, ela vira o link. */
export function marcarImagem(nome: string, fonte: string | null): string {
  const marca = `![](anexos/${nome})`;
  return fonte && RE_EXTERNA.test(fonte) ? `[${marca}](${fonte})` : marca;
}

/**
 * Qual das imagens da área de transferência é A imagem.
 *
 * Um mesmo "copiar" pode deixar mais de uma versão no clipboard — o Windows e
 * alguns programas põem uma miniatura ao lado do original. Pegar a primeira que
 * aparece é como se acaba colando uma tarja de 250 pixels no lugar do print
 * inteiro. Fica a maior, que é sempre a que a pessoa quis.
 */
export function melhorImagem(arquivos: File[]): File | null {
  const imagens = arquivos.filter((arquivo) => arquivo.type.startsWith('image/') && arquivo.size > 0);
  if (imagens.length === 0) return null;
  return imagens.reduce((maior, atual) => (atual.size > maior.size ? atual : maior));
}

/**
 * De onde veio o print, lido do `text/html` da área de transferência.
 *
 * Copiar uma imagem de dentro do navegador põe na área de transferência, além
 * dos bytes, um pedaço de HTML com o endereço de onde ela saiu. Print feito
 * pela Ferramenta de Captura não tem endereço nenhum — e aí não há o que
 * guardar. Inventar uma origem seria pior do que não ter.
 */
export function origemDoHtml(html: string): string | null {
  const marca = html.match(/<img\b[^>]*\bsrc\s*=\s*("[^"]*"|'[^']*')/i);
  if (!marca) return null;

  const url = marca[1].slice(1, -1).trim();
  return RE_EXTERNA.test(url) ? url : null;
}

/**
 * O endereço que a janela consegue carregar. O `.md` guarda o caminho relativo,
 * que é portátil; quem serve o arquivo do disco é o protocolo do aplicativo.
 */
export function enderecoDaImagem(src: string): string | null {
  if (RE_ANEXO.test(src)) return `ardosia://${src}`;
  return RE_EXTERNA.test(src) ? src : null;
}

/**
 * O tamanho do bloco para uma imagem de tais dimensões: a proporção é mantida,
 * o lado maior não passa do teto e o bloco nunca fica menor do que um bloco
 * pode ser. Imagem pequena demais sobra dentro dele, centralizada — é melhor
 * do que um retângulo que não dá para pegar.
 */
export function tamanhoDoBloco(largura: number, altura: number): { largura: number; altura: number } {
  if (!(largura > 0) || !(altura > 0)) {
    return { largura: LARGURA_MINIMA, altura: ALTURA_MINIMA };
  }

  const escala = Math.min(1, LADO_MAXIMO / largura, LADO_MAXIMO / altura);
  return {
    largura: Math.max(LARGURA_MINIMA, Math.round(largura * escala)),
    altura: Math.max(ALTURA_MINIMA, Math.round(altura * escala)),
  };
}

function ehSrcAceita(src: string): boolean {
  return RE_ANEXO.test(src) || RE_EXTERNA.test(src);
}
