import { describe, expect, it } from 'vitest';
import { criarBloco, type Bloco } from './canvas';
import { achadosDoBloco, acharNaNota, realcarAchados } from './busca';

function bloco(id: string, texto: string, x = 48, y = 48): Bloco {
  return { ...criarBloco(x, y), id, texto };
}

/** O que a nota mostra: o termo achado, na ordem em que se anda por ele. */
function trechos(blocos: Bloco[], termo: string): string[] {
  const porId = new Map(blocos.map((b) => [b.id, b.texto]));
  return acharNaNota(blocos, termo).map((o) =>
    (porId.get(o.blocoId) as string).slice(o.inicio, o.fim),
  );
}

describe('achar dentro da nota', () => {
  it('termo vazio não acha nada', () => {
    expect(acharNaNota([bloco('a', 'Kant e Hume')], '')).toEqual([]);
    expect(acharNaNota([bloco('a', 'Kant e Hume')], '   ')).toEqual([]);
  });

  it('termo ausente não acha nada', () => {
    expect(acharNaNota([bloco('a', 'Kant e Hume')], 'Descartes')).toEqual([]);
  });

  it('acha uma ocorrência e diz onde ela começa e termina', () => {
    const [achado] = acharNaNota([bloco('a', 'Kant e Hume')], 'Hume');
    expect(achado).toEqual({ blocoId: 'a', inicio: 7, fim: 11 });
  });

  it('acha todas as ocorrências do mesmo bloco', () => {
    expect(trechos([bloco('a', 'nota, nota e nota')], 'nota')).toEqual(['nota', 'nota', 'nota']);
  });

  it('não confunde maiúscula com minúscula', () => {
    expect(trechos([bloco('a', 'Kant, kant e KANT')], 'kant')).toEqual(['Kant', 'kant', 'KANT']);
  });

  it('procurar sem acento acha com acento, e o recorte sai certo', () => {
    expect(trechos([bloco('a', 'a ação e a reação')], 'acao')).toEqual(['ação', 'ação']);
  });

  it('procurar com acento acha sem acento', () => {
    expect(trechos([bloco('a', 'revisao de calculo')], 'revisão')).toEqual(['revisao']);
  });

  it('as ocorrências não se sobrepõem', () => {
    expect(trechos([bloco('a', 'aaa')], 'aa')).toEqual(['aa']);
  });

  it('anda pelos blocos na ordem de leitura, não na de criação', () => {
    const blocos = [
      bloco('debaixo', 'termo de baixo', 48, 400),
      bloco('direita', 'termo da direita', 500, 48),
      bloco('esquerda', 'termo da esquerda', 48, 48),
    ];
    expect(acharNaNota(blocos, 'termo').map((o) => o.blocoId)).toEqual([
      'esquerda',
      'direita',
      'debaixo',
    ]);
  });

  it('separa os achados de um bloco dos dos outros', () => {
    const blocos = [bloco('a', 'nota e nota'), bloco('b', 'nota', 500, 48)];
    const todos = acharNaNota(blocos, 'nota');
    expect(todos).toHaveLength(3);
    expect(achadosDoBloco(todos, 'a')).toHaveLength(2);
    expect(achadosDoBloco(todos, 'b')).toHaveLength(1);
  });
});

describe('realce das ocorrências', () => {
  const achadosDe = (texto: string, termo: string) =>
    acharNaNota([bloco('a', texto)], termo);

  it('sem achados, devolve o texto como está', () => {
    expect(realcarAchados('Kant e Hume', [])).toBe('Kant e Hume');
  });

  it('envolve cada ocorrência numa marca', () => {
    const html = realcarAchados('nota e nota', achadosDe('nota e nota', 'nota'));
    expect(html).toBe('<mark class="achado">nota</mark> e <mark class="achado">nota</mark>');
  });

  it('a ocorrência onde a navegação parou ganha marca própria', () => {
    const achados = achadosDe('nota e nota', 'nota');
    const html = realcarAchados('nota e nota', achados, achados[1]);
    expect(html).toBe(
      '<mark class="achado">nota</mark> e <mark class="achado achado--atual">nota</mark>',
    );
  });

  it('escapa o que foi digitado, dentro e fora da marca', () => {
    const texto = '<script>alerta & cia</script>';
    const html = realcarAchados(texto, achadosDe(texto, 'alerta'));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<mark class="achado">alerta</mark>');
    expect(html).toContain('&amp;');
  });

  it('realça a palavra acentuada mesmo tendo sido procurada sem acento', () => {
    const texto = 'a ação começa';
    expect(realcarAchados(texto, achadosDe(texto, 'acao'))).toBe(
      'a <mark class="achado">ação</mark> começa',
    );
  });

  it('o texto fora das marcas continua inteiro', () => {
    const texto = 'começo nota fim';
    const html = realcarAchados(texto, achadosDe(texto, 'nota'));
    expect(html.replace(/<[^>]+>/g, '')).toBe(texto);
  });
});
