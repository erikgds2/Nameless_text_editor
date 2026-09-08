import { criarBloco, textoDaNota, type Bloco } from './canvas';

/** Markdown ganha realce enquanto se escreve e pré-visualização; texto, não. */
export type TipoDoc = 'markdown' | 'texto';

export type Note = {
  id: string;
  blocos: Bloco[];
  tipo: TipoDoc;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  /** Posição entre as fixadas, escolhida à mão. Só vale quando pinned. */
  ordem?: number;
};

export { textoDaNota };

const STORAGE_KEY = 'editor-sem-nome:notes:v1';

export function createNote(tipo: TipoDoc = 'markdown'): Note {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    blocos: [criarBloco(48, 48)],
    tipo,
    createdAt: now,
    updatedAt: now,
    pinned: false,
  };
}

/** O título é sempre a primeira linha com conteúdo — não existe campo separado. */
export function deriveTitle(texto: string): string {
  const first = texto.split('\n').find((line) => line.trim().length > 0);
  if (!first) return 'Nota sem título';
  return semMarcacao(first).slice(0, 80) || 'Nota sem título';
}

// "# Revisão" é o título "Revisão": os sinais do Markdown são instrução de
// formato, não parte do nome da nota — e é deste nome que sai o do arquivo.
function semMarcacao(linha: string): string {
  return linha
    .trim()
    .replace(/^#{1,6}\s+/, '')
    .replace(/^>\s+/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/[*`~]/g, '')
    .trim();
}

type NotaAntiga = {
  id: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
};

type NotaArmazenada = NotaAntiga | Note;

function ehNotaAntiga(note: NotaArmazenada): note is NotaAntiga {
  return !('blocos' in note) && 'body' in note;
}

export function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as NotaArmazenada[]).map((note) => {
      if (ehNotaAntiga(note)) {
        return {
          id: note.id,
          blocos: [{ ...criarBloco(48, 48), texto: note.body }],
          tipo: 'markdown' as const,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
          pinned: note.pinned ?? false,
        };
      }
      // registro sem body nem blocos (corrompido ou de um formato desconhecido)
      // ainda precisa sair daqui com blocos: sem isso a lista inteira quebra
      const blocos = Array.isArray(note.blocos) && note.blocos.length > 0 ? note.blocos : [criarBloco(48, 48)];
      return {
        ...note,
        blocos,
        tipo: note.tipo === 'texto' ? ('texto' as const) : ('markdown' as const),
        pinned: note.pinned ?? false,
      };
    });
  } catch (err) {
    console.error('Não foi possível ler as notas salvas:', err);
    return [];
  }
}

export function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (err) {
    console.error('Não foi possível salvar as notas:', err);
  }
}
