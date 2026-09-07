import { useEffect, useState } from 'react';
import { deriveTitle, type Note } from '../notes';

type Props = {
  note: Note | null;
  onChange: (body: string) => void;
  onDelete: (id: string) => void;
};

const timeFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

function countWords(body: string): number {
  const words = body.trim().match(/\S+/g);
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

  return (
    <main className="editor">
      <header className="editor__header">
        <div className="editor__meta">
          <h1 className="editor__title">{deriveTitle(note.body)}</h1>
          <span className="editor__time">Editado em {timeFormat.format(note.updatedAt)}</span>
        </div>
        <button
          className={`btn btn--danger${confirmingDelete ? ' btn--armed' : ''}`}
          onClick={() => (confirmingDelete ? onDelete(note.id) : setConfirmingDelete(true))}
        >
          {confirmingDelete ? 'Confirmar' : 'Excluir'}
        </button>
      </header>

      <textarea
        key={note.id}
        className="editor__area"
        value={note.body}
        placeholder="Escreva..."
        spellCheck={false}
        autoFocus
        onChange={(event) => onChange(event.target.value)}
      />

      <footer className="editor__footer">
        <span>{countWords(note.body)} palavras</span>
        <span>{note.body.length} caracteres</span>
        <span>{note.body.split('\n').length} linhas</span>
      </footer>
    </main>
  );
}
