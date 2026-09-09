import { describe, expect, it } from 'vitest';
import { fixadasEmOrdem, mover, ordenarSoltas, proximaOrdem, reordenarFixadas } from './ordenacao';
import { createNote, type Note } from './notes';

function nota(id: string, extras: Partial<Note> = {}): Note {
  return { ...createNote(), id, createdAt: 0, ...extras };
}

const ids = (notas: Note[]) => notas.map((n) => n.id);

describe('mover', () => {
  it('leva o item para frente', () => {
    expect(mover(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('leva o item para tras', () => {
    expect(mover(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('mover para a propria posicao nao muda nada', () => {
    expect(mover(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
  });

  it('nao muta a lista recebida', () => {
    const original = ['a', 'b', 'c'];
    mover(original, 0, 2);
    expect(original).toEqual(['a', 'b', 'c']);
  });

  it('indice fora da lista devolve a lista como estava', () => {
    expect(mover(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
    expect(mover(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(mover([], 0, 0)).toEqual([]);
  });
});

describe('fixadasEmOrdem', () => {
  it('devolve so as fixadas, na ordem escolhida', () => {
    const notas = [
      nota('solta'),
      nota('segunda', { pinned: true, ordem: 1 }),
      nota('primeira', { pinned: true, ordem: 0 }),
    ];
    expect(ids(fixadasEmOrdem(notas))).toEqual(['primeira', 'segunda']);
  });

  it('quem ainda nao tem ordem vai para o fim, pela ordem de criacao', () => {
    const notas = [
      nota('nova', { pinned: true, createdAt: 200 }),
      nota('antiga', { pinned: true, createdAt: 100 }),
      nota('numerada', { pinned: true, ordem: 0 }),
    ];
    expect(ids(fixadasEmOrdem(notas))).toEqual(['numerada', 'antiga', 'nova']);
  });

  it('sem nenhuma fixada devolve lista vazia', () => {
    expect(fixadasEmOrdem([nota('a'), nota('b')])).toEqual([]);
  });

  it('nao muta a lista recebida', () => {
    const notas = [nota('b', { pinned: true, ordem: 1 }), nota('a', { pinned: true, ordem: 0 })];
    const antes = ids(notas);
    fixadasEmOrdem(notas);
    expect(ids(notas)).toEqual(antes);
  });
});

describe('reordenarFixadas', () => {
  const base = [
    nota('a', { pinned: true, ordem: 0 }),
    nota('b', { pinned: true, ordem: 1 }),
    nota('c', { pinned: true, ordem: 2 }),
    nota('solta'),
  ];

  it('arrastar a primeira para o lugar da terceira', () => {
    const resultado = reordenarFixadas(base, 'a', 'c');
    expect(ids(fixadasEmOrdem(resultado))).toEqual(['b', 'c', 'a']);
  });

  it('arrastar a ultima para o topo', () => {
    const resultado = reordenarFixadas(base, 'c', 'a');
    expect(ids(fixadasEmOrdem(resultado))).toEqual(['c', 'a', 'b']);
  });

  it('renumera sem buracos e sem empate', () => {
    const ordens = reordenarFixadas(base, 'c', 'a')
      .filter((n) => n.pinned)
      .map((n) => n.ordem);
    expect([...ordens].sort()).toEqual([0, 1, 2]);
  });

  it('nao encosta nas notas soltas', () => {
    const resultado = reordenarFixadas(base, 'a', 'c');
    expect(resultado.find((n) => n.id === 'solta')).toBe(base.find((n) => n.id === 'solta'));
  });

  it('id que nao existe devolve as notas como estavam', () => {
    expect(reordenarFixadas(base, 'fantasma', 'a')).toBe(base);
    expect(reordenarFixadas(base, 'a', 'fantasma')).toBe(base);
  });

  it('arrastar sobre uma nota nao fixada nao faz nada', () => {
    expect(reordenarFixadas(base, 'a', 'solta')).toBe(base);
  });

  it('funciona quando ninguem tinha ordem ainda', () => {
    const semOrdem = [
      nota('x', { pinned: true, createdAt: 1 }),
      nota('y', { pinned: true, createdAt: 2 }),
    ];
    expect(ids(fixadasEmOrdem(reordenarFixadas(semOrdem, 'y', 'x')))).toEqual(['y', 'x']);
  });
});

describe('proximaOrdem', () => {
  it('a primeira fixada recebe zero', () => {
    expect(proximaOrdem([nota('a')])).toBe(0);
    expect(proximaOrdem([])).toBe(0);
  });

  it('a nota nova entra depois da ultima fixada', () => {
    const notas = [nota('a', { pinned: true, ordem: 0 }), nota('b', { pinned: true, ordem: 4 })];
    expect(proximaOrdem(notas)).toBe(5);
  });

  it('ignora a ordem de quem nao esta fixada', () => {
    const notas = [nota('velha', { ordem: 99 }), nota('a', { pinned: true, ordem: 1 })];
    expect(proximaOrdem(notas)).toBe(2);
  });
});

describe('ordenarSoltas', () => {
  function comTitulo(id: string, titulo: string, criada: number, editada: number): Note {
    const base = createNote();
    return {
      ...base,
      id,
      createdAt: criada,
      updatedAt: editada,
      blocos: [{ ...base.blocos[0], texto: titulo }],
    };
  }

  const notas = [
    comTitulo('b', 'Zebra', 100, 300),
    comTitulo('a', 'Ácido', 200, 100),
    comTitulo('c', 'Kant', 300, 200),
  ];

  it('por edição, a mais recente primeiro', () => {
    expect(ordenarSoltas(notas, 'edicao').map((n) => n.id)).toEqual(['b', 'c', 'a']);
  });

  it('por criação, a mais nova primeiro', () => {
    expect(ordenarSoltas(notas, 'criacao').map((n) => n.id)).toEqual(['c', 'a', 'b']);
  });

  it('por título, em ordem de dicionário — e acento não joga a palavra para o fim', () => {
    expect(ordenarSoltas(notas, 'titulo').map((n) => n.id)).toEqual(['a', 'c', 'b']);
  });

  it('as fixadas ficam de fora: a ordem delas é a que foi arrastada à mão', () => {
    const comFixada = [...notas, { ...comTitulo('d', 'Fixada', 400, 400), pinned: true }];
    expect(ordenarSoltas(comFixada, 'edicao').map((n) => n.id)).not.toContain('d');
  });

  it('não mexe no array que recebeu', () => {
    const copia = [...notas];
    ordenarSoltas(notas, 'titulo');
    expect(notas).toEqual(copia);
  });
});
