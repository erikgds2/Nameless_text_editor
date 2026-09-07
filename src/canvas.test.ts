import { describe, expect, it } from 'vitest';
import { criarBloco, textoDaNota, LARGURA_PADRAO, ALTURA_PADRAO } from './canvas';

describe('criarBloco', () => {
  it('nasce na posição pedida, vazio e no tamanho padrão', () => {
    const bloco = criarBloco(120, 80);
    expect(bloco.x).toBe(120);
    expect(bloco.y).toBe(80);
    expect(bloco.largura).toBe(LARGURA_PADRAO);
    expect(bloco.altura).toBe(ALTURA_PADRAO);
    expect(bloco.texto).toBe('');
  });

  it('nunca posiciona fora do canvas', () => {
    const bloco = criarBloco(-50, -10);
    expect(bloco.x).toBeGreaterThanOrEqual(0);
    expect(bloco.y).toBeGreaterThanOrEqual(0);
  });

  it('dá um id diferente a cada bloco', () => {
    expect(criarBloco(0, 0).id).not.toBe(criarBloco(0, 0).id);
  });
});

describe('textoDaNota', () => {
  it('lê de cima para baixo', () => {
    const texto = textoDaNota([
      { id: 'b', x: 0, y: 200, largura: 100, altura: 50, texto: 'segundo' },
      { id: 'a', x: 0, y: 10, largura: 100, altura: 50, texto: 'primeiro' },
    ]);
    expect(texto).toBe('primeiro\nsegundo');
  });

  it('desempata da esquerda para a direita', () => {
    const texto = textoDaNota([
      { id: 'd', x: 300, y: 40, largura: 100, altura: 50, texto: 'direita' },
      { id: 'e', x: 20, y: 40, largura: 100, altura: 50, texto: 'esquerda' },
    ]);
    expect(texto).toBe('esquerda\ndireita');
  });

  it('ignora blocos sem conteúdo', () => {
    const texto = textoDaNota([
      { id: 'a', x: 0, y: 0, largura: 100, altura: 50, texto: 'Kant' },
      { id: 'b', x: 0, y: 90, largura: 100, altura: 50, texto: '   ' },
    ]);
    expect(texto).toBe('Kant');
  });

  it('devolve string vazia quando não há bloco algum', () => {
    expect(textoDaNota([])).toBe('');
  });
});
