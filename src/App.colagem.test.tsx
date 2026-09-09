/**
 * A colagem pelo caminho inteiro: App → Editor → Canvas → depósito → arquivo.
 *
 * Este arquivo existe por um defeito que nenhum teste de módulo pegou. A foto
 * era gravada em disco, o texto da nota não recebia nada, e a imagem sumia sem
 * erro nenhum no registro — o app dizia que estava tudo bem. O que faltava era
 * exatamente isto: um teste que atravessa as camadas em vez de olhar uma só.
 *
 * A lição do projeto já dizia: "funções puras perfeitas, e o bug nasceu na
 * integração".
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import App from './App';
import { serializar, desserializar } from './formato';
import { criarBloco } from './canvas';
import { createNote, textoDaNota, type Note, type TipoDoc } from './notes';

/** Uma pasta de notas em memória, com o mesmo formato do disco. */
function pastaFalsa(inicial: Record<string, Note> = {}) {
  const arquivos = new Map<string, string>();
  for (const [id, nota] of Object.entries(inicial)) arquivos.set(id, serializar(nota));
  const anexos = new Map<string, Uint8Array>();

  return {
    arquivos,
    anexos,
    ponte: {
      pasta: async () => 'C:/pasta/de/teste',
      escolherPasta: async () => null,
      abrirPasta: async () => {},
      listar: async () =>
        [...arquivos].map(([id, texto]) => ({ id, texto, atualizadoEm: Date.now() })),
      escrever: async (id: string, texto: string) => {
        arquivos.set(id, texto);
      },
      renomear: async (de: string, para: string) => {
        if (arquivos.has(de) && !arquivos.has(para)) {
          arquivos.set(para, arquivos.get(de)!);
          arquivos.delete(de);
          return para;
        }
        return de;
      },
      apagar: async (id: string) => {
        arquivos.delete(id);
      },
      aoMudarPasta: () => () => {},
      salvarAnexo: async (bytes: Uint8Array, tipo: string) => {
        const nome = `${anexos.size + 1}${tipo === 'image/png' ? '.png' : '.jpg'}`;
        anexos.set(nome, bytes);
        return nome;
      },
      fecharCaptura: async () => {},
      modoDeFundo: async () => 'acrilico' as const,
      trocarModoDeFundo: async () => {},
      versao: async () => '0.0.0-teste',
      mostrarNaPasta: async () => {},
      registrarErro: async () => {},
      instalarAtualizacao: async () => {},
      aoAtualizar: () => () => {},
    },
  };
}

function nota(id: string, texto: string, tipo: TipoDoc): Note {
  const base = createNote(tipo);
  return { ...base, id, blocos: [{ ...criarBloco(15, 15), texto }] };
}

/** O PNG mínimo válido, para o caminho ser o de uma imagem de verdade. */
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
);

function colar(campo: HTMLElement, html = '') {
  const arquivo = new File([PNG], 'print.png', { type: 'image/png' });
  fireEvent.paste(campo, {
    clipboardData: {
      items: [{ kind: 'file', type: 'image/png', getAsFile: () => arquivo }],
      getData: (tipo: string) => (tipo === 'text/html' ? html : ''),
    },
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('createImageBitmap', async () => ({ width: 301, height: 290, close: () => {} }));
});

describe('colar imagem, do teclado ao arquivo', () => {
  it('em nota de TEXTO PURO a foto aparece e vai para o arquivo — o caso que falhou', async () => {
    const { ponte, arquivos, anexos } = pastaFalsa({
      'fase-2': nota('fase-2', '# Fase 2 no disco', 'texto'),
    });
    vi.stubGlobal('ardosia', ponte);
    render(<App />);

    const campo = await screen.findByDisplayValue('# Fase 2 no disco');
    colar(campo);

    // a foto aparece na tela
    const figura = await screen.findByRole('img', { name: 'Imagem colada na nota' });
    expect(figura).toHaveAttribute('src', 'ardosia://anexos/1.png');
    expect(anexos.size).toBe(1);

    // e chega ao arquivo, no marcador da seção
    await waitFor(() => expect(arquivos.get('fase-2')).toContain('img=anexos/1.png'));

    const salva = desserializar(arquivos.get('fase-2')!, 'fase-2');
    expect(salva.tipo).toBe('texto');
    expect(salva.blocos[0].imagem).toEqual({ src: 'anexos/1.png' });
    expect(salva.blocos[0].texto).toBe('# Fase 2 no disco');
  });

  it('em nota Markdown, o mesmo caminho e o mesmo resultado', async () => {
    const { ponte, arquivos } = pastaFalsa({ aula: nota('aula', 'Anatomia', 'markdown') });
    vi.stubGlobal('ardosia', ponte);
    render(<App />);

    colar(await screen.findByDisplayValue('Anatomia'));

    await screen.findByRole('img', { name: 'Imagem colada na nota' });
    await waitFor(() => expect(arquivos.get('aula')).toContain('img=anexos/1.png'));
  });

  it('a origem do print viaja até o arquivo', async () => {
    const { ponte, arquivos } = pastaFalsa({ aula: nota('aula', 'Anatomia', 'markdown') });
    vi.stubGlobal('ardosia', ponte);
    render(<App />);

    colar(await screen.findByDisplayValue('Anatomia'), '<img src="https://exemplo.org/femur.png">');

    await waitFor(() =>
      expect(arquivos.get('aula')).toContain('fonte=https://exemplo.org/femur.png'),
    );
  });

  it('a nota salva volta a abrir com a foto: ida e volta pelo disco', async () => {
    const { ponte, arquivos } = pastaFalsa({ aula: nota('aula', 'Anatomia', 'texto') });
    vi.stubGlobal('ardosia', ponte);
    render(<App />);

    colar(await screen.findByDisplayValue('Anatomia'));
    await waitFor(() => expect(arquivos.get('aula')).toContain('img='));

    const relida = desserializar(arquivos.get('aula')!, 'aula');
    expect(relida.blocos[0].imagem?.src).toBe('anexos/1.png');
    // e quem lê a nota como texto vê que há uma foto ali
    expect(textoDaNota(relida.blocos)).toContain('![](anexos/1.png)');
  });

  it('imagem ilegível não grava nada, nem no disco nem na nota', async () => {
    vi.stubGlobal('createImageBitmap', async () => {
      throw new Error('não é imagem');
    });
    const { ponte, arquivos, anexos } = pastaFalsa({ aula: nota('aula', 'Anatomia', 'markdown') });
    vi.stubGlobal('ardosia', ponte);
    render(<App />);

    colar(await screen.findByDisplayValue('Anatomia'));

    expect(await screen.findByText('Não foi possível ler a imagem colada.')).toBeInTheDocument();
    expect(anexos.size).toBe(0);
    expect(arquivos.get('aula')).not.toContain('img=');
  });
});
