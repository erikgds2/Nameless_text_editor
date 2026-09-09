import { describe, expect, it } from 'vitest';
import { juntarComDisco, preservarIdsDosBlocos } from './conflito';
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

describe('preservarIdsDosBlocos', () => {
  function comBlocos(id: string, ...posicoes: [number, number, string][]): Note {
    const base = createNote();
    return {
      ...base,
      id,
      blocos: posicoes.map(([x, y, texto]) => ({ ...criarBloco(x, y), texto })),
    };
  }

  it('o bloco que ocupa o mesmo lugar mantém o id que estava na tela', () => {
    const naTela = comBlocos('a', [15, 15, 'Anatomia']);
    const doDisco = comBlocos('a', [15, 15, 'Anatomia']);

    const junta = preservarIdsDosBlocos(doDisco, naTela);
    expect(junta.blocos[0].id).toBe(naTela.blocos[0].id);
  });

  it('bloco em lugar novo fica com o id que veio do disco', () => {
    const naTela = comBlocos('a', [15, 15, 'Anatomia']);
    const doDisco = comBlocos('a', [15, 15, 'Anatomia'], [15, 400, 'de fora']);

    const junta = preservarIdsDosBlocos(doDisco, naTela);
    expect(junta.blocos[0].id).toBe(naTela.blocos[0].id);
    expect(junta.blocos[1].id).toBe(doDisco.blocos[1].id);
  });

  it('dois blocos nunca herdam o mesmo id: seriam o mesmo bloco para o React', () => {
    const naTela = comBlocos('a', [15, 15, 'um']);
    const doDisco = comBlocos('a', [15, 15, 'um'], [15, 15, 'outro no mesmo lugar']);

    const ids = preservarIdsDosBlocos(doDisco, naTela).blocos.map((b) => b.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('nota que não estava na tela passa como veio', () => {
    const doDisco = comBlocos('a', [15, 15, 'Anatomia']);
    expect(preservarIdsDosBlocos(doDisco, undefined)).toBe(doDisco);
  });

  it('na junção, quem lê a pasta de novo continua com os mesmos blocos', () => {
    const naTela = comBlocos('a', [15, 15, 'Anatomia']);
    const doDisco = comBlocos('a', [15, 15, 'Anatomia editada por fora']);

    const { notas } = juntarComDisco([naTela], [doDisco], nenhuma);
    expect(notas[0].blocos[0].id).toBe(naTela.blocos[0].id);
    expect(notas[0].blocos[0].texto).toBe('Anatomia editada por fora');
  });
});
