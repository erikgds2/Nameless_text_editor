import { beforeEach, describe, expect, it } from 'vitest';
import { PADRAO, TAMANHOS, TEMAS, carregarAjustes, salvarAjustes } from './ajustes';

beforeEach(() => localStorage.clear());

describe('temas', () => {
  it('oferece exatamente os três temas do DESIGN.md', () => {
    expect(TEMAS.map((t) => t.id)).toEqual(['acrilico', 'carvao', 'papel']);
  });

  it('cada tema tem um rótulo legível', () => {
    for (const tema of TEMAS) expect(tema.rotulo.length).toBeGreaterThan(2);
  });

  it('os tamanhos de corpo estão na escala tipográfica', () => {
    expect(TAMANHOS).toEqual([13, 15, 17]);
  });
});

describe('ajustes', () => {
  it('começa no padrão quando nada foi escolhido', () => {
    expect(carregarAjustes()).toEqual(PADRAO);
  });

  it('lembra a escolha inteira', () => {
    salvarAjustes({ tema: 'papel', tipoPadrao: 'texto', preview: false, corpo: 17 });
    expect(carregarAjustes()).toEqual({
      tema: 'papel',
      tipoPadrao: 'texto',
      preview: false,
      corpo: 17,
    });
  });

  it('herda o tema que a versão anterior do app tinha salvo', () => {
    localStorage.setItem('editor-sem-nome:tema', 'papel');
    expect(carregarAjustes().tema).toBe('papel');
  });

  it('renomeia o tema "tinta" da versão anterior para "carvao"', () => {
    localStorage.setItem('editor-sem-nome:tema', 'tinta');
    expect(carregarAjustes().tema).toBe('carvao');
  });

  it('ignora tema inválido sem descartar o resto dos ajustes', () => {
    localStorage.setItem(
      'ardosia:ajustes:v1',
      JSON.stringify({ tema: 'neon-roxo', corpo: 17, preview: false }),
    );
    const ajustes = carregarAjustes();
    expect(ajustes.tema).toBe('acrilico');
    expect(ajustes.corpo).toBe(17);
    expect(ajustes.preview).toBe(false);
  });

  it('ignora tamanho de corpo fora da escala', () => {
    localStorage.setItem('ardosia:ajustes:v1', JSON.stringify({ corpo: 42 }));
    expect(carregarAjustes().corpo).toBe(15);
  });

  it('sobrevive a um storage corrompido', () => {
    localStorage.setItem('ardosia:ajustes:v1', '{não é json');
    expect(carregarAjustes()).toEqual(PADRAO);
  });
});
