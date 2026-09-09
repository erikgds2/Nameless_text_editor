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

  it('colada numa seção vazia, a figura fica nela — e sobra onde escrever', async () => {
    const vazio = bloco('');
    const { onChange, onColarImagem } = montarComEspiao([vazio]);

    fireEvent.paste(screen.getByRole('textbox'), { clipboardData: areaDeTransferencia(png()) });

    await waitFor(() => expect(onColarImagem).toHaveBeenCalled());
    const [depois] = onChange.mock.calls.at(-1) as [Bloco[]];

    expect(depois[0].id).toBe(vazio.id);
    expect(depois[0].imagem?.src).toBe('anexos/abc123.png');
    // a figura é da seção: o texto dela não é usado para guardar a foto
    expect(depois[0].texto).toBe('');
    // e a seção é mais alta que a foto, para caber uma linha de escrita
    expect(depois[0].altura).toBeGreaterThan(depois[0].imagem!.altura!);
  });

  it('colada num bloco com texto, a figura fica NESSE bloco, e não num quadrado novo', async () => {
    const escrito = { ...bloco('Anatomia do fêmur'), y: 100, altura: 120 };
    const { onChange } = montarComEspiao([escrito]);

    fireEvent.paste(screen.getByRole('textbox'), { clipboardData: areaDeTransferencia(png()) });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const [depois] = onChange.mock.calls.at(-1) as [Bloco[]];

    expect(depois).toHaveLength(1);
    expect(depois[0].id).toBe(escrito.id);
    expect(depois[0].imagem?.src).toBe('anexos/abc123.png');
    // o texto que já estava lá fica intacto
    expect(depois[0].texto).toBe('Anatomia do fêmur');
    // a faixa tem a altura que a foto pede, e o bloco cresce exatamente isso
    const faixa = depois[0].imagem?.altura ?? 0;
    expect(faixa).toBeGreaterThan(0);
    expect(depois[0].altura).toBe(escrito.altura + faixa);
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
    expect(depois[1].imagem?.src).toBe('anexos/abc123.png');
    expect(depois[1].y).toBeGreaterThan(comFigura.y + comFigura.altura);
  });

  it('a origem do print, quando existe, entra na marcação', async () => {
    const { onChange } = montarComEspiao([bloco('')]);

    fireEvent.paste(screen.getByRole('textbox'), {
      clipboardData: areaDeTransferencia(png(), `<img src="https://exemplo.org/femur.png">`),
    });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const [depois] = onChange.mock.calls.at(-1) as [Bloco[]];
    expect(depois[0].imagem).toMatchObject({
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

  it('a seção só com figura também tem onde escrever: era o que travava', () => {
    montarComEspiao([{ ...bloco(''), imagem: { src: 'anexos/abc123.png' } }]);

    const figura = screen.getByRole('img', { name: 'Imagem colada na nota' });
    expect(figura).toHaveAttribute('src', 'ardosia://anexos/abc123.png');
    // o campo de escrita existe mesmo sem texto nenhum
    expect(screen.getByRole('textbox')).toBeInTheDocument();
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
    // 1920x1080 numa seção de 480: sobram 456 de largura útil, e a foto pede
    // 257 de faixa. A seção ganha isso mais a linha de escrita.
    expect(depois[0]).toMatchObject({ largura: 480, altura: 257 + 72 });
    expect(depois[0].imagem?.altura).toBe(257);
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

describe('nota colada por uma versão antiga: a foto se mede sozinha', () => {
  function comFiguraSemAltura() {
    const onChange = vi.fn();
    render(
      <Canvas
        blocos={[{ ...bloco('Anatomia'), largura: 320, altura: 185, imagem: { src: 'anexos/a.png' } }]}
        tipo="texto"
        onChange={onChange}
        onColarImagem={vi.fn(async () => 'x.png')}
        titulos={[]}
        trechos={{}}
        achados={[]}
        achadoAtual={null}
        onSair={vi.fn()}
        onRecado={vi.fn()}
      />,
    );
    return onChange;
  }

  it('ao desenhar, a seção aprende quanto a foto pede e cresce para caber', () => {
    const onChange = comFiguraSemAltura();
    const img = screen.getByRole('img', { name: 'Imagem colada na nota' });

    // o jsdom não decodifica imagem: as dimensões entram na mão, como o
    // navegador as entregaria no onLoad
    Object.defineProperty(img, 'naturalWidth', { value: 260, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 402, configurable: true });
    fireEvent.load(img);

    const [depois] = onChange.mock.calls.at(-1) as [Bloco[]];
    expect(depois[0].imagem).toEqual({ src: 'anexos/a.png', altura: 402 });
    expect(depois[0].altura).toBe(402 + 72);
  });

  it('quando a seção já sabe a medida, desenhar não mexe em nada', () => {
    const onChange = vi.fn();
    render(
      <Canvas
        blocos={[
          { ...bloco('Anatomia'), altura: 500, imagem: { src: 'anexos/a.png', altura: 300 } },
        ]}
        tipo="texto"
        onChange={onChange}
        onColarImagem={vi.fn(async () => 'x.png')}
        titulos={[]}
        trechos={{}}
        achados={[]}
        achadoAtual={null}
        onSair={vi.fn()}
        onRecado={vi.fn()}
      />,
    );

    fireEvent.load(screen.getByRole('img', { name: 'Imagem colada na nota' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('imagem que não carrega não muda a seção', () => {
    const onChange = comFiguraSemAltura();
    const img = screen.getByRole('img', { name: 'Imagem colada na nota' });

    Object.defineProperty(img, 'naturalWidth', { value: 0, configurable: true });
    fireEvent.load(img);

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('a seção troca de identidade no meio da colagem', () => {
  function png() {
    return new File([new Uint8Array([137, 80, 78, 71])], 'print.png', { type: 'image/png' });
  }

  function area() {
    const arquivo = png();
    return {
      items: [{ kind: 'file', type: 'image/png', getAsFile: () => arquivo }],
      getData: () => '',
    };
  }

  /**
   * É o que a releitura da pasta fazia: os blocos voltam do arquivo com ids
   * novos. Quem estava colando ficava com um id que não existe mais.
   */
  it('a foto vai para a seção que ocupa o mesmo lugar na página', async () => {
    const antes = { ...bloco('Anatomia'), x: 15, y: 15 };
    const onChange = vi.fn();

    const { rerender } = render(
      <Canvas
        blocos={[antes]}
        tipo="texto"
        onChange={onChange}
        onColarImagem={vi.fn(async () => 'abc123.png')}
        titulos={[]}
        trechos={{}}
        achados={[]}
        achadoAtual={null}
        onSair={vi.fn()}
        onRecado={vi.fn()}
      />,
    );

    fireEvent.paste(screen.getByRole('textbox'), { clipboardData: area() });

    // no meio da colagem, o mesmo bloco volta com outro id
    const renascido = { ...antes, id: 'id-novo-depois-da-releitura' };
    rerender(
      <Canvas
        blocos={[renascido]}
        tipo="texto"
        onChange={onChange}
        onColarImagem={vi.fn(async () => 'abc123.png')}
        titulos={[]}
        trechos={{}}
        achados={[]}
        achadoAtual={null}
        onSair={vi.fn()}
        onRecado={vi.fn()}
      />,
    );

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const [depois] = onChange.mock.calls.at(-1) as [Bloco[]];

    expect(depois).toHaveLength(1);
    expect(depois[0].id).toBe('id-novo-depois-da-releitura');
    expect(depois[0].imagem?.src).toBe('anexos/abc123.png');
  });

  it('se a seção sumiu de vez, a foto vira uma seção nova em vez de se perder', async () => {
    const antes = { ...bloco('Anatomia'), x: 15, y: 15 };
    const outro = { ...bloco('outra seção'), x: 400, y: 400 };
    const onChange = vi.fn();

    const props = {
      tipo: 'texto' as const,
      onChange,
      onColarImagem: vi.fn(async () => 'abc123.png'),
      titulos: [],
      trechos: {},
      achados: [],
      achadoAtual: null,
      onSair: vi.fn(),
      onRecado: vi.fn(),
    };

    const { rerender } = render(<Canvas blocos={[antes]} {...props} />);
    fireEvent.paste(screen.getByRole('textbox'), { clipboardData: area() });
    rerender(<Canvas blocos={[outro]} {...props} />);

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const [depois] = onChange.mock.calls.at(-1) as [Bloco[]];

    expect(depois).toHaveLength(2);
    expect(depois[1].imagem?.src).toBe('anexos/abc123.png');
    expect(depois[1]).toMatchObject({ x: 15, y: 15 });
  });
});

describe('imagem que não abre', () => {
  function comFigura() {
    render(
      <Canvas
        blocos={[{ ...bloco(''), imagem: { src: 'anexos/sumiu.png', altura: 200 } }]}
        tipo="texto"
        onChange={vi.fn()}
        onColarImagem={vi.fn(async () => 'x.png')}
        titulos={[]}
        trechos={{}}
        achados={[]}
        achadoAtual={null}
        onSair={vi.fn()}
        onRecado={vi.fn()}
      />,
    );
  }

  it('a primeira falha vira uma segunda tentativa, com endereço novo', () => {
    comFigura();
    const img = screen.getByRole('img', { name: 'Imagem colada na nota' });
    expect(img).toHaveAttribute('src', 'ardosia://anexos/sumiu.png');

    // é o que fura um 404 que ficou preso no cache do Chromium
    fireEvent.error(img);
    expect(screen.getByRole('img', { name: 'Imagem colada na nota' })).toHaveAttribute(
      'src',
      'ardosia://anexos/sumiu.png?tentativa=1',
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('falhando de novo, a seção diz o que houve e qual arquivo', () => {
    comFigura();
    fireEvent.error(screen.getByRole('img', { name: 'Imagem colada na nota' }));
    fireEvent.error(screen.getByRole('img', { name: 'Imagem colada na nota' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível abrir esta imagem');
    expect(screen.getByText('anexos/sumiu.png')).toBeInTheDocument();
  });

  it('imagem que abre não mostra aviso nenhum', () => {
    comFigura();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('foto que veio do cache', () => {
  /**
   * O caso que sobreviveu a três correções: na segunda vez que a nota abre, a
   * imagem vem do cache e chega `complete` antes de o React pendurar o onLoad.
   * O evento nunca dispara, a seção nunca aprende o tamanho da foto, e a faixa
   * fica no piso — o print vira uma tira ilegível.
   */
  it('a seção aprende o tamanho mesmo sem o onLoad disparar', () => {
    const onChange = vi.fn();
    // o jsdom entrega toda <img> como completa; é exatamente o cenário do cache
    Object.defineProperty(HTMLImageElement.prototype, 'complete', {
      configurable: true,
      get() {
        return true;
      },
    });
    Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', {
      configurable: true,
      get() {
        return 260;
      },
    });
    Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', {
      configurable: true,
      get() {
        return 402;
      },
    });

    render(
      <Canvas
        blocos={[
          { ...bloco('Anatomia'), largura: 320, altura: 185, imagem: { src: 'anexos/a.png' } },
        ]}
        tipo="texto"
        onChange={onChange}
        onColarImagem={vi.fn(async () => 'x.png')}
        titulos={[]}
        trechos={{}}
        achados={[]}
        achadoAtual={null}
        onSair={vi.fn()}
        onRecado={vi.fn()}
      />,
    );

    const [depois] = onChange.mock.calls.at(-1) as [Bloco[]];
    expect(depois[0].imagem).toEqual({ src: 'anexos/a.png', altura: 402 });
    expect(depois[0].altura).toBe(402 + 72);

    // devolve o jsdom ao que era, para não contaminar os outros testes
    for (const prop of ['complete', 'naturalWidth', 'naturalHeight']) {
      delete (HTMLImageElement.prototype as unknown as Record<string, unknown>)[prop];
    }
  });
});

describe('escrever na seção que tem foto', () => {
  function comFoto(texto = 'Legenda') {
    render(
      <Canvas
        blocos={[{ ...bloco(texto), imagem: { src: 'anexos/a.png', altura: 200 } }]}
        tipo="texto"
        onChange={vi.fn()}
        onColarImagem={vi.fn(async () => 'x.png')}
        titulos={[]}
        trechos={{}}
        achados={[]}
        achadoAtual={null}
        onSair={vi.fn()}
        onRecado={vi.fn()}
      />,
    );
  }

  it('clicar na foto põe o cursor no texto, no fim do que já está escrito', () => {
    comFoto('Legenda');
    const campo = screen.getByRole('textbox') as HTMLTextAreaElement;

    fireEvent.mouseDown(screen.getByRole('img', { name: 'Imagem colada na nota' }));

    expect(campo).toHaveFocus();
    expect(campo.selectionStart).toBe('Legenda'.length);
  });

  it('clicar no link da origem não rouba o cursor', () => {
    render(
      <Canvas
        blocos={[
          {
            ...bloco('Legenda'),
            imagem: { src: 'anexos/a.png', altura: 200, fonte: 'https://exemplo.org' },
          },
        ]}
        tipo="texto"
        onChange={vi.fn()}
        onColarImagem={vi.fn(async () => 'x.png')}
        titulos={[]}
        trechos={{}}
        achados={[]}
        achadoAtual={null}
        onSair={vi.fn()}
        onRecado={vi.fn()}
      />,
    );

    fireEvent.mouseDown(screen.getByRole('link', { name: 'Abrir a origem da imagem' }));
    expect(screen.getByRole('textbox')).not.toHaveFocus();
  });

  it('a seção sem texto nenhum também aceita o clique na foto', () => {
    comFoto('');
    fireEvent.mouseDown(screen.getByRole('img', { name: 'Imagem colada na nota' }));
    expect(screen.getByRole('textbox')).toHaveFocus();
  });
});
