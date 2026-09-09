/**
 * Uma seção da página — o que numa folha de caderno seria um trecho escrito
 * num canto, um recorte colado no outro.
 *
 * A imagem é propriedade DA SEÇÃO, e não uma marcação dentro do texto. Foi
 * assim que ela deixou de depender de a nota ser Markdown: um caderno tem foto
 * colada na página, e a página pode ser de texto puro.
 */
export type Bloco = {
  id: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
  texto: string;
  /** A figura colada nesta seção, quando há uma. */
  imagem?: Imagem;
};

export type Imagem = {
  /** Caminho relativo na pasta da nota, como `anexos/abc123.png`. */
  src: string;
  /** De onde o print veio, quando a área de transferência soube dizer. */
  fonte?: string;
  /**
   * Quanto do rodapé da seção a foto ocupa, em pixels. É o tamanho DELA, e não
   * uma faixa fixa: uma foto alta pedia mais espaço do que qualquer constante
   * daria, e aparecia espremida a um terço do que é.
   *
   * Só vale quando a seção também tem texto — sozinha, a foto ocupa a seção
   * inteira. E nunca engole o texto: o CSS a limita ao que sobra da caixa.
   */
  altura?: number;
};

export const LARGURA_PADRAO = 320;
export const ALTURA_PADRAO = 120;
export const LARGURA_MINIMA = 120;
export const ALTURA_MINIMA = 60;

export function criarBloco(x: number, y: number): Bloco {
  return {
    id: crypto.randomUUID(),
    x: Math.max(0, x),
    y: Math.max(0, y),
    largura: LARGURA_PADRAO,
    altura: ALTURA_PADRAO,
    texto: '',
  };
}

/**
 * O texto da nota inteira, na ordem em que se lê a página.
 *
 * A figura de uma seção sai daqui como marcação de imagem do Markdown: é o que
 * a pré-visualização desenha e o que a linha de comando entrega a quem pede a
 * nota. No arquivo ela mora no marcador do bloco, e não no texto — mas quem lê
 * a nota como texto precisa ver que há uma foto ali.
 */
export function textoDaNota(blocos: Bloco[]): string {
  return [...blocos]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((bloco) => [bloco.texto.trim(), marcacaoDaImagem(bloco)].filter(Boolean).join('\n'))
    .filter((texto) => texto.length > 0)
    .join('\n');
}

function marcacaoDaImagem(bloco: Bloco): string {
  if (!bloco.imagem) return '';
  const marca = `![](${bloco.imagem.src})`;
  return bloco.imagem.fonte ? `[${marca}](${bloco.imagem.fonte})` : marca;
}

/** Margem de tolerância do auto-ajuste de altura, em pixels. */
export const FOLGA = 4;

/**
 * A altura que o bloco deve passar a ter, ou `null` quando a atual já serve.
 *
 * `conteudo` é a altura natural do texto, medida com o campo zerado — a única
 * medida que não depende da altura já aplicada. Depender dela é o que fazia o
 * efeito se realimentar e travar a aba.
 *
 * Crescer é sempre; encolher só quando o texto diminuiu. Quem arrastou o canto
 * para deixar o bloco maior não quer vê-lo encolher na próxima letra digitada.
 */
export function alturaAjustada(altura: number, conteudo: number, encolheu: boolean): number | null {
  if (conteudo > altura + FOLGA) return conteudo + FOLGA;
  if (!encolheu) return null;

  const alvo = Math.max(ALTURA_MINIMA, conteudo + FOLGA);
  return alvo + FOLGA < altura ? alvo : null;
}

/** Respiro entre um bloco e a cópia dele, em pixels. */
export const ESPACO = 16;

/**
 * Uma cópia do bloco, logo abaixo dele. Id novo, porque dois blocos com o
 * mesmo id são o mesmo bloco para o React — e editar um mexeria no outro.
 */
export function duplicarBloco(bloco: Bloco): Bloco {
  return {
    ...bloco,
    id: crypto.randomUUID(),
    y: bloco.y + bloco.altura + ESPACO,
  };
}
