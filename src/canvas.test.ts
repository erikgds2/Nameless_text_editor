import { describe, expect, it } from 'vitest';
import {
  criarBloco,
  textoDaNota,
  alturaAjustada,
  duplicarBloco,
  LARGURA_PADRAO,
  ALTURA_PADRAO,
  ALTURA_MINIMA,
} from './canvas';

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

describe('alturaAjustada', () => {
  it('texto que não cabe faz o bloco crescer', () => {
    expect(alturaAjustada(120, 200, false)).toBe(204);
  });

  it('texto que cabe não mexe em nada', () => {
    expect(alturaAjustada(120, 100, false)).toBeNull();
    expect(alturaAjustada(120, 118, false)).toBeNull();
  });

  it('apagar texto encolhe o bloco', () => {
    expect(alturaAjustada(300, 100, true)).toBe(104);
  });

  it('bloco maior que o texto só encolhe se o texto tiver diminuído', () => {
    expect(alturaAjustada(300, 100, false)).toBeNull();
  });

  it('encolher nunca passa do mínimo de um bloco', () => {
    expect(alturaAjustada(300, 10, true)).toBe(ALTURA_MINIMA);
    expect(alturaAjustada(ALTURA_MINIMA, 10, true)).toBeNull();
  });

  it('diferença dentro da folga não move o bloco: é assim que o laço converge', () => {
    expect(alturaAjustada(120, 114, true)).toBeNull();
    expect(alturaAjustada(120, 124, false)).toBeNull();
  });
});

describe('duplicarBloco', () => {
  const original = { ...criarBloco(48, 100), largura: 280, altura: 140, texto: 'a copiar' };

  it('a cópia nasce logo abaixo, na mesma coluna', () => {
    const copia = duplicarBloco(original);
    expect(copia.x).toBe(original.x);
    expect(copia.y).toBeGreaterThan(original.y + original.altura);
  });

  it('texto e tamanho vêm junto', () => {
    const copia = duplicarBloco(original);
    expect(copia.texto).toBe('a copiar');
    expect(copia.largura).toBe(280);
    expect(copia.altura).toBe(140);
  });

  it('id novo: dois blocos com o mesmo id seriam o mesmo bloco', () => {
    expect(duplicarBloco(original).id).not.toBe(original.id);
  });

  it('o original não é tocado', () => {
    const antes = { ...original };
    duplicarBloco(original);
    expect(original).toEqual(antes);
  });
});
