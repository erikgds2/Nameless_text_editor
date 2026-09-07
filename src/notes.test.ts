import { describe, expect, it, beforeEach } from 'vitest';
import { createNote, deriveTitle, loadNotes, saveNotes } from './notes';

beforeEach(() => localStorage.clear());

describe('deriveTitle', () => {
  it('usa a primeira linha com conteudo', () => {
    expect(deriveTitle('\n\n  Imperativo categorico\ncorpo')).toBe('Imperativo categorico');
  });

  it('cai no rotulo padrao quando so ha espaco em branco', () => {
    expect(deriveTitle('   \n\n ')).toBe('Nota sem título');
  });
});

describe('persistencia', () => {
  it('devolve o que foi salvo', () => {
    const note = createNote();
    saveNotes([note]);
    expect(loadNotes()).toEqual([note]);
  });

  it('devolve lista vazia quando o armazenamento esta corrompido', () => {
    localStorage.setItem('editor-sem-nome:notes:v1', '{nao é json');
    expect(loadNotes()).toEqual([]);
  });
});
