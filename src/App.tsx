import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import Ajustes from './components/Ajustes';
import Paleta from './components/Paleta';
import Atalhos from './components/Atalhos';
import {
  deriveTitle,
  duplicarNota,
  textoDaNota,
  tituloDoDia,
  trocarTitulo,
  type Note,
  type TipoDoc,
} from './notes';
import { abrirDeposito, depositoEmArquivos, type Deposito } from './deposito';
import { arquivosDaPasta, escolherPastaDoNavegador, navegadorTemPasta, pastaLembrada } from './pasta';
import type { Bloco } from './canvas';
import { matchesQuery } from './search';
import {
  CRITERIOS,
  fixadasEmOrdem,
  ordenarSoltas,
  proximaOrdem,
  reordenarFixadas,
  type Criterio,
} from './ordenacao';
import { construirIndice, renomearNasOutras } from './links';
import { trechoDaNota } from './sugestoes';
import { notasComTag, tagsDoCaderno } from './tags';
import { juntarComDisco } from './conflito';
import {
  acompanharFoco,
  aoAtualizar,
  instalarAtualizacao,
  modoDeFundoDaJanela,
  mostrarNaPasta,
  registrarErrosEmArquivo,
  trocarModoDeFundo,
  type Atualizacao,
} from './janela';
import {
  TAMANHOS,
  TEMAS,
  carregarAjustes,
  salvarAjustes,
  temaDoSistema,
  type Ajustes as AjustesTipo,
} from './ajustes';
import {
  atual as documentoDoPasso,
  desfazer,
  iniciar,
  refazer,
  registrar,
  type Historico,
} from './historico';
import type { Comando } from './comandos';

export default function App() {
  // O depósito pode trocar em pé: no navegador, quando você dá acesso à pasta
  // do aplicativo, as notas deixam de vir do localStorage e passam a vir dos
  // mesmos arquivos .md que o Ardósia instalado usa.
  const [deposito, setDeposito] = useState<Deposito>(() => abrirDeposito());
  const [notes, setNotes] = useState<Note[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [pasta, setPasta] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  /** Filtro da lista lateral: uma tag, ou as notas que ninguém cita. */
  const [filtro, setFiltro] = useState<{ tipo: 'tag'; tag: string } | { tipo: 'orfas' } | null>(null);
  const [ajustes, setAjustes] = useState<AjustesTipo>(carregarAjustes);
  const [mostrandoAjustes, setMostrandoAjustes] = useState(false);
  const [mostrandoPaleta, setMostrandoPaleta] = useState(false);
  const [mostrandoAtalhos, setMostrandoAtalhos] = useState(false);
  const [salvamento, setSalvamento] = useState<'salvo' | 'salvando' | 'erro'>('salvo');
  /** Notas cujo arquivo mudou por fora enquanto havia edição pendente aqui. */
  const [conflitos, setConflitos] = useState<Map<string, Note>>(new Map());
  const [recado, setRecado] = useState<string | null>(null);
  const [atualizacao, setAtualizacao] = useState<Atualizacao | null>(null);

  // Só interessa avisar quando há o que fazer: estar em dia não é notícia.
  useEffect(() => aoAtualizar(setAtualizacao), []);

  // O que quebrar na janela vai para o arquivo de erros do app: sem isso,
  // diagnosticar o aplicativo instalado dependeria de alguém abrir o console.
  useEffect(() => registrarErrosEmArquivo(), []);

  // Seguir o claro/escuro do sistema, quando se pede isso. O navegador já
  // responde essa pergunta, e a resposta muda sozinha quando o Windows muda.
  useEffect(() => {
    if (!ajustes.temaAutomatico) return;
    const consulta = window.matchMedia('(prefers-color-scheme: dark)');
    const aplicar = () =>
      setAjustes((prev) =>
        prev.temaAutomatico ? { ...prev, tema: temaDoSistema(consulta.matches) } : prev,
      );

    aplicar();
    consulta.addEventListener('change', aplicar);
    return () => consulta.removeEventListener('change', aplicar);
  }, [ajustes.temaAutomatico]);

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
  // o valor mais recente das notas para quem lê depois de um await
  const notesRef = useRef(notes);
  notesRef.current = notes;

  useEffect(() => {
    const raiz = document.documentElement;
    raiz.dataset.theme = ajustes.tema;
    raiz.style.setProperty('--corpo', `${ajustes.corpo}px`);
    raiz.style.setProperty('--acento', ajustes.acento);
    raiz.style.setProperty('--opacidade', `${ajustes.opacidade}%`);
    raiz.dataset.fundo = ajustes.fundo;
    salvarAjustes(ajustes);
  }, [ajustes]);

  useEffect(() => {
    if (navigator.userAgent.includes('Electron')) {
      document.documentElement.dataset.native = 'true';
    }
  }, []);

  // O Windows apaga o acrílico da janela inativa; sem saber disso o app fica
  // ilegível toda vez que você clica em outra coisa.
  useEffect(() => acompanharFoco(), []);

  // Quem manda sobre o material é a janela, não a memória dele.
  useEffect(() => {
    modoDeFundoDaJanela()
      .then((modo) => {
        if (modo) setAjustes((prev) => (prev.fundo === modo ? prev : { ...prev, fundo: modo }));
      })
      .catch((err) => console.error('Não foi possível ler o modo da janela:', err));
  }, []);

  // A permissão dada numa sessão anterior é retomada sozinha; pedir uma nova
  // exige um clique seu, e o navegador não deixa ser de outro jeito.
  useEffect(() => {
    if (window.ardosia) return;
    pastaLembrada()
      .then((raiz) => raiz && setDeposito(depositoEmArquivos(arquivosDaPasta(raiz))))
      .catch((err) => console.error('Não foi possível retomar a pasta:', err));
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
    // as notas vêm do ref, e não do updater do setNotes: calcular a junção
    // dentro do updater obrigaria a mexer noutro estado lá dentro, e um
    // updater tem de ser função pura — o React chama duas vezes em
    // desenvolvimento justamente para cobrar isso
    const { notas, conflitos: achados } = juntarComDisco(notesRef.current, doDisco, sujas.current);
    setNotes(notas);

    // o conflito é da nota, e não da sessão: guardar por id deixa cada um ser
    // resolvido na hora em que a pessoa chegar naquela nota
    if (achados.length > 0) {
      setConflitos((antes) => {
        const juntos = new Map(antes);
        for (const conflito of achados) juntos.set(conflito.id, conflito.doDisco);
        return juntos;
      });
    }
  }, [deposito]);

  /**
   * Devolve o teclado para a lista de notas. O botão da nota aberta é quem
   * recebe o foco: dali as setas ja navegam, que e o que o Esc promete.
   */
  function focarNaLista() {
    if (!activeId) return;
    document
      .querySelector<HTMLButtonElement>(`.notelist [data-nota="${CSS.escape(activeId)}"]`)
      ?.focus();
  }

  /** Ficar com o que está na tela: o arquivo será sobrescrito no próximo salvamento. */
  function manterOMeu(id: string) {
    setConflitos((antes) => {
      const juntos = new Map(antes);
      juntos.delete(id);
      return juntos;
    });
    sujas.current.add(id);
    setSalvamento('salvando');
  }

  /** Ficar com o que veio de fora, largando a versão que estava na tela. */
  function usarODoDisco(id: string) {
    const doDisco = conflitos.get(id);
    if (!doDisco) return;
    sujas.current.delete(id);
    setNotes((antes) => antes.map((nota) => (nota.id === id ? doDisco : nota)));
    setConflitos((antes) => {
      const juntos = new Map(antes);
      juntos.delete(id);
      return juntos;
    });
  }

  // No navegador não há vigia de pasta: a hora natural de reler é quando a
  // janela volta a ficar visível, que é quando você acabou de mexer no outro.
  useEffect(() => {
    function aoVoltar() {
      if (document.visibilityState !== 'visible') return;
      recarregarDoDisco().catch((err) => console.error('Não foi possível reler a pasta:', err));
    }
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('focus', aoVoltar);
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('focus', aoVoltar);
    };
  }, [recarregarDoDisco]);

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
  // Quem cita quem. Refeito quando as notas mudam — é um Map por dentro, então
  // aguenta as mil notas do teste sem pesar. Fica ANTES da lista visível porque
  // é insumo dela: construí-lo dentro do filtro custaria uma varredura do
  // caderno inteiro por nota, e o app pararia de responder muito antes das mil.
  const indice = useMemo(() => construirIndice(notes), [notes]);

  const visibleNotes = useMemo(() => {
    const emOrdem = [...fixadasEmOrdem(notes), ...ordenarSoltas(notes, ajustes.ordem)];
    const filtradas =
      filtro === null
        ? emOrdem
        : filtro.tipo === 'tag'
          ? notasComTag(emOrdem, filtro.tag)
          : emOrdem.filter((nota) => indice.apontadaPor(nota.id).length === 0);

    return filtradas.filter((note) => matchesQuery(textoDaNota(note.blocos), query));
  }, [notes, query, ajustes.ordem, filtro, indice]);

  const tags = useMemo(() => tagsDoCaderno(notes), [notes]);

  const activeNote = notes.find((note) => note.id === activeId) ?? null;


  const backlinks = useMemo(
    () =>
      activeId
        ? indice.apontadaPor(activeId).map((id) => ({
            id,
            titulo: deriveTitle(textoDaNota(notes.find((n) => n.id === id)?.blocos ?? [])),
          }))
        : [],
    [activeId, indice, notes],
  );

  // A nota aberta fica fora da lista: sugerir uma ligação para ela mesma não
  // leva a lugar nenhum, e o título dela é justo o texto que se está digitando.
  const titulos = useMemo(
    () =>
      notes
        .filter((nota) => nota.id !== activeId)
        .map((nota) => deriveTitle(textoDaNota(nota.blocos))),
    [notes, activeId],
  );

  // O começo de cada nota, por título. Duas notas com o mesmo título são um
  // caso raro e sem resposta certa: fica a primeira, como na lista.
  const trechos = useMemo(() => {
    const mapa: Record<string, string> = {};
    for (const nota of notes) {
      const texto = textoDaNota(nota.blocos);
      const titulo = deriveTitle(texto);
      if (!(titulo in mapa)) mapa[titulo] = trechoDaNota(texto);
    }
    return mapa;
  }, [notes]);

  /**
   * Seguir uma ligação. Se a nota não existe, ela nasce ali mesmo, já com o
   * título que o link pedia — escrever `[[Kant]]` é uma forma de dizer "isto
   * merece uma nota", e obrigar a criá-la à mão quebraria o pensamento.
   */
  function handleAbrirLigacao(alvo: string) {
    const existente = indice.resolver(alvo);
    if (existente) {
      setActiveId(existente);
      return;
    }
    const nova = deposito.criar(ajustes.tipoPadrao);
    const comTitulo = { ...nova, blocos: [{ ...nova.blocos[0], texto: alvo }] };
    marcar(comTitulo.id);
    setNotes((prev) => [comTitulo, ...prev]);
    setActiveId(comTitulo.id);
  }

  function marcar(id: string) {
    sujas.current.add(id);
    setSalvamento('salvando');
  }

  /**
   * Um histórico por nota, e não um só para o app: trocar de nota para conferir
   * outra coisa e voltar é rotina neste editor, e perder o desfazer por causa
   * disso seria pior que não ter desfazer.
   */
  const historicos = useRef(new Map<string, Historico>());

  function historicoDa(id: string, blocos: Bloco[]): Historico {
    const guardado = historicos.current.get(id);
    if (guardado) return guardado;
    const primeiro = iniciar(blocos);
    historicos.current.set(id, primeiro);
    return primeiro;
  }

  function andarNoHistorico(mover: (historico: Historico) => Historico) {
    if (!activeId) return;
    const nota = notes.find((outra) => outra.id === activeId);
    if (!nota) return;

    const antes = historicoDa(activeId, nota.blocos);
    const depois = mover(antes);
    if (depois === antes) return;

    historicos.current.set(activeId, depois);
    marcar(activeId);
    const blocos = documentoDoPasso(depois);
    setNotes((prev) =>
      prev.map((outra) =>
        outra.id === activeId ? { ...outra, blocos, updatedAt: Date.now() } : outra,
      ),
    );
  }

  function handleNewNote() {
    const note = deposito.criar(ajustes.tipoPadrao);
    setNotes((prev) => [note, ...prev]);
    setActiveId(note.id);
    setQuery('');
  }

  /**
   * Renomear a nota aberta, e arrastar junto quem apontava para ela: sem isto,
   * cada `[[Título antigo]]` das outras notas viraria uma ligação quebrada —
   * renomear passaria a ser uma operação que estraga o caderno.
   */
  function handleRenomear(titulo: string) {
    if (!activeNote) return;
    const antigo = deriveTitle(textoDaNota(activeNote.blocos));
    handleChangeBlocos(trocarTitulo(activeNote.blocos, titulo));

    const tocadas = renomearNasOutras(notesRef.current, activeNote.id, antigo, titulo);
    if (tocadas.length === 0) return;

    const porId = new Map(tocadas.map((nota) => [nota.id, nota]));
    for (const nota of tocadas) marcar(nota.id);
    setNotes((prev) => prev.map((nota) => porId.get(nota.id) ?? nota));
  }

  /** A cópia entra ao lado da original e já fica aberta, pronta para ser mudada. */
  function handleDuplicar(id: string) {
    const original = notes.find((nota) => nota.id === id);
    if (!original) return;
    const copia = duplicarNota(original);
    setNotes((prev) => [copia, ...prev]);
    marcar(copia.id);
    setActiveId(copia.id);
    setQuery('');
  }

  /**
   * A nota de hoje: abre a que já existe, ou cria uma com a data por título.
   * Não nasce sozinha ao abrir o app de propósito — dia em que não se escreve
   * nada viraria arquivo vazio na pasta, e a pasta é dele.
   */
  function handleNotaDeHoje() {
    const titulo = tituloDoDia(new Date());
    const existente = notes.find((nota) => deriveTitle(textoDaNota(nota.blocos)) === titulo);
    if (existente) {
      setActiveId(existente.id);
      setQuery('');
      return;
    }

    const nota = deposito.criar(ajustes.tipoPadrao);
    const comTitulo = { ...nota, blocos: trocarTitulo(nota.blocos, titulo) };
    setNotes((prev) => [comTitulo, ...prev]);
    marcar(comTitulo.id);
    setActiveId(comTitulo.id);
    setQuery('');
  }

  function handleChangeBlocos(blocos: Bloco[]) {
    if (!activeId) return;
    const anteriores = notes.find((nota) => nota.id === activeId)?.blocos ?? blocos;
    historicos.current.set(activeId, registrar(historicoDa(activeId, anteriores), blocos));
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
    historicos.current.delete(id);
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

  /**
   * Trocar entre acrílico e vidro reabre a janela: transparência e material do
   * sistema são decididos quando ela nasce. Sair do acrílico com o fundo
   * totalmente transparente deixaria só texto no ar, então damos um piso.
   */
  async function handleTrocarFundo(fundo: 'acrilico' | 'vidro') {
    if (fundo === ajustes.fundo) return;
    const opacidade = fundo === 'vidro' && ajustes.opacidade < 20 ? 45 : ajustes.opacidade;
    const proximos = { ...ajustes, fundo, opacidade };
    setAjustes(proximos);
    // Gravar AQUI, e não deixar para o efeito: a troca destrói esta janela, e o
    // efeito não chega a rodar. Era assim que a escolha se perdia toda vez.
    salvarAjustes(proximos);
    await trocarModoDeFundo(fundo);
  }

  /**
   * Dar ao navegador acesso à pasta do aplicativo. A partir daí os dois leem os
   * mesmos arquivos: não é cópia nem sincronização, é a mesma fonte de verdade.
   */
  async function handleUsarPastaNoNavegador() {
    try {
      const raiz = await escolherPastaDoNavegador();
      if (!raiz) return;
      sujas.current.clear();
      setDeposito(depositoEmArquivos(arquivosDaPasta(raiz)));
    } catch (err) {
      console.error('Não foi possível abrir a pasta:', err);
      setRecado('Não foi possível abrir a pasta.');
    }
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
        id: 'desfazer',
        titulo: 'Desfazer',
        secao: 'Escrita',
        atalho: 'Ctrl + Z',
        executar: () => andarNoHistorico(desfazer),
      },
      {
        id: 'refazer',
        titulo: 'Refazer',
        secao: 'Escrita',
        atalho: 'Ctrl + Y',
        executar: () => andarNoHistorico(refazer),
      },
      {
        id: 'buscar',
        titulo: 'Buscar nas notas',
        secao: 'Notas',
        atalho: 'Ctrl + Shift + F',
        executar: () => searchRef.current?.focus(),
      },
      {
        id: 'fixar',
        titulo: activeNote?.pinned ? 'Desafixar esta nota' : 'Fixar esta nota',
        secao: 'Notas',
        executar: () => activeId && handleTogglePin(activeId),
      },
      {
        id: 'hoje',
        titulo: 'Nota de hoje',
        secao: 'Notas',
        atalho: 'Ctrl + Shift + D',
        executar: handleNotaDeHoje,
      },
      {
        id: 'orfas',
        titulo: 'Notas que ninguém cita',
        secao: 'Notas',
        executar: () => setFiltro({ tipo: 'orfas' }),
      },
      {
        id: 'na-pasta',
        titulo: 'Mostrar esta nota na pasta',
        secao: 'Notas',
        executar: () => activeId && mostrarNaPasta(activeId),
      },
      {
        id: 'duplicar',
        titulo: 'Duplicar esta nota',
        secao: 'Notas',
        executar: () => activeId && handleDuplicar(activeId),
      },
      ...(Object.entries(CRITERIOS) as [Criterio, string][]).map(([criterio, rotulo]) => ({
        id: `ordem-${criterio}`,
        titulo: `Ordenar a lista por ${rotulo.toLowerCase()}`,
        secao: 'Notas',
        executar: () => setAjustes((prev) => ({ ...prev, ordem: criterio })),
      })),
      {
        id: 'lateral',
        titulo: ajustes.lateral ? 'Recolher a barra lateral' : 'Mostrar a barra lateral',
        secao: 'Aparência',
        atalho: 'Ctrl + \\',
        executar: () => setAjustes((prev) => ({ ...prev, lateral: !prev.lateral })),
      },
      {
        id: 'atalhos',
        titulo: 'Ajuda de atalhos',
        secao: 'Aparência',
        atalho: 'Ctrl + /',
        executar: () => setMostrandoAtalhos((prev) => !prev),
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
      // Ctrl+F sozinho procura dentro da nota aberta, como em qualquer editor,
      // e quem cuida dele é o Editor. Aqui fica a busca entre notas.
      if (event.key.toLowerCase() === 'f' && event.shiftKey) {
        event.preventDefault();
        // com a barra recolhida não há campo para focar: ela volta primeiro
        setAjustes((prev) => (prev.lateral ? prev : { ...prev, lateral: true }));
        requestAnimationFrame(() => searchRef.current?.focus());
      }
      if (event.key === 'e') {
        event.preventDefault();
        setAjustes((prev) => ({ ...prev, preview: !prev.preview }));
      }
      if (event.key === ',') {
        event.preventDefault();
        setMostrandoAjustes((prev) => !prev);
      }
      if (event.key === '\\') {
        event.preventDefault();
        setAjustes((prev) => ({ ...prev, lateral: !prev.lateral }));
      }
      if (event.key === '/') {
        event.preventDefault();
        setMostrandoAtalhos((prev) => !prev);
      }
      if (event.key.toLowerCase() === 'd' && event.shiftKey) {
        event.preventDefault();
        handleNotaDeHoje();
      }
      // O desfazer do navegador só enxerga a caixa onde o cursor está; desfazer
      // meio documento é pior que não desfazer, então tomamos a tecla inteira.
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        andarNoHistorico(event.shiftKey ? refazer : desfazer);
      }
      if (event.key.toLowerCase() === 'y') {
        event.preventDefault();
        andarNoHistorico(refazer);
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
        {atualizacao?.estado === 'pronta' && (
          <button
            className="titlebar__atualizar"
            onClick={() => void instalarAtualizacao()}
            title={`A versão ${atualizacao.versao ?? 'nova'} está baixada. O app reinicia para trocar.`}
          >
            Atualizar para {atualizacao.versao ?? 'a versão nova'}
          </button>
        )}

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

      <div className={`workspace${ajustes.lateral ? '' : ' workspace--so-editor'}`}>
        {ajustes.lateral && (
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
          tags={tags}
          filtro={filtro}
          onFiltrar={setFiltro}
          onLimparFiltro={() => setFiltro(null)}
        />
        )}
        <Editor
          note={activeNote}
          preview={ajustes.preview}
          salvamento={salvamento}
          onChange={handleChangeBlocos}
          onDelete={handleDelete}
          onMudarTipo={handleMudarTipo}
          onColarImagem={handleColarImagem}
          recado={recado}
          cadernoVazio={!carregando && notes.length === 0}
          conflito={activeId !== null && conflitos.has(activeId)}
          onSairDoBloco={focarNaLista}
          onRecado={setRecado}
          onRenomear={handleRenomear}
          onManterOMeu={() => activeId && manterOMeu(activeId)}
          onUsarODoDisco={() => activeId && usarODoDisco(activeId)}
          backlinks={backlinks}
          titulos={titulos}
          trechos={trechos}
          existeNota={(alvo) => indice.resolver(alvo) !== null}
          onAbrirLigacao={handleAbrirLigacao}
          onAbrirNota={setActiveId}
          divisoria={ajustes.divisoria}
          onMudarDivisoria={(divisoria) => setAjustes((prev) => ({ ...prev, divisoria }))}
          temaEscuro={ajustes.tema !== 'papel'}
          acento={ajustes.acento}
          onAlternarPreview={() => setAjustes((prev) => ({ ...prev, preview: !prev.preview }))}
        />
      </div>

      {mostrandoPaleta && (
        <Paleta comandos={comandos} onFechar={() => setMostrandoPaleta(false)} />
      )}

      {mostrandoAtalhos && <Atalhos onFechar={() => setMostrandoAtalhos(false)} />}

      {mostrandoAjustes && (
        <Ajustes
          ajustes={ajustes}
          onMudar={setAjustes}
          pasta={pasta}
          onAbrirPasta={deposito.abrirPasta}
          onTrocarPasta={handleTrocarPasta}
          onTrocarFundo={handleTrocarFundo}
          podeUsarPasta={navegadorTemPasta() && !pasta}
          onUsarPasta={handleUsarPastaNoNavegador}
          onFechar={() => setMostrandoAjustes(false)}
        />
      )}
    </div>
  );
}
