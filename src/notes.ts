export type Note = {
  id: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
};

const STORAGE_KEY = 'editor-sem-nome:notes:v1';

export function createNote(): Note {
  const now = Date.now();
  return { id: crypto.randomUUID(), body: '', createdAt: now, updatedAt: now, pinned: false };
}

/** O título é sempre a primeira linha com conteúdo — não existe campo separado. */
export function deriveTitle(body: string): string {
  const first = body.split('\n').find((line) => line.trim().length > 0);
  if (!first) return 'Nota sem título';
  return first.trim().slice(0, 80);
}

export function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((note) => ({ ...note, pinned: note.pinned ?? false }));
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
