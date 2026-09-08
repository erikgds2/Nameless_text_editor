import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
