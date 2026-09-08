import { useState } from 'react';
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
  render(
    <Canvas
      blocos={blocos}
      tipo={tipo}
      onChange={onChange}
      onColarImagem={onColarImagem}
      titulos={['Aula de Kant', 'Limites e continuidade']}
    />,
  );
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
      <Canvas blocos={[bloco('# título')]} tipo="markdown" onChange={vi.fn()} onColarImagem={vi.fn()} titulos={[]} />,
    );
    expect(container.querySelector('.bloco__espelho')).not.toBeNull();
  });

  it('nota de texto puro escreve direto, sem espelho', () => {
    const { container } = render(
      <Canvas blocos={[bloco('# título')]} tipo="texto" onChange={vi.fn()} onColarImagem={vi.fn()} titulos={[]} />,
    );
    expect(container.querySelector('.bloco__espelho')).toBeNull();
    expect(container.querySelector('.bloco--puro')).not.toBeNull();
  });
});

/**
 * No user-event, `[` e `{` abrem descrições de tecla (`{Enter}`, `[Backspace]`).
 * Para digitá-los literalmente é preciso dobrá-los — sem isto, `'[['` digita um
 * colchete só e o teste mede outra coisa.
 */
const digitar = (campo: HTMLElement, texto: string) =>
  userEvent.type(campo, texto.replace(/[[{]/g, '$&$&'));

/**
 * O Canvas é controlado: quem guarda o texto é o pai. Sem um pai de verdade,
 * digitar não acumula — cada tecla volta ao valor da prop — e um teste de
 * digitação estaria medindo o nada.
 */
function montarVivo(inicial: Bloco[], tipo: 'markdown' | 'texto' = 'markdown') {
  const onColarImagem = vi.fn(async () => 'imagem.png');
  function Pai() {
    const [blocos, setBlocos] = useState(inicial);
    return (
      <Canvas
        blocos={blocos}
        tipo={tipo}
        onChange={setBlocos}
        onColarImagem={onColarImagem}
        titulos={['Aula de Kant', 'Limites e continuidade']}
      />
    );
  }
  render(<Pai />);
}

describe('sugestões de ligação', () => {
  it('digitar [[ oferece as outras notas', async () => {
    montarVivo([bloco('')]);
    await digitar(screen.getByRole('textbox'), 'ver [[');
    expect(screen.getByRole('button', { name: 'Aula de Kant' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limites e continuidade' })).toBeInTheDocument();
  });

  it('o que já foi digitado filtra a lista', async () => {
    montarVivo([bloco('')]);
    await digitar(screen.getByRole('textbox'), '[[lim');
    expect(screen.getByRole('button', { name: 'Limites e continuidade' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aula de Kant' })).toBeNull();
  });

  it('sem [[ não aparece lista nenhuma', async () => {
    montarVivo([bloco('')]);
    await digitar(screen.getByRole('textbox'), 'texto comum');
    expect(screen.queryByRole('button', { name: 'Aula de Kant' })).toBeNull();
  });

  it('nota de texto puro não sugere ligação', async () => {
    montarVivo([bloco('')], 'texto');
    await digitar(screen.getByRole('textbox'), '[[');
    expect(screen.queryByRole('button', { name: 'Aula de Kant' })).toBeNull();
  });

  it('Esc fecha a lista sem escolher nada', async () => {
    montarVivo([bloco('')]);
    const campo = screen.getByRole('textbox');
    await digitar(campo, '[[');
    expect(screen.getByRole('button', { name: 'Aula de Kant' })).toBeInTheDocument();

    await userEvent.type(campo, '{Escape}');
    expect(screen.queryByRole('button', { name: 'Aula de Kant' })).toBeNull();
    expect(campo).toHaveValue('[[');
  });

  it('escolher uma nota fecha a ligação no texto', async () => {
    montarVivo([bloco('')]);
    const campo = screen.getByRole('textbox');
    await digitar(campo, 'ver [[kant');
    await userEvent.click(screen.getByRole('button', { name: 'Aula de Kant' }));
    expect(campo).toHaveValue('ver [[Aula de Kant]]');
  });

  it('seta e Enter escolhem sem tocar no mouse', async () => {
    montarVivo([bloco('')]);
    const campo = screen.getByRole('textbox');
    await digitar(campo, '[[');
    await userEvent.type(campo, '{ArrowDown}{Enter}');
    expect(campo).toHaveValue('[[Limites e continuidade]]');
  });
});
