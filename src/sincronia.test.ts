/**
 * A prova de que o aplicativo e o navegador veem as MESMAS notas.
 *
 * Passar no contrato só garante que cada um se comporta bem sozinho. O que
 * importa aqui é outra coisa: o arquivo que um escreve, o outro lê — e devolve
 * a mesma nota, com o mesmo texto, o mesmo tipo, a mesma geometria de blocos.
 * É essa promessa que se quebra em silêncio quando alguém mexe no formato.
 */
import { describe, expect, it } from 'vitest';
import { depositoEmArquivos, type Arquivos } from './deposito';
import { textoDaNota, type Note } from './notes';
import { criarBloco } from './canvas';

/**
 * Um armazenamento de arquivos que as duas pontes compartilham. É o que faz o
 * papel da pasta de verdade no disco: o aplicativo grava nela, o navegador lê
 * dela, e nenhum dos dois sabe da existência do outro.
 */
function pastaCompartilhada() {
  const arquivos = new Map<string, string>();

  const ponte = (): Arquivos => ({
    pasta: async () => 'Ardósia',
    escolherPasta: async () => null,
    abrirPasta: async () => {},
    listar: async () => [...arquivos].map(([id, texto]) => ({ id, texto, atualizadoEm: 0 })),
    escrever: async (id, texto) => void arquivos.set(id, texto),
    renomear: async (de, para) => {
      if (!arquivos.has(de)) throw new Error(`não existe: ${de}`);
      if (de === para || arquivos.has(para)) return de;
      arquivos.set(para, arquivos.get(de) as string);
      arquivos.delete(de);
      return para;
    },
    apagar: async (id) => void arquivos.delete(id),
    aoMudarPasta: () => () => {},
    salvarAnexo: async () => 'imagem.png',
  });

  // duas pontes independentes sobre a mesma pasta, como nos dois ambientes
  return { arquivos, aplicativo: depositoEmArquivos(ponte()), navegador: depositoEmArquivos(ponte()) };
}

async function guardar(deposito: ReturnType<typeof pastaCompartilhada>['aplicativo'], nota: Note) {
  return await deposito.salvar(nota);
}

describe('as mesmas notas nos dois ambientes', () => {
  it('o que o aplicativo escreve, o navegador lê', async () => {
    const { aplicativo, navegador } = pastaCompartilhada();
    const nota = aplicativo.criar('markdown');
    await guardar(aplicativo, {
      ...nota,
      blocos: [{ ...nota.blocos[0], texto: '# Revisão de Cálculo\n\nLimite lateral.' }],
    });

    const [doNavegador] = await navegador.listar();
    expect(textoDaNota(doNavegador.blocos)).toBe('# Revisão de Cálculo\n\nLimite lateral.');
  });

  it('o que o navegador escreve, o aplicativo lê', async () => {
    const { aplicativo, navegador } = pastaCompartilhada();
    const nota = navegador.criar('texto');
    await guardar(navegador, { ...nota, blocos: [{ ...nota.blocos[0], texto: 'escrita no navegador' }] });

    const [doAplicativo] = await aplicativo.listar();
    expect(textoDaNota(doAplicativo.blocos)).toBe('escrita no navegador');
    expect(doAplicativo.tipo).toBe('texto');
  });

  it('editar de um lado aparece do outro', async () => {
    const { aplicativo, navegador } = pastaCompartilhada();
    const nota = aplicativo.criar('markdown');
    const salva = await guardar(aplicativo, {
      ...nota,
      blocos: [{ ...nota.blocos[0], texto: 'primeira versão' }],
    });

    const [paraEditar] = await navegador.listar();
    await navegador.salvar({
      ...paraEditar,
      blocos: [{ ...paraEditar.blocos[0], texto: 'corrigida no navegador' }],
    });

    const depois = await aplicativo.listar();
    expect(depois).toHaveLength(1);
    expect(depois[0].id).toBe(salva.id);
    expect(textoDaNota(depois[0].blocos)).toBe('corrigida no navegador');
  });

  it('apagar de um lado some do outro', async () => {
    const { aplicativo, navegador } = pastaCompartilhada();
    const salva = await guardar(aplicativo, {
      ...aplicativo.criar('markdown'),
      blocos: [{ ...criarBloco(48, 48), texto: 'some' }],
    });

    await navegador.apagar(salva.id);
    expect(await aplicativo.listar()).toEqual([]);
  });

  it('a nota atravessa inteira: geometria, tipo, fixada e ordem', async () => {
    const { aplicativo, navegador } = pastaCompartilhada();
    const nota = aplicativo.criar('markdown');
    const salva = await guardar(aplicativo, {
      ...nota,
      pinned: true,
      ordem: 2,
      blocos: [
        { ...criarBloco(48, 48), largura: 320, altura: 140, texto: 'Título da nota' },
        { ...criarBloco(420, 300), largura: 280, altura: 200, texto: 'segundo bloco' },
      ],
    });

    const [lida] = await navegador.listar();
    expect(lida.pinned).toBe(true);
    expect(lida.ordem).toBe(2);
    expect(lida.tipo).toBe(salva.tipo);
    expect(lida.blocos.map(({ id, ...resto }) => resto)).toEqual(
      salva.blocos.map(({ id, ...resto }) => resto),
    );
  });

  it('os dois batizam o arquivo pelo mesmo título', async () => {
    const primeira = pastaCompartilhada();
    const segunda = pastaCompartilhada();

    const notaA = primeira.aplicativo.criar('markdown');
    await guardar(primeira.aplicativo, {
      ...notaA,
      blocos: [{ ...notaA.blocos[0], texto: '# Revisão de Cálculo I' }],
    });

    const notaB = segunda.navegador.criar('markdown');
    await guardar(segunda.navegador, {
      ...notaB,
      blocos: [{ ...notaB.blocos[0], texto: '# Revisão de Cálculo I' }],
    });

    expect([...primeira.arquivos.keys()]).toEqual([...segunda.arquivos.keys()]);
    expect([...primeira.arquivos.keys()]).toEqual(['revisao-de-calculo-i']);
  });
});
