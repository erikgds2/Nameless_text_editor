import { beforeEach, describe, expect, it } from 'vitest';
import { ACENTOS, PADRAO, TAMANHOS, TEMAS, carregarAjustes, salvarAjustes } from './ajustes';

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
    const escolhido = {
      ...PADRAO,
      tema: 'papel' as const,
      tipoPadrao: 'texto' as const,
      preview: false,
      corpo: 17 as const,
      acento: '#7fa06a',
      opacidade: 60,
    };
    salvarAjustes(escolhido);
    expect(carregarAjustes()).toEqual(escolhido);
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
      'ardosia:ajustes:v2',
      JSON.stringify({ tema: 'neon-roxo', corpo: 17, preview: false }),
    );
    const ajustes = carregarAjustes();
    expect(ajustes.tema).toBe('acrilico');
    expect(ajustes.corpo).toBe(17);
    expect(ajustes.preview).toBe(false);
  });

  it('ignora tamanho de corpo fora da escala', () => {
    localStorage.setItem('ardosia:ajustes:v2', JSON.stringify({ corpo: 42 }));
    expect(carregarAjustes().corpo).toBe(15);
  });

  it('sobrevive a um storage corrompido', () => {
    localStorage.setItem('ardosia:ajustes:v2', '{não é json');
    expect(carregarAjustes()).toEqual(PADRAO);
  });
});

describe('acento e opacidade', () => {
  it('oferece cores de acento com rótulo e hex válido', () => {
    expect(ACENTOS.length).toBeGreaterThan(3);
    for (const cor of ACENTOS) {
      expect(cor.hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(cor.rotulo.length).toBeGreaterThan(2);
    }
  });

  it('aceita qualquer cor válida, inclusive fora da lista', () => {
    salvarAjustes({ ...PADRAO, acento: '#123ABC' });
    expect(carregarAjustes().acento).toBe('#123abc');
  });

  it('recusa cor malformada e volta para o ocre', () => {
    localStorage.setItem('ardosia:ajustes:v2', JSON.stringify({ acento: 'vermelho' }));
    expect(carregarAjustes().acento).toBe(PADRAO.acento);
    localStorage.setItem('ardosia:ajustes:v2', JSON.stringify({ acento: '#abc' }));
    expect(carregarAjustes().acento).toBe(PADRAO.acento);
  });

  it('prende a opacidade entre 0 e 100', () => {
    localStorage.setItem('ardosia:ajustes:v2', JSON.stringify({ opacidade: 250 }));
    expect(carregarAjustes().opacidade).toBe(100);
    localStorage.setItem('ardosia:ajustes:v2', JSON.stringify({ opacidade: -40 }));
    expect(carregarAjustes().opacidade).toBe(0);
    localStorage.setItem('ardosia:ajustes:v2', JSON.stringify({ opacidade: 'muito' }));
    expect(carregarAjustes().opacidade).toBe(PADRAO.opacidade);
  });

  it('arredonda a opacidade para um inteiro', () => {
    salvarAjustes({ ...PADRAO, opacidade: 42.7 });
    expect(carregarAjustes().opacidade).toBe(43);
  });
});

describe('divisória entre editor e pré-visualização', () => {
  it('começa no meio', () => {
    expect(carregarAjustes().divisoria).toBe(50);
  });

  it('não deixa um dos lados sumir', () => {
    localStorage.setItem('ardosia:ajustes:v2', JSON.stringify({ divisoria: 5 }));
    expect(carregarAjustes().divisoria).toBe(20);
    localStorage.setItem('ardosia:ajustes:v2', JSON.stringify({ divisoria: 99 }));
    expect(carregarAjustes().divisoria).toBe(80);
  });

  it('lembra a proporção escolhida', () => {
    salvarAjustes({ ...PADRAO, divisoria: 65 });
    expect(carregarAjustes().divisoria).toBe(65);
  });
});

describe('fundo da janela', () => {
  it('começa no acrílico, que é o material do Windows', () => {
    expect(carregarAjustes().fundo).toBe('acrilico');
  });

  it('lembra a escolha do vidro', () => {
    salvarAjustes({ ...PADRAO, fundo: 'vidro' });
    expect(carregarAjustes().fundo).toBe('vidro');
  });

  it('valor desconhecido volta para o acrílico', () => {
    localStorage.setItem('ardosia:ajustes:v2', JSON.stringify({ fundo: 'cristal' }));
    expect(carregarAjustes().fundo).toBe('acrilico');
  });
});

describe('a janela nasce visível', () => {
  it('sem nada escolhido, o fundo é sólido', () => {
    expect(carregarAjustes().opacidade).toBe(100);
    expect(PADRAO.opacidade).toBe(100);
  });

  it('quem vinha da v1 com o zero de fábrica passa a enxergar a janela', () => {
    localStorage.setItem(
      'ardosia:ajustes:v1',
      JSON.stringify({ ...PADRAO, tema: 'papel', acento: '#7fa06a', opacidade: 0 }),
    );

    const migrado = carregarAjustes();
    expect(migrado.opacidade).toBe(100);
    // o resto do que a pessoa escolheu atravessa intacto
    expect(migrado.tema).toBe('papel');
    expect(migrado.acento).toBe('#7fa06a');
  });

  it('transparência escolhida de propósito na v1 é respeitada', () => {
    localStorage.setItem('ardosia:ajustes:v1', JSON.stringify({ ...PADRAO, opacidade: 35 }));
    expect(carregarAjustes().opacidade).toBe(35);
  });

  it('a v2 manda sobre a v1 quando as duas existem', () => {
    localStorage.setItem('ardosia:ajustes:v1', JSON.stringify({ ...PADRAO, opacidade: 0 }));
    salvarAjustes({ ...PADRAO, opacidade: 20 });
    expect(carregarAjustes().opacidade).toBe(20);
  });

  it('opacidade 0 escolhida agora continua valendo — a migração é uma vez só', () => {
    salvarAjustes({ ...PADRAO, opacidade: 0 });
    expect(carregarAjustes().opacidade).toBe(0);
  });
});
