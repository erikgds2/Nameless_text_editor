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
