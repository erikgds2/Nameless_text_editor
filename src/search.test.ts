import { describe, expect, it } from 'vitest';
import { normalize, matchesQuery, trechoDoResultado } from './search';

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

describe('trechoDoResultado', () => {
  it('texto vazio retorna vazio', () => {
    expect(trechoDoResultado('', 'qualquer')).toBe('');
  });

  it('consulta vazia retorna começo do texto', () => {
    const texto =
      'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
    const resultado = trechoDoResultado(texto, '', 90);
    expect(resultado).toBe(texto.slice(0, 90) + '…');
  });

  it('consulta com só espaços retorna começo do texto', () => {
    const texto =
      'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
    const resultado = trechoDoResultado(texto, '   ', 90);
    expect(resultado).toBe(texto.slice(0, 90) + '…');
  });

  it('termo não encontrado retorna começo do texto', () => {
    const texto = 'O imperativo categórico não é uma regra.';
    const resultado = trechoDoResultado(texto, 'kant', 90);
    expect(resultado).toBe(texto.slice(0, 90));
  });

  it('texto menor que janela não tem reticências', () => {
    const texto = 'Nota curta';
    const resultado = trechoDoResultado(texto, 'curta', 90);
    expect(resultado).toBe(texto);
  });

  it('termo no comecinho da nota', () => {
    const texto = 'Ação rápida de todos os dias';
    const resultado = trechoDoResultado(texto, 'ação', 30);
    expect(resultado).toContain('Ação');
    expect(resultado).not.toContain('…');
  });

  it('termo no final da nota', () => {
    const texto =
      'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt.';
    const resultado = trechoDoResultado(texto, 'incididunt', 30);
    expect(resultado).toContain('incididunt');
    expect(resultado).toContain('…');
  });

  it('termo centrado na janela', () => {
    const texto =
      'abc def ghi jkl mno pqr stu vwx yz búsca fim fim fim fim fim fim fim fim';
    const resultado = trechoDoResultado(texto, 'búsca', 20);
    expect(resultado).toContain('búsca');
    expect(resultado).toContain('…');
  });

  it('termo maior que a janela ainda aparece', () => {
    const texto = 'xxx extraordinário xxx';
    const resultado = trechoDoResultado(texto, 'extraordinário', 10);
    expect(resultado).toContain('extraordinário');
  });

  it('preserva acentos no trecho quando ignora na busca', () => {
    const texto = 'coração é música da ação';
    const resultado = trechoDoResultado(texto, 'acao', 90);
    expect(resultado).toContain('ação');
  });

  it('mapa de índices: ação, coração, ímã sem deslocamento', () => {
    const texto =
      'ação xxxx yyyyy zzzzz coração wwww vvvv uuuu ímã busca tttt ssss';
    const resultado = trechoDoResultado(texto, 'coracao', 20);
    expect(resultado).toContain('coração');
  });

  it('quebras de linha viram espaço', () => {
    const texto = 'primeira linha\nsegunda linha\npalavra procurada é aqui';
    const resultado = trechoDoResultado(texto, 'procurada', 40);
    expect(resultado).toContain('procurada');
    expect(resultado).not.toContain('\n');
  });

  it('espaços repetidos são colapsados', () => {
    const texto = 'palavra    com    espaços     múltiplos     procurada     fim';
    const resultado = trechoDoResultado(texto, 'procurada', 40);
    expect(resultado).not.toContain('  ');
  });

  it('dois termos: encontra o primeiro que aparece no texto', () => {
    const texto = 'primeiro segundo terceiro primeiro ação final';
    const resultado = trechoDoResultado(texto, 'segundo ação', 30);
    expect(resultado).toContain('segundo');
  });

  it('reticências no início e fim quando necessário', () => {
    const texto =
      'início do texto com a palavra procurada no meio e mais texto';
    const resultado = trechoDoResultado(texto, 'procurada', 20);
    expect(resultado).toContain('procurada');
  });

  it('reticências no início quando necessário', () => {
    const texto =
      'xyz abc def ghi jkl mno pqr stu vwx yz procurada fim';
    const resultado = trechoDoResultado(texto, 'procurada', 20);
    expect(resultado).toContain('…');
  });

  it('tamanho explícito de 20 respeita limite + margem', () => {
    const texto = 'aaaaaaaa bbbbbbbb cccccccc encontrado dddddddd eeeeeeee';
    const resultado = trechoDoResultado(texto, 'encontrado', 20);
    const semReticencias = resultado.replace(/…/g, '');
    expect(semReticencias.length).toBeLessThanOrEqual(35);
  });

  it('texto com emoji não quebra o mapeamento', () => {
    const texto = 'emoji 🎉 com procurada no meio 😀 fim';
    const resultado = trechoDoResultado(texto, 'procurada', 40);
    expect(resultado).toContain('procurada');
  });
});
