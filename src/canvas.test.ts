import { describe, expect, it } from 'vitest';
import {
  criarBloco,
  textoDaNota,
  alturaAjustada,
  duplicarBloco,
  moverFigura,
  arrumarEmColuna,
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

describe('alturaAjustada com figura no rodapé', () => {
  it('a faixa da figura entra na conta e o bloco não encolhe por cima dela', () => {
    // texto de 40px + figura de 180px: o bloco precisa de 220 e não de 44
    expect(alturaAjustada(400, 40 + 180, true)).toBe(224);
  });

  it('sem figura, a conta é só do texto', () => {
    expect(alturaAjustada(400, 100, true)).toBe(104);
  });
});

describe('mover a figura de uma seção para outra', () => {
  const comFoto = (id: string, altura = 200) => ({
    ...criarBloco(0, 0),
    id,
    altura: 300,
    texto: 'origem',
    imagem: { src: 'anexos/a.png', altura },
  });

  const semFoto = (id: string) => ({ ...criarBloco(0, 400), id, altura: 120, texto: 'destino' });

  it('a foto muda de dono e o espaço vai junto', () => {
    const depois = moverFigura([comFoto('a'), semFoto('b')], 'a', 'b');

    expect(depois[0].imagem).toBeUndefined();
    expect(depois[0].altura).toBe(100);
    expect(depois[1].imagem).toEqual({ src: 'anexos/a.png', altura: 200 });
    expect(depois[1].altura).toBe(320);
  });

  it('a seção nunca encolhe abaixo do mínimo ao perder a foto', () => {
    const apertada = { ...comFoto('a'), altura: 80 };
    expect(moverFigura([apertada, semFoto('b')], 'a', 'b')[0].altura).toBe(ALTURA_MINIMA);
  });

  it('duas seções com foto trocam as fotos, em vez de uma engolir a outra', () => {
    const primeira = comFoto('a', 200);
    const segunda = { ...comFoto('b', 100), imagem: { src: 'anexos/b.png', altura: 100 } };

    const depois = moverFigura([primeira, segunda], 'a', 'b');

    expect(depois[0].imagem?.src).toBe('anexos/b.png');
    expect(depois[1].imagem?.src).toBe('anexos/a.png');
  });

  it('soltar na própria seção não mexe em nada', () => {
    const blocos = [comFoto('a'), semFoto('b')];
    expect(moverFigura(blocos, 'a', 'a')).toBe(blocos);
  });

  it('seção sem foto não tem o que arrastar', () => {
    const blocos = [semFoto('a'), semFoto('b')];
    expect(moverFigura(blocos, 'a', 'b')).toBe(blocos);
  });

  it('soltar numa seção que já não existe não perde a foto', () => {
    const blocos = [comFoto('a')];
    expect(moverFigura(blocos, 'a', 'sumiu')).toBe(blocos);
  });
});

describe('arrumarEmColuna', () => {
  it('alinha os blocos em coluna ordenada com espacamento uniforme', () => {
    const blocos = [
      { id: 'b2', x: 200, y: 150, largura: 300, altura: 100, texto: 'segundo' },
      { id: 'b1', x: 50, y: 30, largura: 320, altura: 80, texto: 'primeiro' },
      { id: 'b3', x: 10, y: 300, largura: 250, altura: 60, texto: 'terceiro' },
    ];
    const resultado = arrumarEmColuna(blocos, 48, 48, 16);
    expect(resultado.map((b) => b.id)).toEqual(['b1', 'b2', 'b3']);
    expect(resultado[0].x).toBe(48);
    expect(resultado[0].y).toBe(48);
    expect(resultado[1].x).toBe(48);
    expect(resultado[1].y).toBe(48 + 80 + 16); // 144
    expect(resultado[2].x).toBe(48);
    expect(resultado[2].y).toBe(144 + 100 + 16); // 260
  });

  it('preserva atributos de caneta, letra, fundo e imagem', () => {
    const bloco = {
      ...criarBloco(10, 10),
      caneta: 'azul' as const,
      letra: 'leitura' as const,
      fundo: 'ocre' as const,
      imagem: { src: 'anexos/foto.png' },
    };
    const [arrumado] = arrumarEmColuna([bloco], 32, 32);
    expect(arrumado.caneta).toBe('azul');
    expect(arrumado.letra).toBe('leitura');
    expect(arrumado.fundo).toBe('ocre');
    expect(arrumado.imagem?.src).toBe('anexos/foto.png');
    expect(arrumado.x).toBe(32);
    expect(arrumado.y).toBe(32);
  });
});
