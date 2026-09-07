import { criarBloco, textoDaNota, type Bloco } from './canvas';

export type Note = {
  id: string;
  blocos: Bloco[];
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
};

export { textoDaNota };

const STORAGE_KEY = 'editor-sem-nome:notes:v1';

export function createNote(): Note {
  const now = Date.now();
  return { id: crypto.randomUUID(), blocos: [criarBloco(48, 48)], createdAt: now, updatedAt: now, pinned: false };
}

/** O título é sempre a primeira linha com conteúdo — não existe campo separado. */
export function deriveTitle(texto: string): string {
  const first = texto.split('\n').find((line) => line.trim().length > 0);
  if (!first) return 'Nota sem título';
  return first.trim().slice(0, 80);
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
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
          pinned: note.pinned ?? false,
        };
      }
      // registro sem body nem blocos (corrompido ou de um formato desconhecido)
      // ainda precisa sair daqui com blocos: sem isso a lista inteira quebra
      const blocos = Array.isArray(note.blocos) && note.blocos.length > 0 ? note.blocos : [criarBloco(48, 48)];
      return { ...note, blocos, pinned: note.pinned ?? false };
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
