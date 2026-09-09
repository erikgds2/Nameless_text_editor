// A mesma pasta de notas do aplicativo, vista pelo navegador, pela File System
// Access API. É o que faz o navegador e o aplicativo instalado enxergarem os
// mesmos arquivos .md — sem isso são dois mundos que nunca se falam.
//
// A API só existe em contexto seguro e em navegadores com base Chromium; quem
// chama `navegadorTemPasta()` decide se oferece esta opção.
import type { Arquivos } from './deposito';

// O TypeScript instalado ainda não traz estes membros da File System Access
// API (showDirectoryPicker e as permissões de um handle). Declaramos aqui só
// o mínimo que usamos, por cima do que a lib.dom.d.ts já define.
declare global {
  interface FileSystemHandle {
    queryPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
    requestPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  }
  interface Window {
    showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
  }
  interface FileSystemDirectoryHandle {
    values(): AsyncIterableIterator<FileSystemHandle>;
  }
}

const EXTENSAO_POR_TIPO: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

// Barra, contrabarra, os caracteres que o Windows recusa em nome de arquivo, e
// controles. ".." é travessia de caminho e é recusado à parte.
const CARACTERE_INVALIDO = /[\\/:*?"<>|\u0000-\u001f]/;

function validarId(id: string): void {
  if (
    !id ||
    id.length > 120 ||
    id.includes('..') ||
    CARACTERE_INVALIDO.test(id)
  ) {
    throw new Error(`nome de arquivo inválido: "${id}"`);
  }
}

// A extensão do arquivo é o tipo da nota, igual ao aplicativo instalado.
const EXTENSOES_DE_NOTA = ['.md', '.txt'];
const EXTENSAO_PADRAO = EXTENSOES_DE_NOTA[0];

function extensaoDoNome(nome: string): string | null {
  const baixo = nome.toLowerCase();
  return EXTENSOES_DE_NOTA.find((extensao) => baixo.endsWith(extensao)) ?? null;
}

function nomeDoArquivo(id: string, extensao: string = EXTENSAO_PADRAO): string {
  validarId(id);
  return `${id}${extensao}`;
}

/** A extensão com que esta nota está hoje na pasta, ou a padrão. */
async function extensaoAtual(raiz: FileSystemDirectoryHandle, id: string): Promise<string> {
  for (const extensao of EXTENSOES_DE_NOTA) {
    try {
      await raiz.getFileHandle(nomeDoArquivo(id, extensao));
      return extensao;
    } catch {
      // segue para a próxima
    }
  }
  return EXTENSAO_PADRAO;
}

async function existeArquivo(raiz: FileSystemDirectoryHandle, id: string): Promise<boolean> {
  for (const extensao of EXTENSOES_DE_NOTA) {
    try {
      await raiz.getFileHandle(nomeDoArquivo(id, extensao));
      return true;
    } catch {
      // segue para a próxima
    }
  }
  return false;
}

async function escreverArquivo(
  handle: FileSystemFileHandle,
  dados: string | Uint8Array,
): Promise<void> {
  const gravavel = await handle.createWritable();
  // A cópia não é desperdício: o TS distingue um Uint8Array apoiado em
  // ArrayBuffer de um apoiado em SharedArrayBuffer, e só o primeiro serve aqui.
  await gravavel.write(typeof dados === 'string' ? dados : new Uint8Array(dados));
  await gravavel.close();
}

async function digestoCurto(bytes: Uint8Array): Promise<string> {
  // mesma razão da cópia em escreverArquivo: o tipo do buffer precisa ser
  // ArrayBuffer, e não o ArrayBufferLike genérico que chega aqui
  const hash = await crypto.subtle.digest('SHA-1', new Uint8Array(bytes));
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 12);
}

/** Implementa `Arquivos` (de ./deposito) sobre uma pasta que o navegador tem permissão de ler e escrever. */
export function arquivosDaPasta(raiz: FileSystemDirectoryHandle): Arquivos {
  return {
    async pasta() {
      return raiz.name;
    },

    async listar() {
      const notas: { id: string; texto: string; atualizadoEm: number; extensao: string }[] = [];
      for await (const entrada of raiz.values()) {
        const extensao = extensaoDoNome(entrada.name);
        if (entrada.kind !== 'file' || !extensao) continue;
        try {
          const arquivo = await (entrada as FileSystemFileHandle).getFile();
          const texto = await arquivo.text();
          notas.push({
            id: entrada.name.slice(0, -extensao.length),
            texto,
            atualizadoEm: arquivo.lastModified,
            extensao,
          });
        } catch (erro) {
          // um arquivo ilegível não pode derrubar a lista inteira
          console.error(`não consegui ler "${entrada.name}"`, erro);
        }
      }
      return notas;
    },

    async escrever(id, texto, extensao = EXTENSAO_PADRAO) {
      const handle = await raiz.getFileHandle(nomeDoArquivo(id, extensao), { create: true });
      await escreverArquivo(handle, texto);

      // trocar o tipo renomeia o arquivo: o antigo não pode ficar para trás,
      // ou a mesma nota apareceria duas vezes na lista
      for (const outra of EXTENSOES_DE_NOTA) {
        if (outra === extensao) continue;
        try {
          await raiz.removeEntry(nomeDoArquivo(id, outra));
        } catch {
          // não existia: nada a fazer
        }
      }
    },

    async renomear(de, para) {
      validarId(de);
      validarId(para);
      if (de === para) return de;
      if (await existeArquivo(raiz, para)) return de;

      // Renomear o que não existe é erro, e aqui ele sobe: o depósito grava
      // antes de renomear justamente para isto nunca acontecer. Engolir a falha
      // esconderia, amanhã, uma nota que não chegou a ser escrita.
      const extensao = await extensaoAtual(raiz, de);
      const antigo = await raiz.getFileHandle(nomeDoArquivo(de, extensao));
      const texto = await (await antigo.getFile()).text();
      const novo = await raiz.getFileHandle(nomeDoArquivo(para, extensao), { create: true });
      await escreverArquivo(novo, texto);
      await raiz.removeEntry(nomeDoArquivo(de, extensao));
      return para;
    },

    async apagar(id) {
      for (const extensao of EXTENSOES_DE_NOTA) {
        try {
          await raiz.removeEntry(nomeDoArquivo(id, extensao));
        } catch {
          // já não existia: nada a fazer
        }
      }
    },

    async escolherPasta() {
      const nova = await escolherPastaDoNavegador();
      return nova ? nova.name : null;
    },

    // o navegador não tem como abrir o Explorer numa pasta arbitrária do disco
    async abrirPasta() {},

    // o navegador não tem vigia de sistema de arquivos: não há como saber que
    // alguém mexeu na pasta por fora, então não há o que avisar
    aoMudarPasta() {
      return () => {};
    },

    async salvarAnexo(bytes, tipo, nomePedido) {
      const extensao = EXTENSAO_POR_TIPO[tipo];
      if (!extensao && !nomePedido) throw new Error(`tipo de anexo não suportado: ${tipo}`);
      // imagem se chama pelo conteúdo; anexo conserva o nome que tinha
      const nome = extensao ? `${await digestoCurto(bytes)}.${extensao}` : (nomePedido as string);
      const pastaAnexos = await raiz.getDirectoryHandle('anexos', { create: true });
      const handle = await pastaAnexos.getFileHandle(nome, { create: true });
      await escreverArquivo(handle, bytes);
      return nome;
    },
  };
}

const BANCO = 'ardosia-pasta';
const LOJA = 'handles';
const CHAVE_RAIZ = 'raiz';

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BANCO, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(LOJA);
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function lerHandleGuardado(): Promise<FileSystemDirectoryHandle | null> {
  const banco = await abrirBanco();
  return new Promise((resolve, reject) => {
    const transacao = banco.transaction(LOJA, 'readonly');
    const pedido = transacao.objectStore(LOJA).get(CHAVE_RAIZ);
    pedido.onsuccess = () => resolve((pedido.result as FileSystemDirectoryHandle | undefined) ?? null);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function guardarHandle(raiz: FileSystemDirectoryHandle): Promise<void> {
  const banco = await abrirBanco();
  return new Promise((resolve, reject) => {
    const transacao = banco.transaction(LOJA, 'readwrite');
    transacao.objectStore(LOJA).put(raiz, CHAVE_RAIZ);
    transacao.oncomplete = () => resolve();
    transacao.onerror = () => reject(transacao.error);
  });
}

/** Pede à pessoa para escolher uma pasta e guarda a escolha para as próximas sessões. Null se ela cancelar. */
export async function escolherPastaDoNavegador(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const raiz = await window.showDirectoryPicker({ mode: 'readwrite' });
    await guardarHandle(raiz);
    return raiz;
  } catch (erro) {
    if (erro instanceof DOMException && erro.name === 'AbortError') return null;
    throw erro;
  }
}

/** A pasta guardada de uma sessão anterior, se ainda houver permissão de usá-la sem perguntar de novo. */
export async function pastaLembrada(): Promise<FileSystemDirectoryHandle | null> {
  const raiz = await lerHandleGuardado();
  if (!raiz) return null;
  // 'prompt' exige gesto da pessoa: quem chama esta função decide quando pedir
  const permissao = await raiz.queryPermission({ mode: 'readwrite' });
  return permissao === 'granted' ? raiz : null;
}

/** Se este navegador sabe falar com pastas do sistema de arquivos. */
export function navegadorTemPasta(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}
