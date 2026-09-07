import { describe, expect, it } from 'vitest';
import { normalize, matchesQuery } from './search';

describe('normalize', () => {
  it('remove acentos e caixa', () => {
    expect(normalize('Imperativo Categórico')).toBe('imperativo categorico');
    expect(normalize('AÇÃO')).toBe('acao');
    expect(normalize('coração à noite')).toBe('coracao a noite');
  });

  it('preserva o texto sem diacríticos', () => {
    expect(normalize('limites e derivadas')).toBe('limites e derivadas');
  });
});

describe('matchesQuery', () => {
  const texto = 'O imperativo categórico não é uma regra, mas uma forma.';

  it('encontra ignorando acento e caixa', () => {
    expect(matchesQuery(texto, 'CATEGORICO')).toBe(true);
    expect(matchesQuery(texto, 'categórico')).toBe(true);
  });

  it('exige todos os termos, em qualquer ordem', () => {
    expect(matchesQuery(texto, 'forma imperativo')).toBe(true);
    expect(matchesQuery(texto, 'imperativo kant')).toBe(false);
  });

  it('trata busca vazia como "tudo passa"', () => {
    expect(matchesQuery(texto, '')).toBe(true);
    expect(matchesQuery(texto, '   ')).toBe(true);
  });

  it('casa pedaço de palavra', () => {
    expect(matchesQuery(texto, 'categ')).toBe(true);
  });
});
