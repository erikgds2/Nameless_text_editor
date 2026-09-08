import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Canvas from './Canvas';
import { criarBloco, type Bloco } from '../canvas';

function bloco(texto: string, y = 0): Bloco {
  return { ...criarBloco(48, y), texto };
}

function montar(blocos: Bloco[], tipo: 'markdown' | 'texto' = 'markdown') {
  const onChange = vi.fn();
  const onColarImagem = vi.fn(async () => 'imagem.png');
  render(<Canvas blocos={blocos} tipo={tipo} onChange={onChange} onColarImagem={onColarImagem} />);
  return { onChange, onColarImagem };
}

describe('Canvas', () => {
  it('mostra um campo de escrita para cada bloco', () => {
    montar([bloco('primeiro'), bloco('segundo', 200)]);
    expect(screen.getByDisplayValue('primeiro')).toBeInTheDocument();
    expect(screen.getByDisplayValue('segundo')).toBeInTheDocument();
  });

  it('digitar avisa quem cuida da nota', async () => {
    const { onChange } = montar([bloco('')]);
    await userEvent.type(screen.getByRole('textbox'), 'a');
    expect(onChange).toHaveBeenCalled();
  });

  it('excluir um bloco remove só ele', async () => {
    const primeiro = bloco('fica');
    const segundo = bloco('sai', 200);
    const { onChange } = montar([primeiro, segundo]);

    const botoes = screen.getAllByRole('button', { name: 'Excluir este bloco' });
    await userEvent.click(botoes[1]);

    expect(onChange).toHaveBeenCalledWith([primeiro]);
  });

  it('o único bloco da nota não pode ser excluído', () => {
    montar([bloco('sozinho')]);
    expect(screen.queryByRole('button', { name: 'Excluir este bloco' })).toBeNull();
  });

  it('nota em Markdown ganha a camada de realce; nota de texto puro, não', () => {
    const { container } = render(
      <Canvas blocos={[bloco('# título')]} tipo="markdown" onChange={vi.fn()} onColarImagem={vi.fn()} />,
    );
    expect(container.querySelector('.bloco__espelho')).not.toBeNull();
  });

  it('nota de texto puro escreve direto, sem espelho', () => {
    const { container } = render(
      <Canvas blocos={[bloco('# título')]} tipo="texto" onChange={vi.fn()} onColarImagem={vi.fn()} />,
    );
    expect(container.querySelector('.bloco__espelho')).toBeNull();
    expect(container.querySelector('.bloco--puro')).not.toBeNull();
  });
});
