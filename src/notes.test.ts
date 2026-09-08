import { describe, expect, it, beforeEach } from 'vitest';
import { createNote, deriveTitle, loadNotes, saveNotes, textoDaNota } from './notes';

beforeEach(() => localStorage.clear());

const CHAVE = 'editor-sem-nome:notes:v1';

describe('deriveTitle', () => {
  it('usa a primeira linha com conteudo', () => {
    expect(deriveTitle('\n\n  Imperativo categorico\ncorpo')).toBe('Imperativo categorico');
  });

  it('cai no rotulo padrao quando so ha espaco em branco', () => {
    expect(deriveTitle('   \n\n ')).toBe('Nota sem título');
  });

  it('tira a marcacao do Markdown: o titulo e o texto, nao os sinais', () => {
    expect(deriveTitle('# Revisão de Cálculo I')).toBe('Revisão de Cálculo I');
    expect(deriveTitle('### Terceiro nível')).toBe('Terceiro nível');
    expect(deriveTitle('- item de lista')).toBe('item de lista');
    expect(deriveTitle('1. primeiro')).toBe('primeiro');
    expect(deriveTitle('> citação')).toBe('citação');
    expect(deriveTitle('**tudo em negrito**')).toBe('tudo em negrito');
    expect(deriveTitle('`código`')).toBe('código');
  });

  it('preserva sublinhado, que e caractere legitimo de nome', () => {
    expect(deriveTitle('meu_arquivo importante')).toBe('meu_arquivo importante');
  });

  it('nao devolve titulo vazio quando a linha era so marcacao', () => {
    expect(deriveTitle('***')).toBe('Nota sem título');
  });
});

describe('persistencia', () => {
  it('devolve o que foi salvo', () => {
    const note = createNote();
    saveNotes([note]);
    expect(loadNotes()).toEqual([note]);
  });

  it('devolve lista vazia quando o armazenamento esta corrompido', () => {
    localStorage.setItem(CHAVE, '{nao é json');
    expect(loadNotes()).toEqual([]);
  });

  it('nota nova ja nasce com um bloco para escrever', () => {
    expect(createNote().blocos).toHaveLength(1);
  });
});

describe('migração de notas antigas', () => {
  it('converte o campo body num bloco', () => {
    localStorage.setItem(
      CHAVE,
      JSON.stringify([
        { id: 'antiga', body: 'Kant\n\nO imperativo', createdAt: 1, updatedAt: 2, pinned: false },
      ]),
    );

    const [nota] = loadNotes();
    expect(nota.blocos).toHaveLength(1);
    expect(nota.blocos[0].texto).toBe('Kant\n\nO imperativo');
    expect(textoDaNota(nota.blocos)).toBe('Kant\n\nO imperativo');
  });

  it('preserva pinned e datas na migração', () => {
    localStorage.setItem(
      CHAVE,
      JSON.stringify([{ id: 'x', body: 'a', createdAt: 10, updatedAt: 20, pinned: true }]),
    );

    const [nota] = loadNotes();
    expect(nota.pinned).toBe(true);
    expect(nota.createdAt).toBe(10);
    expect(nota.updatedAt).toBe(20);
  });

  it('não mexe em nota que já tem blocos', () => {
    const blocos = [{ id: 'b1', x: 10, y: 20, largura: 300, altura: 120, texto: 'pronto' }];
    localStorage.setItem(
      CHAVE,
      JSON.stringify([{ id: 'y', blocos, createdAt: 1, updatedAt: 2, pinned: false }]),
    );

    expect(loadNotes()[0].blocos).toEqual(blocos);
  });
});
