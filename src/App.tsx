import { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import { createNote, loadNotes, saveNotes, type Note } from './notes';

export default function App() {
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [activeId, setActiveId] = useState<string | null>(
    () => [...notes].sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ?? null,
  );
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // autosave com debounce: escrever a cada tecla no localStorage é desperdício
  useEffect(() => {
    const timer = setTimeout(() => saveNotes(notes), 250);
    return () => clearTimeout(timer);
  }, [notes]);

  const visibleNotes = useMemo(() => {
    const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
    const term = query.trim().toLowerCase();
    if (!term) return sorted;
    return sorted.filter((note) => note.body.toLowerCase().includes(term));
  }, [notes, query]);

  const activeNote = notes.find((note) => note.id === activeId) ?? null;

  function handleNewNote() {
    const note = createNote();
    setNotes((prev) => [note, ...prev]);
    setActiveId(note.id);
    setQuery('');
  }

  function handleChangeBody(body: string) {
    if (!activeId) return;
    setNotes((prev) =>
      prev.map((note) =>
        note.id === activeId ? { ...note, body, updatedAt: Date.now() } : note,
      ),
    );
  }

  function handleDelete(id: string) {
    setNotes((prev) => prev.filter((note) => note.id !== id));
    if (activeId === id) setActiveId(null);
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
        <span className="titlebar__name">Editor Sem Nome</span>
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
        />
        <Editor note={activeNote} onChange={handleChangeBody} onDelete={handleDelete} />
      </div>
    </div>
  );
}
