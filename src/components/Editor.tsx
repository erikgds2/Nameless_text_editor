import { useEffect, useState } from 'react';
import { deriveTitle, textoDaNota, type Note } from '../notes';
import type { Bloco } from '../canvas';
import Canvas from './Canvas';

type Props = {
  note: Note | null;
  onChange: (blocos: Bloco[]) => void;
  onDelete: (id: string) => void;
};

const timeFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

function countWords(texto: string): number {
  const words = texto.trim().match(/\S+/g);
  return words ? words.length : 0;
}

export default function Editor({ note, onChange, onDelete }: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => setConfirmingDelete(false), [note?.id]);

  useEffect(() => {
    if (!confirmingDelete) return;
    const timer = setTimeout(() => setConfirmingDelete(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmingDelete]);

  if (!note) {
    return (
      <main className="editor editor--empty">
        <p className="editor__hint">
          Nenhuma nota aberta
          <span>Ctrl + N para criar uma</span>
        </p>
      </main>
    );
  }

  const texto = textoDaNota(note.blocos);

  return (
    <main className="editor">
      <header className="editor__header">
        <div className="editor__meta">
          <h1 className="editor__title">{deriveTitle(texto)}</h1>
          <span className="editor__time">Editado em {timeFormat.format(note.updatedAt)}</span>
        </div>
        <button
          className={`btn btn--danger${confirmingDelete ? ' btn--armed' : ''}`}
          onClick={() => (confirmingDelete ? onDelete(note.id) : setConfirmingDelete(true))}
        >
          {confirmingDelete ? 'Confirmar' : 'Excluir'}
        </button>
      </header>

      <Canvas key={note.id} blocos={note.blocos} onChange={onChange} />

      <footer className="editor__footer">
        <span>{countWords(texto)} palavras</span>
        <span>{texto.length} caracteres</span>
        <span>{texto.split('\n').length} linhas</span>
      </footer>
    </main>
  );
}
