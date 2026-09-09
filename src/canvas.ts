export type Bloco = {
  id: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
  texto: string;
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

export function textoDaNota(blocos: Bloco[]): string {
  return [...blocos]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .filter((bloco) => bloco.texto.trim().length > 0)
    .map((bloco) => bloco.texto)
    .join('\n');
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
