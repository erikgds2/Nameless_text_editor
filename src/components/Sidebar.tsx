import type { RefObject } from 'react';
import { deriveTitle, type Note } from '../notes';

type Props = {
  notes: Note[];
  activeId: string | null;
  query: string;
  searchRef: RefObject<HTMLInputElement | null>;
  onSelect: (id: string) => void;
  onQueryChange: (query: string) => void;
  onNewNote: () => void;
};

const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });

function preview(body: string): string {
  const rest = body.split('\n').slice(1).join(' ').trim();
  return rest.length > 0 ? rest.slice(0, 90) : 'Vazia';
}

export default function Sidebar({
  notes,
  activeId,
  query,
  searchRef,
  onSelect,
  onQueryChange,
  onNewNote,
}: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar__top">
        <input
          ref={searchRef}
          className="search"
          type="search"
          value={query}
          placeholder="Buscar"
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <button className="btn btn--new" onClick={onNewNote} title="Nova nota (Ctrl+N)">
          +
        </button>
      </div>

      <ul className="notelist">
        {notes.map((note) => (
          <li key={note.id}>
            <button
              className={`noteitem${note.id === activeId ? ' noteitem--active' : ''}`}
              onClick={() => onSelect(note.id)}
            >
              <span className="noteitem__title">{deriveTitle(note.body)}</span>
              <span className="noteitem__preview">{preview(note.body)}</span>
              <span className="noteitem__date">{dateFormat.format(note.updatedAt)}</span>
            </button>
          </li>
        ))}
      </ul>

      {notes.length === 0 && (
        <p className="sidebar__empty">
          {query ? 'Nenhuma nota encontrada.' : 'Nenhuma nota ainda.'}
        </p>
      )}

      <footer className="sidebar__footer">
        {notes.length} {notes.length === 1 ? 'nota' : 'notas'}
      </footer>
    </aside>
  );
}
