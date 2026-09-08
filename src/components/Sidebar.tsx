import { useRef } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import { deriveTitle, textoDaNota, type Note } from '../notes';

type Props = {
  notes: Note[];
  activeId: string | null;
  query: string;
  searchRef: RefObject<HTMLInputElement | null>;
  onSelect: (id: string) => void;
  onQueryChange: (query: string) => void;
  onNewNote: () => void;
  onTogglePin: (id: string) => void;
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
}: Props) {
  const listaRef = useRef<HTMLUListElement | null>(null);

  // Seta troca de nota e leva o foco junto — é assim que se navega numa lista
  // sem tocar no mouse, e o Enter fica livre para abrir o texto.
  function irPara(indice: number) {
    const nota = notes[indice];
    if (!nota) return;
    onSelect(nota.id);
    listaRef.current
      ?.querySelector<HTMLButtonElement>(`[data-nota="${CSS.escape(nota.id)}"]`)
      ?.focus();
  }

  function aoTeclarNaLista(event: KeyboardEvent<HTMLUListElement>) {
    const atual = notes.findIndex((nota) => nota.id === activeId);
    const destino = {
      ArrowDown: Math.min(notes.length - 1, atual + 1),
      ArrowUp: Math.max(0, atual - 1),
      Home: 0,
      End: notes.length - 1,
    }[event.key];
    if (destino === undefined) return;
    event.preventDefault();
    irPara(destino);
  }

  function aoTeclarNaBusca(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    irPara(0);
  }

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
          onKeyDown={aoTeclarNaBusca}
        />
        <button className="icone" onClick={onNewNote} title="Nova nota (Ctrl+N)" aria-label="Nova nota">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <ul className="notelist" ref={listaRef} onKeyDown={aoTeclarNaLista}>
        {notes.map((note) => {
          const texto = textoDaNota(note.blocos);
          return (
            <li key={note.id} className="noterow">
              <button
                className={`noteitem${note.id === activeId ? ' noteitem--active' : ''}`}
                data-nota={note.id}
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
        <span>
          {notes.length} {notes.length === 1 ? 'nota' : 'notas'}
        </span>
      </footer>
    </aside>
  );
}
