import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from './Sidebar';
import { createNote, type Note } from '../notes';

function comTexto(note: Note, texto: string): Note {
  return { ...note, blocos: [{ ...note.blocos[0], texto }] };
}

function montar(overrides: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  const props = {
    notes: [] as Note[],
    activeId: null,
    query: '',
    searchRef: createRef<HTMLInputElement>(),
    onSelect: vi.fn(),
    onQueryChange: vi.fn(),
    onNewNote: vi.fn(),
    onTogglePin: vi.fn(),
    onReordenar: vi.fn(),
    tags: [] as { tag: string; quantas: number }[],
    filtro: null as { tipo: 'tag'; tag: string } | { tipo: 'orfas' } | null,
    onFiltrar: vi.fn(),
    onLimparFiltro: vi.fn(),
    ...overrides,
  };
  render(<Sidebar {...props} />);
  return props;
}

describe('Sidebar', () => {
  it('lista os títulos das notas recebidas', () => {
    const notaUm = comTexto(createNote(), 'Primeira nota');
    const notaDois = comTexto(createNote(), 'Segunda nota');
    montar({ notes: [notaUm, notaDois] });

    expect(screen.getByText('Primeira nota')).toBeInTheDocument();
    expect(screen.getByText('Segunda nota')).toBeInTheDocument();
  });

  it('clicar numa nota chama onSelect com o id certo', async () => {
    const user = userEvent.setup();
    const nota = comTexto(createNote(), 'Nota clicável');
    const props = montar({ notes: [nota] });

    await user.click(screen.getByText('Nota clicável'));

    expect(props.onSelect).toHaveBeenCalledWith(nota.id);
  });

  it('digitar na busca chama onQueryChange com o texto digitado', async () => {
    const user = userEvent.setup();
    const props = montar();

    await user.type(screen.getByPlaceholderText('Buscar'), 'a');

    expect(props.onQueryChange).toHaveBeenCalledWith('a');
  });

  it('o botão de nova nota chama onNewNote', async () => {
    const user = userEvent.setup();
    const props = montar();

    await user.click(screen.getByTitle('Nova nota (Ctrl+N)'));

    expect(props.onNewNote).toHaveBeenCalledTimes(1);
  });

  it('clicar no alfinete chama onTogglePin com o id certo', async () => {
    const user = userEvent.setup();
    const nota = comTexto(createNote(), 'Nota com alfinete');
    const props = montar({ notes: [nota] });

    await user.click(screen.getByTitle('Fixar'));

    expect(props.onTogglePin).toHaveBeenCalledWith(nota.id);
  });

  it('sem notas e sem busca, mostra "Nenhuma nota ainda."', () => {
    montar({ notes: [], query: '' });

    expect(screen.getByText('Nenhuma nota ainda.')).toBeInTheDocument();
  });

  it('sem notas e com busca preenchida, mostra "Nenhuma nota encontrada."', () => {
    montar({ notes: [], query: 'busca' });

    expect(screen.getByText('Nenhuma nota encontrada.')).toBeInTheDocument();
  });

  it('o contador fica no singular com uma nota', () => {
    montar({ notes: [comTexto(createNote(), 'Única')] });

    expect(screen.getByText('1 nota')).toBeInTheDocument();
  });

  it('o contador fica no plural com mais de uma nota', () => {
    montar({ notes: [comTexto(createNote(), 'Uma'), comTexto(createNote(), 'Outra')] });

    expect(screen.getByText('2 notas')).toBeInTheDocument();
  });
});

describe('ordem das notas fixadas', () => {
  function fixada(titulo: string, id: string) {
    return { ...comTexto(createNote(), titulo), id, pinned: true };
  }

  it('só a nota fixada pode ser arrastada', () => {
    const props = montar({ notes: [fixada('Fixa', 'f'), comTexto(createNote(), 'Solta')] });
    const linhas = document.querySelectorAll('.noterow');
    expect(linhas[0].getAttribute('draggable')).toBe('true');
    expect(linhas[1].getAttribute('draggable')).toBe('false');
    expect(props.onReordenar).not.toHaveBeenCalled();
  });

  it('largar uma fixada sobre outra pede a troca de posição', () => {
    const props = montar({ notes: [fixada('Primeira', 'a'), fixada('Segunda', 'b')] });
    const [uma, outra] = document.querySelectorAll('.noterow');

    fireEvent.dragStart(uma);
    fireEvent.dragOver(outra);
    fireEvent.drop(outra);

    expect(props.onReordenar).toHaveBeenCalledWith('a', 'b');
  });

  it('largar a nota sobre ela mesma não faz nada', () => {
    const props = montar({ notes: [fixada('Primeira', 'a'), fixada('Segunda', 'b')] });
    const [uma] = document.querySelectorAll('.noterow');

    fireEvent.dragStart(uma);
    fireEvent.drop(uma);

    expect(props.onReordenar).not.toHaveBeenCalled();
  });
});

describe('tags e filtro', () => {
  const comTags = [
    comTexto(createNote(), '# Aula\nrever #anatomia'),
    comTexto(createNote(), '# Outra\nsem marca'),
  ];

  it('as tags do caderno viram botões', () => {
    montar({ notes: comTags, tags: [{ tag: 'anatomia', quantas: 1 }] });
    expect(screen.getByRole('button', { name: '#anatomia' })).toBeInTheDocument();
  });

  it('clicar numa tag pede o filtro dela', async () => {
    const props = montar({ notes: comTags, tags: [{ tag: 'anatomia', quantas: 1 }] });

    await userEvent.click(screen.getByRole('button', { name: '#anatomia' }));

    expect(props.onFiltrar).toHaveBeenCalledWith({ tipo: 'tag', tag: 'anatomia' });
  });

  it('com filtro em vigor, a lista de tags dá lugar ao aviso do filtro', () => {
    montar({
      notes: comTags,
      tags: [{ tag: 'anatomia', quantas: 1 }],
      filtro: { tipo: 'tag', tag: 'anatomia' },
    });

    expect(screen.getByText('#anatomia')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '#anatomia' })).toBeNull();
    expect(screen.getByRole('button', { name: 'limpar' })).toBeInTheDocument();
  });

  it('o filtro de órfãs se explica em palavras', () => {
    montar({ notes: comTags, filtro: { tipo: 'orfas' } });
    expect(screen.getByText('Ninguém aponta para estas')).toBeInTheDocument();
  });

  it('limpar avisa quem cuida da lista', async () => {
    const props = montar({ notes: comTags, filtro: { tipo: 'orfas' } });
    await userEvent.click(screen.getByRole('button', { name: 'limpar' }));
    expect(props.onLimparFiltro).toHaveBeenCalled();
  });

  it('caderno sem tag nenhuma não mostra faixa vazia', () => {
    montar({ notes: comTags, tags: [] });
    expect(document.querySelector('.tags')).toBeNull();
  });
});
