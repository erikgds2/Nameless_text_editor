// Onde as notas moram. No desktop, um .md por nota numa pasta sua; no navegador,
// o localStorage de sempre. O resto do app fala so com esta interface.
import { createNote, deriveTitle, loadNotes, saveNotes, textoDaNota, type Note, type TipoDoc } from './notes';
import { desserializar, serializar } from './formato';
import { nomeDisponivel, slugDeTitulo } from './nomes';

/**
 * Uma pasta de notas, seja lá quem a alcance: o processo do aplicativo, pelo
 * sistema de arquivos, ou o navegador, pela permissão que você deu a ele.
 *
 * É esta interface que faz os dois ambientes verem as MESMAS notas: quem
 * fornece os arquivos muda, o depósito construído sobre eles não.
 */
export type Arquivos = {
  pasta(): Promise<string>;
  escolherPasta(): Promise<string | null>;
  abrirPasta(): Promise<void>;
  listar(): Promise<{ id: string; texto: string; atualizadoEm: number }[]>;
  escrever(id: string, texto: string): Promise<void>;
  renomear(de: string, para: string): Promise<string>;
  apagar(id: string): Promise<void>;
  aoMudarPasta(callback: () => void): () => void;
  salvarAnexo(bytes: Uint8Array, tipo: string): Promise<string>;
};

/** O que só o aplicativo instalado tem, além dos arquivos. */
export type PonteDisco = Arquivos & {
  fecharCaptura(gravou: boolean): Promise<void>;
  modoDeFundo(): Promise<'acrilico' | 'vidro'>;
  trocarModoDeFundo(modo: 'acrilico' | 'vidro'): Promise<void>;
  versao(): Promise<string>;
  instalarAtualizacao(): Promise<void>;
  aoAtualizar(callback: (dados: import('./janela').Atualizacao) => void): () => void;
};

declare global {
  interface Window {
    ardosia?: PonteDisco;
  }
}

export type Deposito = {
  emDisco: boolean;
  criar(tipo: TipoDoc): Note;
  listar(): Promise<Note[]>;
  salvar(nota: Note): Promise<Note>;
  apagar(id: string): Promise<void>;
  pasta(): Promise<string | null>;
  escolherPasta(): Promise<string | null>;
  abrirPasta(): Promise<void>;
  /** Avisa quando alguém mexeu nos arquivos por fora. Devolve como cancelar. */
  aoMudar(callback: () => void): () => void;
  /** Guarda a imagem colada e devolve o nome do arquivo; null onde não dá. */
  salvarAnexo(bytes: Uint8Array, tipo: string): Promise<string | null>;
};

const MARCA_MIGRACAO = 'ardosia:migrado-para-disco';

/** Nome de arquivo de uma nota que ainda nao ganhou titulo. */
function idProvisorio(): string {
  return `nota-${Date.now().toString(36)}`;
}

// So o nome que nos mesmos demos conta como provisorio: um titulo como
// "Nota sem titulo" vira "nota-sem-titulo" e nao pode ser confundido com ele.
function ehProvisorio(id: string): boolean {
  return /^nota-[0-9a-z]+$/.test(id);
}

function nomeParaOTitulo(nota: Note): string {
  const texto = textoDaNota(nota.blocos).trim();
  return texto ? slugDeTitulo(deriveTitle(texto)) : '';
}

/**
 * Passa para o disco o que ficou no localStorage da fase anterior. O original
 * continua la de proposito: so marcamos a migracao depois que tudo foi escrito,
 * e nada e apagado — se algo der errado, a copia antiga ainda existe.
 */
async function migrar(ponte: Arquivos): Promise<void> {
  if (localStorage.getItem(MARCA_MIGRACAO)) return;
  const antigas = loadNotes();
  if (antigas.length > 0) {
    const existentes = (await ponte.listar()).map((arquivo) => arquivo.id);
    for (const nota of antigas) {
      const id = nomeDisponivel(nomeParaOTitulo(nota) || 'nota', existentes);
      existentes.push(id);
      await ponte.escrever(id, serializar({ ...nota, id }));
    }
  }
  localStorage.setItem(MARCA_MIGRACAO, new Date().toISOString());
}

export function depositoEmArquivos(ponte: Arquivos): Deposito {
  return {
    emDisco: true,
    criar: (tipo) => ({ ...createNote(tipo), id: idProvisorio() }),

    async listar() {
      await migrar(ponte);
      return (await ponte.listar()).map((arquivo) => desserializar(arquivo.texto, arquivo.id));
    },

    /**
     * O arquivo provisório adota o título na primeira vez que a nota ganha um.
     * Depois disso o nome é seu: renomeie no Explorer que o app respeita.
     *
     * Grava ANTES de renomear, e a ordem importa: na primeira gravação o
     * arquivo provisório ainda não existe, e renomear o que não existe é erro
     * em qualquer sistema de arquivos de verdade. O id não vai dentro do
     * arquivo — ele é o nome —, então gravar e depois renomear é seguro.
     */
    async salvar(nota) {
      await ponte.escrever(nota.id, serializar(nota));

      const nomeDoTitulo = nomeParaOTitulo(nota);
      if (!nomeDoTitulo || !ehProvisorio(nota.id)) return nota;

      const existentes = (await ponte.listar()).map((arquivo) => arquivo.id);
      const id = await ponte.renomear(
        nota.id,
        nomeDisponivel(nomeDoTitulo, existentes, nota.id),
      );
      return { ...nota, id };
    },

    apagar: (id) => ponte.apagar(id),
    pasta: () => ponte.pasta(),
    escolherPasta: () => ponte.escolherPasta(),
    abrirPasta: () => ponte.abrirPasta(),
    aoMudar: (callback) => ponte.aoMudarPasta(callback),
    salvarAnexo: (bytes, tipo) => ponte.salvarAnexo(bytes, tipo),
  };
}

export function depositoNoNavegador(): Deposito {
  return {
    emDisco: false,
    criar: createNote,
    listar: async () => loadNotes(),
    async salvar(nota) {
      const todas = loadNotes();
      const indice = todas.findIndex((outra) => outra.id === nota.id);
      if (indice === -1) todas.unshift(nota);
      else todas[indice] = nota;
      saveNotes(todas);
      return nota;
    },
    async apagar(id) {
      saveNotes(loadNotes().filter((nota) => nota.id !== id));
    },
    pasta: async () => null,
    escolherPasta: async () => null,
    abrirPasta: async () => {},
    // no navegador não há pasta que alguém possa mexer por fora
    aoMudar: () => () => {},
    // sem pasta não há onde guardar a imagem; o app avisa em vez de fingir
    salvarAnexo: async () => null,
  };
}

/** Compatibilidade: o depósito do aplicativo é o de arquivos, com a ponte dele. */
export const depositoEmDisco = depositoEmArquivos;

export function abrirDeposito(): Deposito {
  return window.ardosia ? depositoEmArquivos(window.ardosia) : depositoNoNavegador();
}
