/**
 * Cálculo de guias de alinhamento e ajuste por aproximação (snap) ao mover
 * blocos pela folha do caderno.
 *
 * Módulo puro do núcleo: não depende de React, DOM ou eventos.
 */

export type Caixa = {
  id?: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
};

export type Guia = {
  orientacao: 'horizontal' | 'vertical';
  posicao: number;
};

export type ResultadoAlinhamento = {
  x: number;
  y: number;
  guias: Guia[];
};

export const TOLERANCIA_SNAP = 6;
export const GRADE_PADRAO = 8;

/**
 * Calcula a posição ajustada do bloco alvo e as linhas-guia ativas quando
 * ele se aproxima das bordas de blocos vizinhos ou da grade de alinhamento.
 */
export function calcularAlinhamento(
  alvo: Caixa,
  vizinhos: Caixa[],
  tolerancia = TOLERANCIA_SNAP,
): ResultadoAlinhamento {
  let melhorX = alvo.x;
  let menorDistX = tolerancia + 1;
  let guiaX: Guia | null = null;

  let melhorY = alvo.y;
  let menorDistY = tolerancia + 1;
  let guiaY: Guia | null = null;

  // Bordas do alvo
  const alvoX1 = alvo.x;
  const alvoX2 = alvo.x + alvo.largura;
  const alvoY1 = alvo.y;
  const alvoY2 = alvo.y + alvo.altura;

  for (const vizinho of vizinhos) {
    if (alvo.id && vizinho.id === alvo.id) continue;

    const vizX1 = vizinho.x;
    const vizX2 = vizinho.x + vizinho.largura;
    const vizY1 = vizinho.y;

    // Alinhamentos no eixo X (linhas verticais)
    // 1. esquerda com esquerda
    const d1 = Math.abs(alvoX1 - vizX1);
    if (d1 < menorDistX) {
      menorDistX = d1;
      melhorX = vizX1;
      guiaX = { orientacao: 'vertical', posicao: vizX1 };
    }
    // 2. direita com direita
    const d2 = Math.abs(alvoX2 - vizX2);
    if (d2 < menorDistX) {
      menorDistX = d2;
      melhorX = vizX2 - alvo.largura;
      guiaX = { orientacao: 'vertical', posicao: vizX2 };
    }
    // 3. esquerda com direita
    const d3 = Math.abs(alvoX1 - vizX2);
    if (d3 < menorDistX) {
      menorDistX = d3;
      melhorX = vizX2;
      guiaX = { orientacao: 'vertical', posicao: vizX2 };
    }
    // 4. direita com esquerda
    const d4 = Math.abs(alvoX2 - vizX1);
    if (d4 < menorDistX) {
      menorDistX = d4;
      melhorX = vizX1 - alvo.largura;
      guiaX = { orientacao: 'vertical', posicao: vizX1 };
    }

    // Alinhamentos no eixo Y (linhas horizontais)
    const vizYFim = vizinho.y + vizinho.altura;
    // 1. topo com topo
    const dy1 = Math.abs(alvoY1 - vizY1);
    if (dy1 < menorDistY) {
      menorDistY = dy1;
      melhorY = vizY1;
      guiaY = { orientacao: 'horizontal', posicao: vizY1 };
    }
    // 2. base com base
    const dy2 = Math.abs(alvoY2 - vizYFim);
    if (dy2 < menorDistY) {
      menorDistY = dy2;
      melhorY = vizYFim - alvo.altura;
      guiaY = { orientacao: 'horizontal', posicao: vizYFim };
    }
    // 3. topo com base
    const dy3 = Math.abs(alvoY1 - vizYFim);
    if (dy3 < menorDistY) {
      menorDistY = dy3;
      melhorY = vizYFim;
      guiaY = { orientacao: 'horizontal', posicao: vizYFim };
    }
    // 4. base com topo
    const dy4 = Math.abs(alvoY2 - vizY1);
    if (dy4 < menorDistY) {
      menorDistY = dy4;
      melhorY = vizY1 - alvo.altura;
      guiaY = { orientacao: 'horizontal', posicao: vizY1 };
    }
  }

  const guias: Guia[] = [];
  if (guiaX) guias.push(guiaX);
  if (guiaY) guias.push(guiaY);

  return {
    x: Math.max(0, melhorX),
    y: Math.max(0, melhorY),
    guias,
  };
}
