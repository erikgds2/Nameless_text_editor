// jsdom não tem File System Access API nem crypto.subtle (usado para nomear
// anexos pela digital do conteúdo). O duplo abaixo imita só o que a nossa
// implementação usa da API de verdade; o polyfill de crypto.subtle vem do
// próprio Node, que já implementa Web Crypto.
import { webcrypto } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { arquivosDaPasta, navegadorTemPasta } from './pasta';
import { depositoEmArquivos } from './deposito';
import { contratoDeDeposito } from './deposito.contrato';

beforeAll(() => {
  if (!crypto.subtle) {
    Object.defineProperty(crypto, 'subtle', { value: webcrypto.subtle, configurable: true });
  }
});

type Registro = { texto: string; modificadoEm: number };

/** Uma pasta de mentira que se comporta como um FileSystemDirectoryHandle de verdade. */
function duploNovo(nome = 'notas-de-teste'): {
  raiz: FileSystemDirectoryHandle;
  arquivos: Map<string, Registro>;
} {
  const arquivos = new Map<string, Registro>();
  const subpastas = new Map<string, FileSystemDirectoryHandle>();

  function handleDoArquivo(id: string): FileSystemFileHandle {
    const handle = {
      kind: 'file' as const,
      name: id,
      async getFile() {
        const registro = arquivos.get(id);
        if (!registro) throw new DOMException(`arquivo não encontrado: ${id}`, 'NotFoundError');
        return {
          text: async () => registro.texto,
          lastModified: registro.modificadoEm,
        };
      },
      async createWritable() {
        let conteudo = '';
        return {
          async write(dados: string | Uint8Array) {
            conteudo = typeof dados === 'string' ? dados : new TextDecoder().decode(dados);
          },
          async close() {
            arquivos.set(id, { texto: conteudo, modificadoEm: Date.now() });
          },
        };
      },
    };
    return handle as unknown as FileSystemFileHandle;
  }

  const raiz = {
    kind: 'directory' as const,
    name: nome,
    async getFileHandle(id: string, opcoes?: { create?: boolean }) {
      if (!arquivos.has(id)) {
        if (!opcoes?.create) throw new DOMException(`arquivo não encontrado: ${id}`, 'NotFoundError');
        arquivos.set(id, { texto: '', modificadoEm: Date.now() });
      }
      return handleDoArquivo(id);
    },
    async getDirectoryHandle(sub: string, opcoes?: { create?: boolean }) {
      if (!subpastas.has(sub)) {
        if (!opcoes?.create) throw new DOMException(`pasta não encontrada: ${sub}`, 'NotFoundError');
        subpastas.set(sub, duploNovo(sub).raiz);
      }
      return subpastas.get(sub) as FileSystemDirectoryHandle;
    },
    async removeEntry(id: string) {
      if (!arquivos.delete(id)) throw new DOMException(`arquivo não encontrado: ${id}`, 'NotFoundError');
    },
    async *values() {
      for (const id of [...arquivos.keys()]) yield handleDoArquivo(id);
    },
  };

  return { raiz: raiz as unknown as FileSystemDirectoryHandle, arquivos };
}

// A implementação precisa cumprir o mesmo contrato que a pasta do aplicativo e
// o localStorage cumprem: é o critério principal desta tarefa.
contratoDeDeposito('pasta vista pelo navegador', () =>
  depositoEmArquivos(arquivosDaPasta(duploNovo().raiz)),
);

describe('arquivosDaPasta', () => {
  it('lista só os arquivos .md da raiz', async () => {
    const { raiz, arquivos } = duploNovo();
    arquivos.set('nota.md', { texto: 'corpo', modificadoEm: 0 });
    arquivos.set('imagem.png', { texto: 'binário fingido', modificadoEm: 0 });

    const listados = await arquivosDaPasta(raiz).listar();
    expect(listados.map((item) => item.id)).toEqual(['nota']);
  });

  it('um arquivo ilegível não derruba a lista inteira', async () => {
    const { raiz, arquivos } = duploNovo();
    arquivos.set('boa.md', { texto: 'lê numa boa', modificadoEm: 0 });
    // acrescenta, só na listagem, uma entrada cujo getFile() sempre falha —
    // simula um arquivo que sumiu ou está travado por outro programa
    const valoresOriginais = raiz.values.bind(raiz);
    raiz.values = (async function* () {
      for await (const entrada of valoresOriginais()) yield entrada;
      yield {
        kind: 'file',
        name: 'fantasma.md',
        async getFile() {
          throw new DOMException('travado', 'NotReadableError');
        },
      } as unknown as FileSystemHandle;
    }) as typeof raiz.values;

    const listados = await arquivosDaPasta(raiz).listar();
    expect(listados.map((item) => item.id)).toEqual(['boa']);
  });

  it('escrever cria e depois sobrescreve o mesmo arquivo', async () => {
    const { raiz, arquivos } = duploNovo();
    const arquivosApi = arquivosDaPasta(raiz);
    await arquivosApi.escrever('nota', 'primeira versão');
    await arquivosApi.escrever('nota', 'segunda versão');

    expect(arquivos.size).toBe(1);
    expect(arquivos.get('nota.md')?.texto).toBe('segunda versão');
  });

  it('renomear com destino livre move o conteúdo', async () => {
    const { raiz, arquivos } = duploNovo();
    arquivos.set('velho.md', { texto: 'conteúdo', modificadoEm: 0 });

    const novoId = await arquivosDaPasta(raiz).renomear('velho', 'novo');
    expect(novoId).toBe('novo');
    expect(arquivos.has('velho.md')).toBe(false);
    expect(arquivos.get('novo.md')?.texto).toBe('conteúdo');
  });

  it('renomear com destino ocupado não sobrescreve e devolve o nome antigo', async () => {
    const { raiz, arquivos } = duploNovo();
    arquivos.set('velho.md', { texto: 'do velho', modificadoEm: 0 });
    arquivos.set('novo.md', { texto: 'do novo, intocado', modificadoEm: 0 });

    const id = await arquivosDaPasta(raiz).renomear('velho', 'novo');
    expect(id).toBe('velho');
    expect(arquivos.get('velho.md')?.texto).toBe('do velho');
    expect(arquivos.get('novo.md')?.texto).toBe('do novo, intocado');
  });

  it('renomear tolera nota provisória que ainda não foi escrita em disco', async () => {
    const { raiz, arquivos } = duploNovo();
    const id = await arquivosDaPasta(raiz).renomear('nota-nova', 'primeiro-titulo');
    expect(id).toBe('primeiro-titulo');
    expect(arquivos.has('nota-nova.md')).toBe(false);
  });

  it('apagar o que não existe não lança', async () => {
    const { raiz } = duploNovo();
    await expect(arquivosDaPasta(raiz).apagar('nunca-existiu')).resolves.not.toThrow();
  });

  it.each([
    ['barra', 'algo/coisa'],
    ['contrabarra', 'algo\\coisa'],
    ['travessia de caminho', '..'],
    ['travessia embutida', 'pasta/../fora'],
    ['dois pontos', 'c:nome'],
    ['vazio', ''],
  ])('recusa id com %s', async (_descricao, idInvalido) => {
    const { raiz } = duploNovo();
    const arquivosApi = arquivosDaPasta(raiz);
    await expect(arquivosApi.escrever(idInvalido, 'texto')).rejects.toThrow();
  });

  it('salvarAnexo grava dentro de anexos/ e a mesma imagem duas vezes dá o mesmo nome', async () => {
    const { raiz } = duploNovo();
    const arquivosApi = arquivosDaPasta(raiz);
    const bytes = new Uint8Array([1, 2, 3, 4]);

    const primeiro = await arquivosApi.salvarAnexo(bytes, 'image/png');
    const segundo = await arquivosApi.salvarAnexo(bytes, 'image/png');

    expect(primeiro).toBe(segundo);
    expect(primeiro).toMatch(/^[0-9a-f]{12}\.png$/);

    const pastaAnexos = await raiz.getDirectoryHandle('anexos');
    const handle = await pastaAnexos.getFileHandle(primeiro);
    const arquivo = await handle.getFile();
    expect(await arquivo.text()).toBe(String.fromCharCode(1, 2, 3, 4));
  });

  it('tipo de anexo não suportado lança', async () => {
    const { raiz } = duploNovo();
    await expect(
      arquivosDaPasta(raiz).salvarAnexo(new Uint8Array([1]), 'application/pdf'),
    ).rejects.toThrow();
  });
});

describe('navegadorTemPasta', () => {
  it('diz a verdade sobre o ambiente atual', () => {
    // no jsdom deste projeto de teste não há File System Access API
    expect(navegadorTemPasta()).toBe(false);
  });
});
