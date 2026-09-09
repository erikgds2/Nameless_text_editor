import { describe, expect, it } from 'vitest';
import { juntarComDisco } from './conflito';
import { createNote, type Note } from './notes';
import { criarBloco } from './canvas';

function nota(id: string, texto: string): Note {
  return { ...createNote(), id, blocos: [{ ...criarBloco(48, 48), texto }] };
}

const nenhuma = new Set<string>();

describe('juntarComDisco', () => {
  it('sem nada sendo escrito, o disco manda', () => {
    const { notas, conflitos } = juntarComDisco([nota('a', 'antiga')], [nota('a', 'do disco')], nenhuma);

    expect(notas.map((n) => n.blocos[0].texto)).toEqual(['do disco']);
    expect(conflitos).toEqual([]);
  });

  it('o que está sendo escrito agora não é atropelado pelo arquivo', () => {
    const { notas } = juntarComDisco(
      [nota('a', 'o que eu estou digitando')],
      [nota('a', 'o que está no arquivo')],
      new Set(['a']),
    );

    expect(notas[0].blocos[0].texto).toBe('o que eu estou digitando');
  });

  it('editado dos dois lados é conflito declarado, com a versão do disco à mão', () => {
    const { conflitos } = juntarComDisco(
      [nota('a', 'o meu texto')],
      [nota('a', 'o texto que chegou de fora')],
      new Set(['a']),
    );

    expect(conflitos).toHaveLength(1);
    expect(conflitos[0].id).toBe('a');
    expect(conflitos[0].doDisco.blocos[0].texto).toBe('o texto que chegou de fora');
  });

  it('mesmo texto dos dois lados não é conflito nenhum', () => {
    const { conflitos } = juntarComDisco(
      [nota('a', 'igual')],
      [nota('a', 'igual')],
      new Set(['a']),
    );

    expect(conflitos).toEqual([]);
  });

  it('nota nova, ainda sem arquivo, continua na lista', () => {
    const { notas } = juntarComDisco([nota('nova', 'rascunho')], [], new Set(['nova']));
    expect(notas.map((n) => n.id)).toEqual(['nova']);
  });

  it('nota em branco que ainda não foi tocada não vira conflito', () => {
    const { notas, conflitos } = juntarComDisco(
      [nota('a', '')],
      [nota('a', 'veio texto de fora')],
      nenhuma,
    );

    expect(conflitos).toEqual([]);
    expect(notas[0].blocos[0].texto).toBe('veio texto de fora');
  });

  it('nota apagada por fora some da lista se não estava sendo escrita', () => {
    const { notas } = juntarComDisco([nota('a', 'existia')], [], nenhuma);
    expect(notas).toEqual([]);
  });

  it('cada nota é julgada por si: uma em conflito não contamina as outras', () => {
    const { notas, conflitos } = juntarComDisco(
      [nota('a', 'meu texto'), nota('b', 'sem mexer')],
      [nota('a', 'de fora'), nota('b', 'atualizada por fora')],
      new Set(['a']),
    );

    expect(conflitos.map((c) => c.id)).toEqual(['a']);
    expect(notas.find((n) => n.id === 'b')?.blocos[0].texto).toBe('atualizada por fora');
  });
});
