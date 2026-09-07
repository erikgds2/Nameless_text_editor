import { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import { createNote, loadNotes, saveNotes, textoDaNota, type Note } from './notes';
import type { Bloco } from './canvas';
import { matchesQuery } from './search';
import { carregarTema, salvarTema, type TemaId } from './theme';

export default function App() {
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [activeId, setActiveId] = useState<string | null>(
    () => [...notes].sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ?? null,
  );
  const [query, setQuery] = useState('');
  const [tema, setTema] = useState<TemaId>(carregarTema());
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    salvarTema(tema);
  }, [tema]);

  useEffect(() => {
    if (navigator.userAgent.includes('Electron')) {
      document.documentElement.dataset.native = 'true';
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => saveNotes(notes), 250);
    return () => clearTimeout(timer);
  }, [notes]);

  // [...notes] e obrigatorio: sort() muta o array, e este e o estado do React
  const visibleNotes = useMemo(
    () =>
      [...notes]
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return b.updatedAt - a.updatedAt;
        })
        .filter((note) => matchesQuery(textoDaNota(note.blocos), query)),
    [notes, query],
  );

  const activeNote = notes.find((note) => note.id === activeId) ?? null;

  function handleNewNote() {
    const note = createNote();
    setNotes((prev) => [note, ...prev]);
    setActiveId(note.id);
    setQuery('');
  }

  function handleChangeBlocos(blocos: Bloco[]) {
    if (!activeId) return;
    setNotes((prev) =>
      prev.map((note) =>
        note.id === activeId ? { ...note, blocos, updatedAt: Date.now() } : note,
      ),
    );
  }

  function handleDelete(id: string) {
    setNotes((prev) => prev.filter((note) => note.id !== id));
    if (activeId === id) setActiveId(null);
  }

  function handleTogglePin(id: string) {
    setNotes((prev) =>
      prev.map((note) => (note.id === id ? { ...note, pinned: !note.pinned } : note)),
    );
  }

  function onTrocarTema(novoTema: TemaId) {
    setTema(novoTema);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.key === 'n') {
        event.preventDefault();
        handleNewNote();
      }
      if (event.key === 'f') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="app">
      <header className="titlebar">
        <span className="titlebar__mark" />
        <span className="titlebar__name">Ardósia</span>
      </header>

      <div className="workspace">
        <Sidebar
          notes={visibleNotes}
          activeId={activeId}
          query={query}
          searchRef={searchRef}
          onSelect={setActiveId}
          onQueryChange={setQuery}
          onNewNote={handleNewNote}
          onTogglePin={handleTogglePin}
          tema={tema}
          onTrocarTema={onTrocarTema}
        />
        <Editor note={activeNote} onChange={handleChangeBlocos} onDelete={handleDelete} />
      </div>
    </div>
  );
}
