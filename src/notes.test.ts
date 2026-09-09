import { describe, expect, it, beforeEach } from 'vitest';
import {
  createNote,
  deriveTitle,
  duplicarNota,
  loadNotes,
  saveNotes,
  textoDaNota,
  tituloDoDia,
  trocarTitulo,
  type Note,
} from './notes';
import { criarBloco } from './canvas';

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

describe('trocarTitulo', () => {
  function comBlocos(...textos: string[]) {
    return textos.map((texto, i) => ({ ...criarBloco(48, i * 200), texto }));
  }

  it('troca a primeira linha com conteúdo', () => {
    const blocos = trocarTitulo(comBlocos('Anatomia\nresto do corpo'), 'Fêmur');
    expect(blocos[0].texto).toBe('Fêmur\nresto do corpo');
  });

  it('a marcação da linha fica de pé', () => {
    expect(trocarTitulo(comBlocos('# Anatomia'), 'Fêmur')[0].texto).toBe('# Fêmur');
    expect(trocarTitulo(comBlocos('- Anatomia'), 'Fêmur')[0].texto).toBe('- Fêmur');
    expect(trocarTitulo(comBlocos('> Anatomia'), 'Fêmur')[0].texto).toBe('> Fêmur');
  });

  it('o título é o do bloco mais alto na página, não o do primeiro criado', () => {
    const blocos = [
      { ...criarBloco(48, 400), texto: 'lá embaixo' },
      { ...criarBloco(48, 40), texto: 'lá em cima' },
    ];
    const trocados = trocarTitulo(blocos, 'Novo');
    expect(trocados[1].texto).toBe('Novo');
    expect(trocados[0].texto).toBe('lá embaixo');
  });

  it('linha em branco antes do texto não vira o título', () => {
    expect(trocarTitulo(comBlocos('\n\nAnatomia'), 'Fêmur')[0].texto).toBe('\n\nFêmur');
  });

  it('nota inteiramente vazia continua vazia', () => {
    const blocos = comBlocos('');
    expect(trocarTitulo(blocos, 'Fêmur')).toEqual(blocos);
  });

  it('o título novo é o que deriveTitle passa a devolver', () => {
    const blocos = trocarTitulo(comBlocos('# Anatomia\ncorpo'), 'Fêmur');
    expect(deriveTitle(textoDaNota(blocos))).toBe('Fêmur');
  });
});

describe('duplicarNota', () => {
  function nota(texto: string): Note {
    const base = createNote();
    return { ...base, pinned: true, blocos: [{ ...base.blocos[0], texto }] };
  }

  it('a cópia diz que é cópia no título', () => {
    const copia = duplicarNota(nota('# Anatomia\ncorpo'));
    expect(deriveTitle(textoDaNota(copia.blocos))).toBe('Anatomia (cópia)');
  });

  it('o corpo vem inteiro junto', () => {
    const copia = duplicarNota(nota('Anatomia\nsegunda linha'));
    expect(textoDaNota(copia.blocos)).toBe('Anatomia (cópia)\nsegunda linha');
  });

  it('id novo, e blocos com ids novos: duas notas não podem compartilhar bloco', () => {
    const original = nota('Anatomia');
    const copia = duplicarNota(original);

    expect(copia.id).not.toBe(original.id);
    expect(copia.blocos[0].id).not.toBe(original.blocos[0].id);
  });

  it('a cópia não nasce fixada', () => {
    expect(duplicarNota(nota('Anatomia')).pinned).toBe(false);
  });

  it('o original não é tocado', () => {
    const original = nota('Anatomia');
    duplicarNota(original);
    expect(original.blocos[0].texto).toBe('Anatomia');
  });
});

describe('tituloDoDia', () => {
  it('é a data em ISO, com mês e dia de dois dígitos', () => {
    expect(tituloDoDia(new Date(2026, 8, 9))).toBe('2026-09-09');
    expect(tituloDoDia(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('usa o dia local, e não o UTC: quem escreve à noite não pula para amanhã', () => {
    // 23h do dia 9 em fuso negativo já seria dia 10 em UTC
    expect(tituloDoDia(new Date(2026, 8, 9, 23, 30))).toBe('2026-09-09');
  });

  it('serve de título de verdade: deriveTitle devolve ele mesmo', () => {
    const titulo = tituloDoDia(new Date(2026, 8, 9));
    expect(deriveTitle(titulo)).toBe(titulo);
  });
});

describe('título de nota que começa com figura', () => {
  it('a marcação da imagem não vira o nome da nota', () => {
    expect(deriveTitle('![](anexos/abc.png)\nAnatomia do fêmur')).toBe('Anatomia do fêmur');
  });

  it('com origem também', () => {
    expect(deriveTitle('[![](anexos/abc.png)](https://exemplo.org)\nAnatomia')).toBe('Anatomia');
  });

  it('nota que é só uma figura não fica sem nome nenhum', () => {
    expect(deriveTitle('![](anexos/abc.png)')).toBe('Nota sem título');
  });

  it('texto que menciona uma imagem no meio continua sendo título', () => {
    expect(deriveTitle('veja ![](anexos/abc.png) aqui')).toBe('veja ![](anexos/abc.png) aqui');
  });
});
