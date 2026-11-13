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
  /** Com que caneta esta seção foi escrita. Ausente é o grafite. */
  caneta?: Caneta;
  /** Com que letra esta seção foi escrita. Ausente é a monoespaçada. */
  letra?: Letra;
  /** O papel desta seção, quando ela é um post-it colado na folha. */
  fundo?: Fundo;
  /** O arquivo grampeado nesta seção, quando não é imagem. */
  anexo?: Anexo;
};

/**
 * Um arquivo que não é imagem, preso à seção como um grampo prende um papel na
 * folha. Não há nome à parte: o caminho já o traz, e é o mesmo nome que está na
 * pasta — quem abre o Explorer encontra exatamente o que a nota mostra.
 */
export type Anexo = {
  /** Caminho relativo na pasta da nota, como `anexos/prova-final.pdf`. */
  src: string;
};

/** O nome do arquivo, que é o que se lê na seção. */
export function nomeDoAnexo(anexo: Anexo): string {
  return anexo.src.slice(anexo.src.lastIndexOf('/') + 1);
}

/**
 * As canetas do estojo, e são estas. Não é cor livre: cada uma é um token do
 * tema, medida nos dois fundos por `.agent/check-design.mjs`. Escolher a cor
 * do texto num seletor de milhões de tons seria a maneira mais rápida de
 * deixar uma nota ilegível no tema em que ela não foi escrita.
 */
export const CANETAS = ['grafite', 'ocre', 'terracota', 'azul', 'verde'] as const;
export type Caneta = (typeof CANETAS)[number];

/** A letra de cada seção: a de sempre, a de ler, e a de escrever à mão. */
export const LETRAS = ['mono', 'leitura', 'mao'] as const;
export type Letra = (typeof LETRAS)[number];

/**
 * O papel da seção: as mesmas cores do estojo, lavadas até virarem fundo. Não
 * há grafite aqui — papel cinza é a folha inteira, e não um post-it colado
 * nela. `nenhum` é a folha de sempre, e é o que não se escreve no arquivo.
 */
export const FUNDOS = ['nenhum', 'ocre', 'terracota', 'azul', 'verde'] as const;
export type Fundo = (typeof FUNDOS)[number];

/** O que o marcador do bloco traz é texto de arquivo: pode vir qualquer coisa. */
export function ehCaneta(valor: string): valor is Caneta {
  return (CANETAS as readonly string[]).includes(valor);
}

export function ehFundo(valor: string): valor is Fundo {
  return (FUNDOS as readonly string[]).includes(valor);
}

export function ehLetra(valor: string): valor is Letra {
  return (LETRAS as readonly string[]).includes(valor);
}

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

/**
 * Leva a figura de uma seção para outra, como se descolasse a foto da página e
 * a colasse noutro canto. Quando a seção de destino já tem uma, as duas trocam
 * de lugar: nenhuma foto some porque outra chegou.
 *
 * Cada seção cresce e encolhe pelo que a foto pedia, para o texto que já estava
 * lá não ficar espremido nem sobrar um vão onde a foto estava.
 */
export function moverFigura(blocos: Bloco[], de: string, para: string): Bloco[] {
  if (de === para) return blocos;

  const origem = blocos.find((bloco) => bloco.id === de);
  const destino = blocos.find((bloco) => bloco.id === para);
  if (!origem?.imagem || !destino) return blocos;

  const faixaQueSai = origem.imagem.altura ?? 0;
  const faixaQueVolta = destino.imagem?.altura ?? 0;

  return blocos.map((bloco) => {
    if (bloco.id === de) {
      if (!destino.imagem) {
        const { imagem: _saiu, ...semFigura } = bloco;
        return { ...semFigura, altura: Math.max(ALTURA_MINIMA, bloco.altura - faixaQueSai) };
      }
      return {
        ...bloco,
        imagem: destino.imagem,
        altura: Math.max(ALTURA_MINIMA, bloco.altura - faixaQueSai + faixaQueVolta),
      };
    }

    if (bloco.id === para) {
      return {
        ...bloco,
        imagem: origem.imagem,
        altura: Math.max(ALTURA_MINIMA, bloco.altura - faixaQueVolta + faixaQueSai),
      };
    }

    return bloco;
  });
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

/**
 * Organiza todos os blocos do caderno em uma coluna vertical limpa e contínua,
 * na ordem natural de leitura (de cima para baixo, da esquerda para a direita).
 * Útil para quando pensamentos foram espalhados livremente pela folha e agora
 * precisam de uma arrumação de leitura.
 */
export function arrumarEmColuna(
  blocos: Bloco[],
  margemX = 48,
  margemY = 48,
  espaco = ESPACO,
): Bloco[] {
  const ordenados = [...blocos].sort((a, b) => a.y - b.y || a.x - b.x);
  let atualY = margemY;

  return ordenados.map((bloco) => {
    const ajustado: Bloco = {
      ...bloco,
      x: margemX,
      y: atualY,
    };
    atualY += bloco.altura + espaco;
    return ajustado;
  });
}

