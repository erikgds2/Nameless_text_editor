import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import Ajustes from './components/Ajustes';
import Paleta from './components/Paleta';
import { deriveTitle, textoDaNota, type Note, type TipoDoc } from './notes';
import { abrirDeposito } from './deposito';
import type { Bloco } from './canvas';
import { matchesQuery } from './search';
import { fixadasEmOrdem, proximaOrdem, reordenarFixadas } from './ordenacao';
import { TAMANHOS, TEMAS, carregarAjustes, salvarAjustes, type Ajustes as AjustesTipo } from './ajustes';
import type { Comando } from './comandos';

export default function App() {
  const deposito = useMemo(abrirDeposito, []);
  const [notes, setNotes] = useState<Note[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [pasta, setPasta] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [ajustes, setAjustes] = useState<AjustesTipo>(carregarAjustes);
  const [mostrandoAjustes, setMostrandoAjustes] = useState(false);
  const [mostrandoPaleta, setMostrandoPaleta] = useState(false);
  const [salvamento, setSalvamento] = useState<'salvo' | 'salvando' | 'erro'>('salvo');
  const [recado, setRecado] = useState<string | null>(null);

  // Um aviso que some sozinho: serve para o que falhou sem barulho, como colar
  // imagem onde não há disco para guardá-la.
  useEffect(() => {
    if (!recado) return;
    const timer = setTimeout(() => setRecado(null), 4000);
    return () => clearTimeout(timer);
  }, [recado]);

  async function handleColarImagem(bytes: Uint8Array, tipo: string) {
    try {
      const nome = await deposito.salvarAnexo(bytes, tipo);
      if (!nome) setRecado('Colar imagem só funciona no aplicativo instalado.');
      return nome;
    } catch (err) {
      console.error('Não foi possível guardar a imagem:', err);
      setRecado('Não foi possível guardar a imagem.');
      return null;
    }
  }
  const searchRef = useRef<HTMLInputElement | null>(null);
  // notas que mudaram e ainda nao foram para o disco
  const sujas = useRef(new Set<string>());

  useEffect(() => {
    const raiz = document.documentElement;
    raiz.dataset.theme = ajustes.tema;
    raiz.style.setProperty('--corpo', `${ajustes.corpo}px`);
    raiz.style.setProperty('--acento', ajustes.acento);
    raiz.style.setProperty('--opacidade', `${ajustes.opacidade}%`);
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

  /**
   * Relê a pasta sem atropelar quem está escrevendo: o que ainda não foi
   * gravado, e a nota nova que nem chegou ao disco, continuam como estão.
   */
  const recarregarDoDisco = useCallback(async () => {
    const doDisco = await deposito.listar();
    setNotes((anteriores) => {
      const preservadas = anteriores.filter(
        (nota) => sujas.current.has(nota.id) || textoDaNota(nota.blocos).trim() === '',
      );
      const porId = new Map(preservadas.map((nota) => [nota.id, nota]));
      const juntas = doDisco.map((doArquivo) => porId.get(doArquivo.id) ?? doArquivo);
      const idsEmDisco = new Set(doDisco.map((nota) => nota.id));
      return [...preservadas.filter((nota) => !idsEmDisco.has(nota.id)), ...juntas];
    });
  }, [deposito]);

  useEffect(
    () =>
      deposito.aoMudar(() => {
        recarregarDoDisco().catch((err) =>
          console.error('Não foi possível reler a pasta:', err),
        );
      }),
    [deposito, recarregarDoDisco],
  );

  // Grava so o que mudou, e so depois que a digitacao para. Uma nota nova e
  // vazia nunca chega ao disco: arquivo so nasce quando ha o que guardar.
  useEffect(() => {
    if (carregando || sujas.current.size === 0) return;
    const timer = setTimeout(async () => {
      const pendentes = [...sujas.current];
      sujas.current.clear();
      let falhou = false;
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
          falhou = true;
        }
      }
      if (falhou) setSalvamento('erro');
      else if (sujas.current.size === 0) setSalvamento('salvo');
    }, 500);
    return () => clearTimeout(timer);
  }, [notes, carregando, deposito]);

  // As fixadas seguem a ordem que voce escolheu; o resto, a edicao mais
  // recente. [...notes] e obrigatorio: sort() muta o array, e este e o estado.
  const visibleNotes = useMemo(() => {
    const soltas = [...notes].filter((n) => !n.pinned).sort((a, b) => b.updatedAt - a.updatedAt);
    return [...fixadasEmOrdem(notes), ...soltas].filter((note) =>
      matchesQuery(textoDaNota(note.blocos), query),
    );
  }, [notes, query]);

  const activeNote = notes.find((note) => note.id === activeId) ?? null;

  function marcar(id: string) {
    sujas.current.add(id);
    setSalvamento('salvando');
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
      prev.map((note) =>
        note.id === id
          ? { ...note, pinned: !note.pinned, ordem: note.pinned ? note.ordem : proximaOrdem(prev) }
          : note,
      ),
    );
  }

  /** Arrastar uma fixada sobre outra troca as posicoes das duas. */
  function handleReordenar(idArrastada: string, idAlvo: string) {
    setNotes((prev) => {
      const depois = reordenarFixadas(prev, idArrastada, idAlvo);
      // so as notas que realmente mudaram de posicao precisam ir ao disco
      for (const nota of depois) {
        if (nota !== prev.find((outra) => outra.id === nota.id)) sujas.current.add(nota.id);
      }
      if (depois !== prev) setSalvamento('salvando');
      return depois;
    });
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

  // A lista da paleta é a lista de tudo que o app faz. Um comando que não
  // aparece aqui é um comando que só existe para quem usa o mouse.
  function montarComandos(): Comando[] {
    const trocarTema = TEMAS.map((tema) => ({
      id: `tema-${tema.id}`,
      titulo: `Tema ${tema.rotulo}`,
      secao: 'Aparência',
      executar: () => setAjustes((prev) => ({ ...prev, tema: tema.id })),
    }));

    const mudarCorpo = (passo: number) => () =>
      setAjustes((prev) => {
        const indice = TAMANHOS.indexOf(prev.corpo) + passo;
        const corpo = TAMANHOS[Math.min(TAMANHOS.length - 1, Math.max(0, indice))];
        return { ...prev, corpo };
      });

    return [
      { id: 'nova', titulo: 'Nova nota', secao: 'Notas', atalho: 'Ctrl + N', executar: handleNewNote },
      {
        id: 'buscar',
        titulo: 'Buscar nas notas',
        secao: 'Notas',
        atalho: 'Ctrl + F',
        executar: () => searchRef.current?.focus(),
      },
      {
        id: 'fixar',
        titulo: activeNote?.pinned ? 'Desafixar esta nota' : 'Fixar esta nota',
        secao: 'Notas',
        executar: () => activeId && handleTogglePin(activeId),
      },
      {
        id: 'preview',
        titulo: ajustes.preview ? 'Esconder a pré-visualização' : 'Mostrar a pré-visualização',
        secao: 'Editor',
        atalho: 'Ctrl + E',
        executar: () => setAjustes((prev) => ({ ...prev, preview: !prev.preview })),
      },
      {
        id: 'markdown',
        titulo: 'Tratar esta nota como Markdown',
        secao: 'Editor',
        executar: () => handleMudarTipo('markdown'),
      },
      {
        id: 'texto',
        titulo: 'Tratar esta nota como texto puro',
        secao: 'Editor',
        executar: () => handleMudarTipo('texto'),
      },
      ...trocarTema,
      { id: 'maior', titulo: 'Aumentar o texto', secao: 'Aparência', executar: mudarCorpo(1) },
      { id: 'menor', titulo: 'Diminuir o texto', secao: 'Aparência', executar: mudarCorpo(-1) },
      {
        id: 'ajustes',
        titulo: 'Abrir os ajustes',
        secao: 'Aparência',
        atalho: 'Ctrl + ,',
        executar: () => setMostrandoAjustes(true),
      },
      // As notas entram por ultimo: com a busca vazia, os comandos aparecem
      // primeiro; digitar duas letras do titulo traz a nota na frente.
      ...visibleNotes.map((nota) => ({
        id: `abrir-${nota.id}`,
        titulo: deriveTitle(textoDaNota(nota.blocos)),
        secao: 'Abrir nota',
        executar: () => setActiveId(nota.id),
      })),
      ...(pasta
        ? [
            {
              id: 'abrir-pasta',
              titulo: 'Abrir a pasta das notas',
              secao: 'Arquivos',
              executar: () => void deposito.abrirPasta(),
            },
            {
              id: 'trocar-pasta',
              titulo: 'Guardar as notas em outra pasta',
              secao: 'Arquivos',
              executar: () => void handleTrocarPasta(),
            },
          ]
        : []),
    ];
  }

  // Remontada a cada render de propósito: é barato, e mantém os rótulos que
  // dependem do estado ("Fixar" x "Desafixar") sempre corretos.
  const comandos = montarComandos();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.key === 'k') {
        event.preventDefault();
        setMostrandoPaleta((prev) => !prev);
      }
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
            {/* controles deslizantes: a engrenagem anterior, um círculo com
                raios, era lida como um sol nesse tamanho */}
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M2 5h5.5M11.5 5H14M2 11h2.5M8.5 11H14"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
              <circle cx="9.5" cy="5" r="1.7" fill="none" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="6.5" cy="11" r="1.7" fill="none" stroke="currentColor" strokeWidth="1.3" />
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
          onReordenar={handleReordenar}
        />
        <Editor
          note={activeNote}
          preview={ajustes.preview}
          salvamento={salvamento}
          onChange={handleChangeBlocos}
          onDelete={handleDelete}
          onMudarTipo={handleMudarTipo}
          onColarImagem={handleColarImagem}
          recado={recado}
          temaEscuro={ajustes.tema !== 'papel'}
          onAlternarPreview={() => setAjustes((prev) => ({ ...prev, preview: !prev.preview }))}
        />
      </div>

      {mostrandoPaleta && (
        <Paleta comandos={comandos} onFechar={() => setMostrandoPaleta(false)} />
      )}

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
