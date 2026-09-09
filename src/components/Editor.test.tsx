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
    acento: '#d8934a',
    divisoria: 50,
    onMudarDivisoria: vi.fn(),
    backlinks: [] as { id: string; titulo: string }[],
    titulos: [] as string[],
    existeNota: () => true,
    onAbrirLigacao: vi.fn(),
    onAbrirNota: vi.fn(),
    onSairDoBloco: vi.fn(),
    onRenomear: vi.fn(),
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

describe('backlinks', () => {
  const quemCita = [
    { id: 'a', titulo: 'Aula de Kant' },
    { id: 'b', titulo: 'Leituras da semana' },
  ];

  it('lista quem aponta para esta nota', () => {
    montar({ note: comTexto(createNote(), 'Imperativo'), backlinks: quemCita });
    expect(screen.getByText('Apontam para esta nota')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aula de Kant' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leituras da semana' })).toBeInTheDocument();
  });

  it('sem ninguém citando, a faixa não aparece', () => {
    montar({ note: comTexto(createNote(), 'Imperativo'), backlinks: [] });
    expect(screen.queryByText('Apontam para esta nota')).toBeNull();
  });

  it('clicar num backlink abre aquela nota', async () => {
    const props = montar({ note: comTexto(createNote(), 'Imperativo'), backlinks: quemCita });
    await userEvent.click(screen.getByRole('button', { name: 'Aula de Kant' }));
    expect(props.onAbrirNota).toHaveBeenCalledWith('a');
  });
});

describe('busca dentro da nota', () => {
  /** Uma nota com vários blocos, para provar que a busca atravessa a página. */
  function comBlocos(...textos: string[]): Note {
    const nota = createNote('markdown');
    return {
      ...nota,
      blocos: textos.map((texto, i) => ({ ...nota.blocos[0], id: `b${i}`, y: i * 200, texto })),
    };
  }

  async function abrir(user: ReturnType<typeof userEvent.setup>) {
    await user.keyboard('{Control>}f{/Control}');
    return screen.getByRole('searchbox', { name: 'Procurar nesta nota' });
  }

  it('Ctrl+F abre a barra de busca da nota', async () => {
    const user = userEvent.setup();
    montar({ note: comBlocos('Kant e o dever') });

    expect(screen.queryByRole('searchbox', { name: 'Procurar nesta nota' })).toBeNull();
    expect(await abrir(user)).toHaveFocus();
  });

  it('sem nota aberta não há o que procurar', async () => {
    const user = userEvent.setup();
    montar({ note: null });

    await user.keyboard('{Control>}f{/Control}');
    expect(screen.queryByRole('searchbox', { name: 'Procurar nesta nota' })).toBeNull();
  });

  it('conta as ocorrências da nota inteira, não as do bloco', async () => {
    const user = userEvent.setup();
    montar({ note: comBlocos('dever e dever', 'outro dever aqui'), preview: false });

    await user.type(await abrir(user), 'dever');
    expect(screen.getByText('1 de 3')).toBeInTheDocument();
  });

  it('Enter anda para a próxima e Shift+Enter volta, dando a volta no fim', async () => {
    const user = userEvent.setup();
    montar({ note: comBlocos('dever e dever'), preview: false });

    await user.type(await abrir(user), 'dever');
    await user.keyboard('{Enter}');
    expect(screen.getByText('2 de 2')).toBeInTheDocument();

    await user.keyboard('{Enter}');
    expect(screen.getByText('1 de 2')).toBeInTheDocument();

    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(screen.getByText('2 de 2')).toBeInTheDocument();
  });

  it('termo que não existe na nota diz que não há nada', async () => {
    const user = userEvent.setup();
    montar({ note: comBlocos('Kant e o dever'), preview: false });

    await user.type(await abrir(user), 'Hegel');
    expect(screen.getByText('nada')).toBeInTheDocument();
  });

  it('a ocorrência visitada fica marcada, e só ela', async () => {
    const user = userEvent.setup();
    montar({ note: comBlocos('dever e dever'), preview: false });

    await user.type(await abrir(user), 'dever');
    expect(document.querySelectorAll('.achado')).toHaveLength(2);
    expect(document.querySelectorAll('.achado--atual')).toHaveLength(1);
  });

  it('apagar letras do termo não deixa a navegação apontar para fora da lista', async () => {
    const user = userEvent.setup();
    montar({ note: comBlocos('dever e dever', 'deveras'), preview: false });

    const campo = await abrir(user);
    await user.type(campo, 'dever');
    await user.keyboard('{Enter}{Enter}');
    expect(screen.getByText('3 de 3')).toBeInTheDocument();

    // "deveras" continua casando, mas "dever" some do segundo bloco: sobram duas
    await user.type(campo, 'as');
    expect(screen.getByText('1 de 1')).toBeInTheDocument();
  });

  it('Esc fecha a busca', async () => {
    const user = userEvent.setup();
    montar({ note: comBlocos('Kant e o dever'), preview: false });

    await user.type(await abrir(user), 'dever');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('searchbox', { name: 'Procurar nesta nota' })).toBeNull();
  });
});

describe('conflito com o arquivo', () => {
  it('sem conflito, nenhuma faixa aparece', () => {
    montar({ note: comTexto(createNote(), 'Uma nota') });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('com conflito, o aviso interrompe e oferece as duas saídas', () => {
    montar({ note: comTexto(createNote(), 'Uma nota'), conflito: true });

    expect(screen.getByRole('alert')).toHaveTextContent('mudou por fora');
    expect(screen.getByRole('button', { name: 'Ficar com o meu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar o do disco' })).toBeInTheDocument();
  });

  it('cada botão avisa quem cuida da nota', async () => {
    const props = montar({
      note: comTexto(createNote(), 'Uma nota'),
      conflito: true,
      onManterOMeu: vi.fn(),
      onUsarODoDisco: vi.fn(),
    });

    await userEvent.click(screen.getByRole('button', { name: 'Ficar com o meu' }));
    expect(props.onManterOMeu).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Usar o do disco' }));
    expect(props.onUsarODoDisco).toHaveBeenCalled();
  });
});

describe('renomear a nota', () => {
  it('clicar no título abre o campo com o nome atual', async () => {
    montar({ note: comTexto(createNote(), '# Anatomia\ncorpo'), preview: false });

    await userEvent.click(screen.getByRole('heading', { name: 'Anatomia', level: 1 }));
    expect(screen.getByRole('textbox', { name: 'Título da nota' })).toHaveValue('Anatomia');
  });

  it('Enter confirma e manda o nome novo', async () => {
    const props = montar({ note: comTexto(createNote(), '# Anatomia'), preview: false });

    await userEvent.click(screen.getByRole('heading', { level: 1 }));
    const campo = screen.getByRole('textbox', { name: 'Título da nota' });
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Fêmur{Enter}');

    expect(props.onRenomear).toHaveBeenCalledWith('Fêmur');
  });

  it('Esc desiste sem renomear nada', async () => {
    const props = montar({ note: comTexto(createNote(), '# Anatomia'), preview: false });

    await userEvent.click(screen.getByRole('heading', { level: 1 }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Título da nota' }), 'outro{Escape}');

    expect(props.onRenomear).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Anatomia', level: 1 })).toBeInTheDocument();
  });

  it('título em branco não apaga o nome da nota', async () => {
    const props = montar({ note: comTexto(createNote(), '# Anatomia'), preview: false });

    await userEvent.click(screen.getByRole('heading', { level: 1 }));
    const campo = screen.getByRole('textbox', { name: 'Título da nota' });
    await userEvent.clear(campo);
    await userEvent.type(campo, '   {Enter}');

    expect(props.onRenomear).not.toHaveBeenCalled();
  });

  it('confirmar o mesmo nome não mexe na nota', async () => {
    const props = montar({ note: comTexto(createNote(), '# Anatomia'), preview: false });

    await userEvent.click(screen.getByRole('heading', { level: 1 }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Título da nota' }), '{Enter}');

    expect(props.onRenomear).not.toHaveBeenCalled();
  });
});
