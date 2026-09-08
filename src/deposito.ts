// Onde as notas moram. No desktop, um .md por nota numa pasta sua; no navegador,
// o localStorage de sempre. O resto do app fala so com esta interface.
import { createNote, deriveTitle, loadNotes, saveNotes, textoDaNota, type Note, type TipoDoc } from './notes';
import { desserializar, serializar } from './formato';
import { nomeDisponivel, slugDeTitulo } from './nomes';

export type PonteDisco = {
  pasta(): Promise<string>;
  escolherPasta(): Promise<string | null>;
  abrirPasta(): Promise<void>;
  listar(): Promise<{ id: string; texto: string; atualizadoEm: number }[]>;
  escrever(id: string, texto: string): Promise<void>;
  renomear(de: string, para: string): Promise<string>;
  apagar(id: string): Promise<void>;
  aoMudarPasta(callback: () => void): () => void;
  fecharCaptura(gravou: boolean): Promise<void>;
  salvarAnexo(bytes: Uint8Array, tipo: string): Promise<string>;
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
async function migrar(ponte: PonteDisco): Promise<void> {
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

export function depositoEmDisco(ponte: PonteDisco): Deposito {
  return {
    emDisco: true,
    criar: (tipo) => ({ ...createNote(tipo), id: idProvisorio() }),

    async listar() {
      await migrar(ponte);
      return (await ponte.listar()).map((arquivo) => desserializar(arquivo.texto, arquivo.id));
    },

    // O arquivo provisorio adota o titulo na primeira vez que a nota ganha um.
    // Depois disso o nome e seu: renomeie no Explorer que o app respeita.
    async salvar(nota) {
      let id = nota.id;
      const nomeDoTitulo = nomeParaOTitulo(nota);
      if (nomeDoTitulo && ehProvisorio(id)) {
        const existentes = (await ponte.listar()).map((arquivo) => arquivo.id);
        id = await ponte.renomear(id, nomeDisponivel(nomeDoTitulo, existentes, id));
      }
      const salva = { ...nota, id };
      await ponte.escrever(id, serializar(salva));
      return salva;
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
    // sem disco não há onde guardar a imagem; o app avisa em vez de fingir
    salvarAnexo: async () => null,
  };
}

export function abrirDeposito(): Deposito {
  return window.ardosia ? depositoEmDisco(window.ardosia) : depositoNoNavegador();
}
