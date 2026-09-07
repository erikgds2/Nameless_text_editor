import type { RefObject } from 'react';
import { deriveTitle, textoDaNota, type Note } from '../notes';
import { TEMAS, type TemaId } from '../theme';

type Props = {
  notes: Note[];
  activeId: string | null;
  query: string;
  searchRef: RefObject<HTMLInputElement | null>;
  onSelect: (id: string) => void;
  onQueryChange: (query: string) => void;
  onNewNote: () => void;
  onTogglePin: (id: string) => void;
  tema: TemaId;
  onTrocarTema: (tema: TemaId) => void;
};

const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });

function preview(texto: string): string {
  const rest = texto.split('\n').slice(1).join(' ').trim();
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
  onTogglePin,
  tema,
  onTrocarTema,
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
        {notes.map((note) => {
          const texto = textoDaNota(note.blocos);
          return (
          <li key={note.id} className="noterow">
            <button
              className={`noteitem${note.id === activeId ? ' noteitem--active' : ''}`}
              onClick={() => onSelect(note.id)}
            >
              <span className="noteitem__title">{deriveTitle(texto)}</span>
              <span className="noteitem__preview">{preview(texto)}</span>
              <span className="noteitem__date">{dateFormat.format(note.updatedAt)}</span>
            </button>
            <button
              className={`pin${note.pinned ? ' pin--on' : ''}`}
              onClick={() => onTogglePin(note.id)}
              title={note.pinned ? 'Desafixar' : 'Fixar'}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M4.5 1.5h3l-.5 3 2 2v1H3v-1l2-2-.5-3Z" fill="currentColor" />
                <path d="M6 7.5V11" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              </svg>
            </button>
          </li>
          );
        })}
      </ul>

      {notes.length === 0 && (
        <p className="sidebar__empty">
          {query ? 'Nenhuma nota encontrada.' : 'Nenhuma nota ainda.'}
        </p>
      )}

      <footer className="sidebar__footer">
        {notes.length} {notes.length === 1 ? 'nota' : 'notas'}
        <div className="temas">
          {TEMAS.map((t) => (
            <button
              key={t.id}
              className={`tema${t.id === tema ? ' tema--on' : ''}`}
              onClick={() => onTrocarTema(t.id)}
            >
              {t.rotulo}
            </button>
          ))}
        </div>
      </footer>
    </aside>
  );
}
