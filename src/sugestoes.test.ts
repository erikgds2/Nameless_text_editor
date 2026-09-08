import { describe, expect, it } from 'vitest';
import { ligacaoSendoEscrita, completarLigacao, ordenarCandidatos } from './sugestoes';

/**
 * Lê um modelo com `|` marcando o cursor e devolve texto + posição, no
 * mesmo espírito do helper `montar` de edicao.test.ts.
 */
function pos(modelo: string): { texto: string; cursor: number } {
  const cursor = modelo.indexOf('|');
  const texto = modelo.slice(0, cursor) + modelo.slice(cursor + 1);
  return { texto, cursor };
}

describe('ligacaoSendoEscrita', () => {
  it('reconhece o termo sendo digitado depois de [[', () => {
    const { texto, cursor } = pos('[[Ka|');
    expect(ligacaoSendoEscrita(texto, cursor)).toEqual({ termo: 'Ka', inicio: 0, fim: 4 });
  });

  it('aceita [[|]] com termo vazio, quando o editor já fechou os colchetes', () => {
    const { texto, cursor } = pos('[[|]]');
    expect(ligacaoSendoEscrita(texto, cursor)).toEqual({ termo: '', inicio: 0, fim: 2 });
  });

  it('devolve null quando não há [[ antes do cursor na linha', () => {
    const { texto, cursor } = pos('sem colchetes nenhum|');
    expect(ligacaoSendoEscrita(texto, cursor)).toBeNull();
  });

  it('devolve null quando a ligação já foi fechada com ]] antes do cursor', () => {
    const { texto, cursor } = pos('[[abc]] resto|');
    expect(ligacaoSendoEscrita(texto, cursor)).toBeNull();
  });

  it('devolve null quando o [[ está numa linha anterior', () => {
    const { texto, cursor } = pos('[[abc\nresto|');
    expect(ligacaoSendoEscrita(texto, cursor)).toBeNull();
  });

  it('devolve null com o cursor dentro de código inline', () => {
    const { texto, cursor } = pos('texto `[[abc|` fim');
    expect(ligacaoSendoEscrita(texto, cursor)).toBeNull();
  });

  it('devolve null com o cursor dentro de um bloco de código cercado', () => {
    const { texto, cursor } = pos('```\ncodigo [[abc|\n```');
    expect(ligacaoSendoEscrita(texto, cursor)).toBeNull();
  });

  it('aceita termo com espaço e acento', () => {
    const { texto, cursor } = pos('[[Revisão de Cál|');
    expect(ligacaoSendoEscrita(texto, cursor)).toEqual({
      termo: 'Revisão de Cál',
      inicio: 0,
      fim: cursor,
    });
  });

  it('devolve null quando o termo conteria [ ou ]', () => {
    const { texto, cursor } = pos('[[ab]cd|');
    expect(ligacaoSendoEscrita(texto, cursor)).toBeNull();
  });

  it('aceita termo com emoji', () => {
    const { texto, cursor } = pos('[[🎉 nota|');
    expect(ligacaoSendoEscrita(texto, cursor)).toEqual({
      termo: '🎉 nota',
      inicio: 0,
      fim: cursor,
    });
  });

  it('em texto vazio devolve null', () => {
    expect(ligacaoSendoEscrita('', 0)).toBeNull();
  });

  it('com o cursor na posição 0 devolve null mesmo havendo [[ depois', () => {
    expect(ligacaoSendoEscrita('[[abc', 0)).toBeNull();
  });

  it('com o cursor no fim do texto reconhece o [[ em aberto', () => {
    const { texto, cursor } = pos('foo [[|');
    expect(ligacaoSendoEscrita(texto, cursor)).toEqual({ termo: '', inicio: 4, fim: cursor });
  });

  it('[[ no fim do texto sem nada depois', () => {
    const texto = 'foo [[';
    expect(ligacaoSendoEscrita(texto, texto.length)).toEqual({ termo: '', inicio: 4, fim: 6 });
  });

  it('com dois [[ na mesma linha, vale o mais próximo do cursor à esquerda', () => {
    const { texto, cursor } = pos('[[primeiro texto [[segundo|');
    expect(ligacaoSendoEscrita(texto, cursor)).toEqual({
      termo: 'segundo',
      inicio: 17,
      fim: cursor,
    });
  });

  it('em [[a]] e [[b|, o segundo é o que conta', () => {
    const { texto, cursor } = pos('[[a]] e [[b|');
    expect(ligacaoSendoEscrita(texto, cursor)).toEqual({ termo: 'b', inicio: 8, fim: cursor });
  });
});

describe('completarLigacao', () => {
  it('troca [[termo pelo [[alvo]] completo e põe o cursor depois de ]]', () => {
    const onde = { termo: 'Ka', inicio: 0, fim: 4 };
    const resultado = completarLigacao('[[Ka', 'Katia', onde);
    expect(resultado).toEqual({ texto: '[[Katia]]', cursor: 9 });
  });

  it('não duplica ]] quando ele já existe logo após o cursor', () => {
    const onde = { termo: 'Ka', inicio: 0, fim: 4 };
    const resultado = completarLigacao('[[Ka]]', 'Katia', onde);
    expect(resultado).toEqual({ texto: '[[Katia]]', cursor: 9 });
  });

  it('preserva ligações antes e depois, mexendo só na que está sendo escrita', () => {
    const { texto, cursor } = pos('antes [[um]] meio [[Ka| depois');
    const onde = ligacaoSendoEscrita(texto, cursor);
    expect(onde).not.toBeNull();
    const resultado = completarLigacao(texto, 'Katia', onde!);
    expect(resultado.texto).toBe('antes [[um]] meio [[Katia]] depois');
    expect(resultado.texto.slice(resultado.cursor)).toBe(' depois');
  });
});

describe('ordenarCandidatos', () => {
  it('termo vazio devolve todos, na ordem em que chegaram', () => {
    expect(ordenarCandidatos(['b', 'a', 'c'], '')).toEqual(['b', 'a', 'c']);
  });

  it('compara ignorando acentos e maiúsculas', () => {
    expect(ordenarCandidatos(['Cálculo', 'Outra coisa'], 'calculo')).toEqual(['Cálculo']);
  });

  it('ordena começa-com antes de contém, e descarta o resto', () => {
    const titulos = ['Vida em Marte', 'Marte Vermelho', 'Sobre Marte', 'Nada aqui'];
    expect(ordenarCandidatos(titulos, 'marte')).toEqual([
      'Marte Vermelho',
      'Vida em Marte',
      'Sobre Marte',
    ]);
  });

  it('empate mantém a ordem original (estável)', () => {
    const titulos = ['Nota B', 'Nota A'];
    expect(ordenarCandidatos(titulos, 'nota')).toEqual(['Nota B', 'Nota A']);
  });

  it('nunca muta o array recebido', () => {
    const titulos = Object.freeze(['Alfa', 'Beta']);
    expect(() => ordenarCandidatos(titulos as string[], 'a')).not.toThrow();
    expect(titulos).toEqual(['Alfa', 'Beta']);
  });
});
