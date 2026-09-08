import { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import Ajustes from './components/Ajustes';
import { textoDaNota, type Note, type TipoDoc } from './notes';
import { abrirDeposito } from './deposito';
import type { Bloco } from './canvas';
import { matchesQuery } from './search';
import { carregarAjustes, salvarAjustes, type Ajustes as AjustesTipo } from './ajustes';

export default function App() {
  const deposito = useMemo(abrirDeposito, []);
  const [notes, setNotes] = useState<Note[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [pasta, setPasta] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [ajustes, setAjustes] = useState<AjustesTipo>(carregarAjustes);
  const [mostrandoAjustes, setMostrandoAjustes] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);
  // notas que mudaram e ainda nao foram para o disco
  const sujas = useRef(new Set<string>());

  useEffect(() => {
    document.documentElement.dataset.theme = ajustes.tema;
    document.documentElement.style.setProperty('--corpo', `${ajustes.corpo}px`);
    salvarAjustes(ajustes);
  }, [ajustes]);

  useEffect(() => {
    if (navigator.userAgent.includes('Electron')) {
      document.documentElement.dataset.native = 'true';
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    Promise.all([deposito.listar(), deposito.pasta()]).then(([carregadas, caminho]) => {
      if (!vivo) return;
      setNotes(carregadas);
      setPasta(caminho);
      setActiveId([...carregadas].sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ?? null);
      setCarregando(false);
    });
    return () => {
      vivo = false;
    };
  }, [deposito]);

  // Grava so o que mudou, e so depois que a digitacao para. Uma nota nova e
  // vazia nunca chega ao disco: arquivo so nasce quando ha o que guardar.
  useEffect(() => {
    if (carregando || sujas.current.size === 0) return;
    const timer = setTimeout(async () => {
      const pendentes = [...sujas.current];
      sujas.current.clear();
      for (const id of pendentes) {
        const nota = notes.find((outra) => outra.id === id);
        if (!nota) continue;
        try {
          const salva = await deposito.salvar(nota);
          if (salva.id === id) continue;
          // o arquivo provisorio adotou o titulo: a nota passa a ter outro id
          if (sujas.current.delete(id)) sujas.current.add(salva.id);
          setNotes((prev) => prev.map((outra) => (outra.id === id ? salva : outra)));
          setActiveId((atual) => (atual === id ? salva.id : atual));
        } catch (err) {
          console.error('Não foi possível salvar a nota:', err);
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [notes, carregando, deposito]);

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

  function marcar(id: string) {
    sujas.current.add(id);
  }

  function handleNewNote() {
    const note = deposito.criar(ajustes.tipoPadrao);
    setNotes((prev) => [note, ...prev]);
    setActiveId(note.id);
    setQuery('');
  }

  function handleChangeBlocos(blocos: Bloco[]) {
    if (!activeId) return;
    marcar(activeId);
    setNotes((prev) =>
      prev.map((note) =>
        note.id === activeId ? { ...note, blocos, updatedAt: Date.now() } : note,
      ),
    );
  }

  function handleMudarTipo(tipo: TipoDoc) {
    if (!activeId) return;
    marcar(activeId);
    setNotes((prev) =>
      prev.map((note) => (note.id === activeId ? { ...note, tipo, updatedAt: Date.now() } : note)),
    );
  }

  function handleDelete(id: string) {
    sujas.current.delete(id);
    setNotes((prev) => prev.filter((note) => note.id !== id));
    if (activeId === id) setActiveId(null);
    deposito.apagar(id).catch((err) => console.error('Não foi possível apagar a nota:', err));
  }

  function handleTogglePin(id: string) {
    marcar(id);
    setNotes((prev) =>
      prev.map((note) => (note.id === id ? { ...note, pinned: !note.pinned } : note)),
    );
  }

  async function handleTrocarPasta() {
    const escolhida = await deposito.escolherPasta();
    if (!escolhida) return;
    sujas.current.clear();
    setCarregando(true);
    setPasta(escolhida);
    const carregadas = await deposito.listar();
    setNotes(carregadas);
    setActiveId([...carregadas].sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ?? null);
    setCarregando(false);
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
      if (event.key === 'e') {
        event.preventDefault();
        setAjustes((prev) => ({ ...prev, preview: !prev.preview }));
      }
      if (event.key === ',') {
        event.preventDefault();
        setMostrandoAjustes((prev) => !prev);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div className="app">
      <header className="titlebar">
        <span className="titlebar__mark" />
        <span className="titlebar__name">Ardósia</span>
        <div className="titlebar__acoes">
          <button
            className={`icone${mostrandoAjustes ? ' icone--ativo' : ''}`}
            onClick={() => setMostrandoAjustes((prev) => !prev)}
            title="Ajustes (Ctrl + ,)"
            aria-label="Ajustes"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <path
                d="M8 1.6v1.6M8 12.8v1.6M14.4 8h-1.6M3.2 8H1.6M12.5 3.5l-1.1 1.1M4.6 11.4l-1.1 1.1M12.5 12.5l-1.1-1.1M4.6 4.6L3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
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
        />
        <Editor
          note={activeNote}
          preview={ajustes.preview}
          onChange={handleChangeBlocos}
          onDelete={handleDelete}
          onMudarTipo={handleMudarTipo}
          onAlternarPreview={() => setAjustes((prev) => ({ ...prev, preview: !prev.preview }))}
        />
      </div>

      {mostrandoAjustes && (
        <Ajustes
          ajustes={ajustes}
          onMudar={setAjustes}
          pasta={pasta}
          onAbrirPasta={deposito.abrirPasta}
          onTrocarPasta={handleTrocarPasta}
          onFechar={() => setMostrandoAjustes(false)}
        />
      )}
    </div>
  );
}
