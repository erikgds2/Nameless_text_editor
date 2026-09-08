import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Editor from './Editor';
import { createNote, type Note } from '../notes';

function comTexto(note: Note, texto: string): Note {
  return { ...note, blocos: [{ ...note.blocos[0], texto }] };
}

// aceita qualquer prop do Editor: o helper anterior repassava só duas, e o
// resto era descartado em silêncio — testes passavam sem testar nada
function montar(overrides: Partial<Parameters<typeof Editor>[0]> = {}) {
  const props = {
    note: createNote() as Note | null,
    preview: true,
    onChange: vi.fn(),
    onDelete: vi.fn(),
    onMudarTipo: vi.fn(),
    onAlternarPreview: vi.fn(),
    onColarImagem: vi.fn(async () => 'imagem.png'),
    temaEscuro: true,
    ...overrides,
  };
  render(<Editor {...props} />);
  return props;
}

describe('Editor', () => {
  it('sem nota, mostra "Nenhuma nota aberta"', () => {
    montar({ note: null });

    expect(screen.getByText('Nenhuma nota aberta')).toBeInTheDocument();
  });

  it('com nota, mostra o título derivado da primeira linha', () => {
    const nota = comTexto(createNote(), 'Título da nota\nresto do corpo');
    montar({ note: nota });

    expect(screen.getByRole('heading', { name: 'Título da nota', level: 1 })).toBeInTheDocument();
  });

  it('em nota Markdown com preview ligado, o painel de pré-visualização mostra o texto renderizado', () => {
    const nota = comTexto(createNote('markdown'), 'Notas rápidas\n# Título\ncorpo do texto');
    montar({ note: nota, preview: true });

    expect(screen.getByRole('heading', { name: 'Título', level: 1 })).toBeInTheDocument();
  });

  it('em nota do tipo texto, a pré-visualização não aparece, mesmo com preview ligado', () => {
    const nota = comTexto(createNote('texto'), 'Notas rápidas\n# Não vira título\ncorpo do texto');
    montar({ note: nota, preview: true });

    // só o título do editor (derivado da primeira linha) é h1; o texto que
    // seria um cabeçalho na pré-visualização não pode aparecer como tal
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: 'Não vira título' })).not.toBeInTheDocument();
  });

  it('clicar em "Texto" chama onMudarTipo com \'texto\'', async () => {
    const user = userEvent.setup();
    const nota = comTexto(createNote('markdown'), 'Nota');
    const props = montar({ note: nota });

    await user.click(screen.getByRole('button', { name: 'Texto' }));

    expect(props.onMudarTipo).toHaveBeenCalledWith('texto');
  });

  it('o botão Excluir só apaga no segundo clique', async () => {
    const user = userEvent.setup();
    const nota = comTexto(createNote(), 'Nota a excluir');
    const props = montar({ note: nota });

    const botao = screen.getByRole('button', { name: 'Excluir' });
    await user.click(botao);

    expect(props.onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(props.onDelete).toHaveBeenCalledWith(nota.id);
  });

  it('o rodapé conta palavras, caracteres e linhas corretamente', () => {
    const nota = comTexto(createNote(), 'uma linha\noutra linha aqui');
    montar({ note: nota });

    const texto = 'uma linha\noutra linha aqui';
    expect(screen.getByText('5 palavras')).toBeInTheDocument();
    expect(screen.getByText(`${texto.length} caracteres`)).toBeInTheDocument();
    expect(screen.getByText('2 linhas')).toBeInTheDocument();
  });
});

describe('recado passageiro', () => {
  it('mostra o aviso quando algo falha em silêncio', () => {
    montar({ note: comTexto(createNote(), 'Uma nota'), recado: 'Não foi possível guardar a imagem.' });
    expect(screen.getByText('Não foi possível guardar a imagem.')).toBeInTheDocument();
  });

  it('sem aviso, o rodapé fica só com os contadores', () => {
    montar({ note: comTexto(createNote(), 'Uma nota') });
    expect(screen.queryByText(/Não foi possível guardar/)).toBeNull();
  });
});
