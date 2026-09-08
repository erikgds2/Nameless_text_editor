import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Ajustes from './Ajustes';
import { PADRAO, type Ajustes as AjustesTipo } from '../ajustes';

function montar(overrides: {
  ajustes?: AjustesTipo;
  pasta?: string | null;
} = {}) {
  const props = {
    ajustes: overrides.ajustes ?? { ...PADRAO },
    onMudar: vi.fn(),
    pasta: overrides.pasta ?? null,
    onAbrirPasta: vi.fn(),
    onTrocarPasta: vi.fn(),
    onTrocarFundo: vi.fn(),
    onFechar: vi.fn(),
  };
  render(<Ajustes {...props} />);
  return props;
}

describe('Ajustes', () => {
  it('mostra os três temas, e o tema atual aparece como selecionado', () => {
    montar({ ajustes: { ...PADRAO, tema: 'carvao' } });

    expect(screen.getByRole('button', { name: 'Acrílico' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Carvão' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Papel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Carvão' })).toHaveClass('opcao--on');
    expect(screen.getByRole('button', { name: 'Acrílico' })).not.toHaveClass('opcao--on');
  });

  it('clicar num tema chama onMudar com o ajuste novo e sem perder os outros campos', async () => {
    const user = userEvent.setup();
    const ajustes: AjustesTipo = { ...PADRAO, tema: 'acrilico', corpo: 17 };
    const props = montar({ ajustes });

    await user.click(screen.getByRole('button', { name: 'Papel' }));

    expect(props.onMudar).toHaveBeenCalledWith({ ...ajustes, tema: 'papel' });
  });

  it('clicar num tamanho de texto chama onMudar com o ajuste novo e sem perder os outros campos', async () => {
    const user = userEvent.setup();
    const ajustes: AjustesTipo = { ...PADRAO, corpo: 15, tema: 'papel' };
    const props = montar({ ajustes });

    await user.click(screen.getByRole('button', { name: '17' }));

    expect(props.onMudar).toHaveBeenCalledWith({ ...ajustes, corpo: 17 });
  });

  it('a tecla Esc chama onFechar', async () => {
    const user = userEvent.setup();
    const props = montar();

    await user.keyboard('{Escape}');

    expect(props.onFechar).toHaveBeenCalledTimes(1);
  });

  it('o botão de fechar chama onFechar', async () => {
    const user = userEvent.setup();
    const props = montar();

    await user.click(screen.getByTitle('Fechar (Esc)'));

    expect(props.onFechar).toHaveBeenCalledTimes(1);
  });

  it('quando pasta é null, a seção Arquivos não aparece', () => {
    montar({ pasta: null });

    expect(screen.queryByText('Arquivos')).not.toBeInTheDocument();
  });

  it('quando pasta tem valor, a seção Arquivos aparece com o caminho', () => {
    montar({ pasta: 'C:\\notas' });

    expect(screen.getByText('Arquivos')).toBeInTheDocument();
    expect(screen.getByText('C:\\notas')).toBeInTheDocument();
  });

  it('os atalhos listados incluem Ctrl + N e Ctrl + ,', () => {
    montar();

    expect(screen.getByText('Ctrl + N')).toBeInTheDocument();
    expect(screen.getByText('Ctrl + ,')).toBeInTheDocument();
  });
});

describe('escolha do fundo da janela', () => {
  it('só aparece no aplicativo instalado, onde há uma janela para trocar', () => {
    montar({ pasta: null });
    expect(screen.queryByRole('button', { name: 'Transparente' })).toBeNull();
  });

  it('oferece os dois fundos quando há pasta', () => {
    montar({ pasta: 'C:/notas' });
    expect(screen.getByRole('button', { name: 'Fosco' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Transparente' })).toBeInTheDocument();
  });

  it('os nomes não colidem com os do tema', () => {
    montar({ pasta: 'C:/notas' });
    // "Acrílico" é nome de tema; o fundo usa Fosco/Transparente para não haver
    // dois botões com o mesmo nome significando coisas diferentes
    expect(screen.getAllByRole('button', { name: 'Acrílico' })).toHaveLength(1);
  });

  it('escolher transparente avisa quem cuida da janela', async () => {
    const props = montar({ pasta: 'C:/notas' });
    await userEvent.click(screen.getByRole('button', { name: 'Transparente' }));
    expect(props.onTrocarFundo).toHaveBeenCalledWith('vidro');
  });

  it('o rótulo da opacidade diz o que ela faz em cada fundo', () => {
    montar({ pasta: 'C:/notas', ajustes: { ...PADRAO, fundo: 'vidro' } });
    expect(screen.getByText('Quanto menor, mais se enxerga o que está atrás')).toBeInTheDocument();
  });
});
