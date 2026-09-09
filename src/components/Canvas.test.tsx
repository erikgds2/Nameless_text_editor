import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      achados={[]}
      achadoAtual={null}
      trechos={{}}
      onSair={vi.fn()}
      onRecado={vi.fn()}
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
      <Canvas
        blocos={[bloco('# título')]}
        tipo="markdown"
        onChange={vi.fn()}
        onColarImagem={vi.fn()}
        titulos={[]}
        achados={[]}
        achadoAtual={null}
        trechos={{}}
        onSair={vi.fn()}
        onRecado={vi.fn()}
      />,
    );
    expect(container.querySelector('.bloco__espelho')).not.toBeNull();
  });

  it('nota de texto puro escreve direto, sem espelho', () => {
    const { container } = render(
      <Canvas
        blocos={[bloco('# título')]}
        tipo="texto"
        onChange={vi.fn()}
        onColarImagem={vi.fn()}
        titulos={[]}
        achados={[]}
        achadoAtual={null}
        trechos={{}}
        onSair={vi.fn()}
        onRecado={vi.fn()}
      />,
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
        achados={[]}
        achadoAtual={null}
        trechos={{}}
        onSair={vi.fn()}
        onRecado={vi.fn()}
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

describe('escolher a ligação sem perder texto', () => {
  it('digitar depressa e escolher não parte o texto ao meio', async () => {
    montarVivo([bloco('')]);
    const campo = screen.getByRole('textbox');
    // sem espera entre as teclas: é assim que o contexto guardado em estado
    // fica para trás e a substituição usa uma posição velha
    await userEvent.type(campo, 'ver [[[[Limites e contin', { delay: null });
    await userEvent.type(campo, '{Enter}', { delay: null });
    expect(campo).toHaveValue('ver [[Limites e continuidade]]');
  });

  it('o texto ao redor da ligação continua intacto', async () => {
    montarVivo([bloco('')]);
    const campo = screen.getByRole('textbox');
    await digitar(campo, 'antes [[kant');
    await userEvent.type(campo, '{Enter}');
    await digitar(campo, ' depois');
    expect(campo).toHaveValue('antes [[Aula de Kant]] depois');
  });

  it('escolher no meio do texto não come o que vem depois', async () => {
    montarVivo([bloco('fim da frase')]);
    const campo = screen.getByRole('textbox');
    // o type põe o cursor no fim a cada chamada, então digitar e escolher
    // precisam acontecer na mesma: senão o cursor pula e a lista fecha
    await userEvent.type(campo, '[[[[lim{Enter}', {
      initialSelectionStart: 0,
      initialSelectionEnd: 0,
    });
    expect(campo).toHaveValue('[[Limites e continuidade]]fim da frase');
  });
});

describe('figura colada na página', () => {
  /** A área de transferência do navegador, no que o componente lê dela. */
  function areaDeTransferencia(arquivo: File | null, html = '') {
    return {
      items: arquivo
        ? [{ kind: 'file', type: arquivo.type, getAsFile: () => arquivo }]
        : [{ kind: 'string', type: 'text/plain', getAsFile: () => null }],
      getData: (tipo: string) => (tipo === 'text/html' ? html : ''),
    };
  }

  function png() {
    return new File([new Uint8Array([137, 80, 78, 71])], 'print.png', { type: 'image/png' });
  }

  function montarComEspiao(blocos: Bloco[], tipo: 'markdown' | 'texto' = 'markdown') {
    const onChange = vi.fn();
    const onColarImagem = vi.fn(async () => 'abc123.png');
    render(
      <Canvas
        blocos={blocos}
        tipo={tipo}
        onChange={onChange}
        onColarImagem={onColarImagem}
        titulos={[]}
        achados={[]}
        achadoAtual={null}
        trechos={{}}
        onSair={vi.fn()}
        onRecado={vi.fn()}
      />,
    );
    return { onChange, onColarImagem };
  }

  it('colada numa seção vazia, a figura ocupa essa seção', async () => {
    const vazio = bloco('');
    const { onChange, onColarImagem } = montarComEspiao([vazio]);

    fireEvent.paste(screen.getByRole('textbox'), { clipboardData: areaDeTransferencia(png()) });

    await waitFor(() => expect(onColarImagem).toHaveBeenCalled());
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        expect.objectContaining({ id: vazio.id, imagem: { src: 'anexos/abc123.png' } }),
      ]),
    );
    // a figura é da seção: o texto dela não é usado para guardar a foto
    const [depois] = onChange.mock.calls.at(-1) as [Bloco[]];
    expect(depois[0].texto).toBe('');
  });

  it('colada num bloco com texto, a figura fica NESSE bloco, e não num quadrado novo', async () => {
    const escrito = { ...bloco('Anatomia do fêmur'), y: 100, altura: 120 };
    const { onChange } = montarComEspiao([escrito]);

    fireEvent.paste(screen.getByRole('textbox'), { clipboardData: areaDeTransferencia(png()) });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const [depois] = onChange.mock.calls.at(-1) as [Bloco[]];

    expect(depois).toHaveLength(1);
    expect(depois[0].id).toBe(escrito.id);
    expect(depois[0].imagem).toEqual({ src: 'anexos/abc123.png' });
    // o texto que já estava lá fica intacto
    expect(depois[0].texto).toBe('Anatomia do fêmur');
    // e o bloco cresce para a foto caber sem empurrar o que estava escrito
    expect(depois[0].altura).toBeGreaterThan(escrito.altura);
  });

  it('seção que já tem foto: a segunda vira outra seção, logo abaixo', async () => {
    const comFigura = {
      ...bloco('Anatomia'),
      altura: 300,
      imagem: { src: 'anexos/ja-tinha.png' },
    };
    const { onChange } = montarComEspiao([comFigura]);

    fireEvent.paste(screen.getByRole('textbox'), { clipboardData: areaDeTransferencia(png()) });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const [depois] = onChange.mock.calls.at(-1) as [Bloco[]];

    expect(depois).toHaveLength(2);
    expect(depois[0].imagem).toEqual({ src: 'anexos/ja-tinha.png' });
    expect(depois[1].imagem).toEqual({ src: 'anexos/abc123.png' });
    expect(depois[1].y).toBeGreaterThan(comFigura.y + comFigura.altura);
  });

  it('a origem do print, quando existe, entra na marcação', async () => {
    const { onChange } = montarComEspiao([bloco('')]);

    fireEvent.paste(screen.getByRole('textbox'), {
      clipboardData: areaDeTransferencia(png(), `<img src="https://exemplo.org/femur.png">`),
    });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const [depois] = onChange.mock.calls.at(-1) as [Bloco[]];
    expect(depois[0].imagem).toEqual({
      src: 'anexos/abc123.png',
      fonte: 'https://exemplo.org/femur.png',
    });
  });

  it('colagem sem imagem nenhuma não mexe na nota', async () => {
    const { onChange, onColarImagem } = montarComEspiao([bloco('')]);

    fireEvent.paste(screen.getByRole('textbox'), { clipboardData: areaDeTransferencia(null) });

    expect(onColarImagem).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a seção que é só uma figura aparece como figura, e não como texto', () => {
    montarComEspiao([{ ...bloco(''), imagem: { src: 'anexos/abc123.png' } }]);

    const figura = screen.getByRole('img', { name: 'Imagem colada na nota' });
    expect(figura).toHaveAttribute('src', 'ardosia://anexos/abc123.png');
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('a figura aparece TAMBÉM em nota de texto puro — era aí que ela sumia', () => {
    montarComEspiao([{ ...bloco('anotação'), imagem: { src: 'anexos/abc123.png' } }], 'texto');

    expect(screen.getByRole('img', { name: 'Imagem colada na nota' })).toHaveAttribute(
      'src',
      'ardosia://anexos/abc123.png',
    );
    expect(screen.getByRole('textbox')).toHaveValue('anotação');
  });

  it('com origem guardada, a figura oferece o caminho de volta', () => {
    montarComEspiao([
      { ...bloco(''), imagem: { src: 'anexos/abc123.png', fonte: 'https://exemplo.org/femur' } },
    ]);

    const origem = screen.getByRole('link', { name: 'Abrir a origem da imagem' });
    expect(origem).toHaveAttribute('href', 'https://exemplo.org/femur');
  });

  it('sem origem, não há link nenhum para abrir', () => {
    montarComEspiao([{ ...bloco(''), imagem: { src: 'anexos/abc123.png' } }]);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('marcação escrita à mão no texto continua sendo texto, e não vira figura', () => {
    montarComEspiao([bloco('![](anexos/abc123.png)')]);

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByDisplayValue('![](anexos/abc123.png)')).toBeInTheDocument();
  });
});

describe('tamanho da figura colada', () => {
  function areaComPng() {
    const arquivo = new File([new Uint8Array([137, 80, 78, 71])], 'print.png', { type: 'image/png' });
    return {
      items: [{ kind: 'file', type: 'image/png', getAsFile: () => arquivo }],
      getData: () => '',
    };
  }

  it('o bloco nasce do tamanho da imagem, encolhido se ela for grande demais', async () => {
    // o jsdom não decodifica imagem; o que interessa aqui é o que o canvas faz
    // com as dimensões, não como as obtém
    vi.stubGlobal('createImageBitmap', async () => ({ width: 1920, height: 1080, close: () => {} }));
    const onChange = vi.fn();
    render(
      <Canvas
        blocos={[bloco('')]}
        tipo="markdown"
        onChange={onChange}
        onColarImagem={vi.fn(async () => 'abc123.png')}
        titulos={[]}
        achados={[]}
        achadoAtual={null}
        trechos={{}}
        onSair={vi.fn()}
        onRecado={vi.fn()}
      />,
    );

    fireEvent.paste(screen.getByRole('textbox'), { clipboardData: areaComPng() });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const [depois] = onChange.mock.calls.at(-1) as [Bloco[]];
    expect(depois[0]).toMatchObject({ largura: 480, altura: 270 });
    vi.unstubAllGlobals();
  });
});

describe('colar endereço sobre a seleção', () => {
  function areaComTexto(texto: string) {
    return {
      items: [{ kind: 'string', type: 'text/plain', getAsFile: () => null }],
      getData: (tipo: string) => (tipo === 'text/plain' ? texto : ''),
    };
  }

  it('o trecho selecionado vira o texto do link', async () => {
    montarVivo([bloco('leia o manual do fêmur')]);
    const campo = screen.getByRole('textbox') as HTMLTextAreaElement;
    campo.setSelectionRange(7, 22);

    fireEvent.paste(campo, { clipboardData: areaComTexto('https://exemplo.org/femur') });

    expect(campo).toHaveValue('leia o [manual do fêmur](https://exemplo.org/femur)');
  });

  it('sem seleção, colar um endereço continua colando o endereço', () => {
    const { onChange } = montarComEspiaoSimples([bloco('nada selecionado')]);
    const campo = screen.getByRole('textbox') as HTMLTextAreaElement;
    campo.setSelectionRange(4, 4);

    fireEvent.paste(campo, { clipboardData: areaComTexto('https://exemplo.org') });

    // o navegador faz a colagem normal; o componente não interfere
    expect(onChange).not.toHaveBeenCalled();
  });

  it('texto que não é endereço não vira link', () => {
    const { onChange } = montarComEspiaoSimples([bloco('uma frase inteira')]);
    const campo = screen.getByRole('textbox') as HTMLTextAreaElement;
    campo.setSelectionRange(0, 3);

    fireEvent.paste(campo, { clipboardData: areaComTexto('veja em https://exemplo.org') });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('em nota de texto puro, endereço colado é só endereço', () => {
    const { onChange } = montarComEspiaoSimples([bloco('uma frase inteira')], 'texto');
    const campo = screen.getByRole('textbox') as HTMLTextAreaElement;
    campo.setSelectionRange(0, 3);

    fireEvent.paste(campo, { clipboardData: areaComTexto('https://exemplo.org') });

    expect(onChange).not.toHaveBeenCalled();
  });
});

function montarComEspiaoSimples(blocos: Bloco[], tipo: 'markdown' | 'texto' = 'markdown') {
  const onChange = vi.fn();
  render(
    <Canvas
      blocos={blocos}
      tipo={tipo}
      onChange={onChange}
      onColarImagem={vi.fn(async () => 'x.png')}
      titulos={[]}
      achados={[]}
      achadoAtual={null}
      trechos={{}}
      onSair={vi.fn()}
      onRecado={vi.fn()}
    />,
  );
  return { onChange };
}

describe('sair do bloco pelo teclado', () => {
  it('Esc devolve o teclado para a lista de notas', async () => {
    const onSair = vi.fn();
    render(
      <Canvas
        blocos={[bloco('escrevendo')]}
        tipo="markdown"
        onChange={vi.fn()}
        onColarImagem={vi.fn(async () => 'x.png')}
        titulos={[]}
        achados={[]}
        achadoAtual={null}
        trechos={{}}
        onSair={onSair}
        onRecado={vi.fn()}
      />,
    );

    const campo = screen.getByRole('textbox');
    campo.focus();
    await userEvent.keyboard('{Escape}');

    expect(onSair).toHaveBeenCalled();
    expect(campo).not.toHaveFocus();
  });

  it('com a lista de ligações aberta, Esc fecha a lista e o cursor fica onde está', async () => {
    montarVivo([bloco('')]);
    const campo = screen.getByRole('textbox');
    await digitar(campo, '[[');
    await userEvent.type(campo, '{Escape}');

    expect(campo).toHaveFocus();
  });
});

describe('duplicar bloco', () => {
  it('Ctrl+D copia o bloco em que se escreve', async () => {
    const onChange = vi.fn();
    render(
      <Canvas
        blocos={[bloco('a copiar')]}
        tipo="markdown"
        onChange={onChange}
        onColarImagem={vi.fn(async () => 'x.png')}
        titulos={[]}
        achados={[]}
        achadoAtual={null}
        trechos={{}}
        onSair={vi.fn()}
        onRecado={vi.fn()}
      />,
    );

    screen.getByRole('textbox').focus();
    await userEvent.keyboard('{Control>}d{/Control}');

    const [depois] = onChange.mock.calls.at(-1) as [Bloco[]];
    expect(depois).toHaveLength(2);
    expect(depois[1].texto).toBe('a copiar');
    expect(depois[1].id).not.toBe(depois[0].id);
  });
});

describe('trecho na lista de ligações', () => {
  /** Um pai de verdade: sem ele o campo não acumula o que se digita. */
  function montarComTrechos(titulos: string[], trechos: Record<string, string>) {
    function Pai() {
      const [blocos, setBlocos] = useState([bloco('')]);
      return (
        <Canvas
          blocos={blocos}
          tipo="markdown"
          onChange={setBlocos}
          onColarImagem={vi.fn(async () => 'x.png')}
          titulos={titulos}
          trechos={trechos}
          achados={[]}
          achadoAtual={null}
          onSair={vi.fn()}
          onRecado={vi.fn()}
        />
      );
    }
    render(<Pai />);
  }

  it('a sugestão mostra o começo da nota, para títulos parecidos não se confundirem', async () => {
    montarComTrechos(['Aula 1', 'Aula 2'], { 'Aula 1': 'sobre o fêmur', 'Aula 2': 'sobre a tíbia' });

    await digitar(screen.getByRole('textbox'), '[[Aula');

    expect(screen.getByRole('button', { name: /Aula 1/ })).toHaveTextContent('sobre o fêmur');
    expect(screen.getByRole('button', { name: /Aula 2/ })).toHaveTextContent('sobre a tíbia');
  });

  it('nota sem corpo aparece só com o título', async () => {
    montarComTrechos(['Aula 1'], { 'Aula 1': '' });

    await digitar(screen.getByRole('textbox'), '[[');
    expect(screen.getByRole('button', { name: 'Aula 1' })).toBeInTheDocument();
  });
});

describe('imagem que não dá para ler', () => {
  function areaComArquivo(arquivo: File) {
    return {
      items: [{ kind: 'file', type: arquivo.type, getAsFile: () => arquivo }],
      getData: () => '',
    };
  }

  it('imagem ilegível vira aviso, e não uma figura quebrada na página', async () => {
    vi.stubGlobal('createImageBitmap', async () => {
      throw new Error('não é uma imagem');
    });
    const onChange = vi.fn();
    const onColarImagem = vi.fn(async () => 'abc123.png');
    const onRecado = vi.fn();
    render(
      <Canvas
        blocos={[bloco('')]}
        tipo="markdown"
        onChange={onChange}
        onColarImagem={onColarImagem}
        titulos={[]}
        trechos={{}}
        achados={[]}
        achadoAtual={null}
        onSair={vi.fn()}
        onRecado={onRecado}
      />,
    );

    const quebrada = new File([new Uint8Array([1, 2, 3])], 'quebrada.png', { type: 'image/png' });
    fireEvent.paste(screen.getByRole('textbox'), { clipboardData: areaComArquivo(quebrada) });

    await waitFor(() => expect(onRecado).toHaveBeenCalledWith('Não foi possível ler a imagem colada.'));
    // nada foi gravado nem escrito na nota
    expect(onColarImagem).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('entre a miniatura e o print inteiro, é o print que vai para o disco', async () => {
    vi.stubGlobal('createImageBitmap', async () => ({ width: 1200, height: 800, close: () => {} }));
    const onColarImagem = vi.fn(async () => 'abc123.png');
    render(
      <Canvas
        blocos={[bloco('')]}
        tipo="markdown"
        onChange={vi.fn()}
        onColarImagem={onColarImagem}
        titulos={[]}
        trechos={{}}
        achados={[]}
        achadoAtual={null}
        onSair={vi.fn()}
        onRecado={vi.fn()}
      />,
    );

    const miniatura = new File([new Uint8Array(10)], 'mini.png', { type: 'image/png' });
    const inteiro = new File([new Uint8Array(5000)], 'print.png', { type: 'image/png' });
    fireEvent.paste(screen.getByRole('textbox'), {
      clipboardData: {
        items: [
          { kind: 'file', type: 'image/png', getAsFile: () => miniatura },
          { kind: 'file', type: 'image/png', getAsFile: () => inteiro },
        ],
        getData: () => '',
      },
    });

    await waitFor(() => expect(onColarImagem).toHaveBeenCalled());
    const [bytes] = onColarImagem.mock.calls[0] as unknown as [Uint8Array, string];
    expect(bytes.length).toBe(5000);
    vi.unstubAllGlobals();
  });
});
