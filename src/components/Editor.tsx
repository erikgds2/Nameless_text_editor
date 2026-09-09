import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { deriveTitle, textoDaNota, type Note, type TipoDoc } from '../notes';
import type { Bloco } from '../canvas';
import { renderizar } from '../markdown';
import { acharNaNota } from '../busca';
import { desenharDiagramas, esquecerDiagramas, reporDiagramas } from '../diagrama';
import Canvas from './Canvas';
import BuscaNaNota from './BuscaNaNota';

export type Salvamento = 'salvo' | 'salvando' | 'erro';

const RECADO: Record<Salvamento, string> = {
  salvo: 'Salva',
  salvando: 'Salvando…',
  erro: 'Não foi possível salvar',
};

type Props = {
  note: Note | null;
  preview: boolean;
  salvamento?: Salvamento;
  onChange: (blocos: Bloco[]) => void;
  onDelete: (id: string) => void;
  onMudarTipo: (tipo: TipoDoc) => void;
  onAlternarPreview: () => void;
  onColarImagem: (bytes: Uint8Array, tipo: string) => Promise<string | null>;
  temaEscuro: boolean;
  acento: string;
  recado?: string | null;
  divisoria: number;
  onMudarDivisoria: (por_cento: number) => void;
  /** Não há nota nenhuma no caderno: é a primeira abertura, e ela ensina. */
  cadernoVazio?: boolean;
  /** O arquivo desta nota mudou por fora enquanto havia edição pendente aqui. */
  conflito?: boolean;
  /** Esc dentro de um bloco devolve o teclado para a lista de notas. */
  onSairDoBloco: () => void;
  /** Renomear a nota: o texto novo entra na primeira linha. */
  onRenomear: (titulo: string) => void;
  onManterOMeu?: () => void;
  onUsarODoDisco?: () => void;
  backlinks: { id: string; titulo: string }[];
  titulos: string[];
  /** O começo de cada nota, por título, para a lista de ligações. */
  trechos: Record<string, string>;
  existeNota: (alvo: string) => boolean;
  onAbrirLigacao: (alvo: string) => void;
  onAbrirNota: (id: string) => void;
};

const timeFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * O .md guarda `anexos/foo.png`, que é um caminho relativo e portátil. A janela
 * não consegue ler arquivo do disco por conta própria: quem serve a imagem é o
 * protocolo do app, e é aqui que o caminho vira endereço.
 */
function comAnexosResolvidos(html: string): string {
  return html.replaceAll('src="anexos/', 'src="ardosia://anexos/');
}

function countWords(texto: string): number {
  const words = texto.trim().match(/\S+/g);
  return words ? words.length : 0;
}

export default function Editor({
  note,
  preview,
  salvamento = 'salvo',
  onChange,
  onDelete,
  onMudarTipo,
  onAlternarPreview,
  onColarImagem,
  temaEscuro,
  acento,
  recado,
  divisoria,
  onMudarDivisoria,
  cadernoVazio = false,
  conflito = false,
  onSairDoBloco,
  onRenomear,
  onManterOMeu,
  onUsarODoDisco,
  backlinks,
  titulos,
  trechos,
  existeNota,
  onAbrirLigacao,
  onAbrirNota,
}: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // `null` é a barra fechada. `atual` é o índice da ocorrência visitada.
  const [busca, setBusca] = useState<{ termo: string; atual: number } | null>(null);
  /** `null` enquanto o título não está sendo editado. */
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const corpoRef = useRef<HTMLDivElement | null>(null);
  const buscaRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setConfirmingDelete(false), [note?.id]);

  // Trocar de nota fecha a busca: o termo era daquela página, não desta.
  useEffect(() => setBusca(null), [note?.id]);
  useEffect(() => setRenomeando(null), [note?.id]);

  /**
   * Renomear é reescrever a primeira linha, porque é dela que sai o título — e,
   * no salvamento seguinte, o nome do arquivo. Título em branco não vale: a
   * nota perderia o nome sem que ninguém tivesse pedido isso.
   */
  function confirmarNome() {
    const novo = renomeando?.trim();
    if (novo && novo !== deriveTitle(texto)) onRenomear(novo);
    setRenomeando(null);
  }

  useEffect(() => {
    if (!confirmingDelete) return;
    const timer = setTimeout(() => setConfirmingDelete(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmingDelete]);

  const texto = note ? textoDaNota(note.blocos) : '';
  const ehMarkdown = note?.tipo === 'markdown';
  const mostrandoPreview = ehMarkdown && preview;

  // renderizar a cada tecla custa caro em nota grande; só refaz quando muda
  const html = useMemo(
    () => (mostrandoPreview ? comAnexosResolvidos(renderizar(texto)) : ''),
    [mostrandoPreview, texto],
  );

  // A busca percorre os blocos, e não o texto costurado: cada ocorrência tem de
  // saber em qual bloco caiu para o realce ir parar na camada certa.
  const achados = useMemo(
    () => (busca && note ? acharNaNota(note.blocos, busca.termo) : []),
    [busca?.termo, note],
  );

  // A posição na lista é derivada, nunca guardada: apagar uma letra do termo
  // muda quantas ocorrências existem, e um índice velho apontaria para fora.
  const atual = achados.length === 0 ? 0 : Math.min(busca?.atual ?? 0, achados.length - 1);
  const achadoAtual = achados[atual] ?? null;

  const temNota = note !== null;
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      // Ctrl+Shift+F é a busca entre notas, da barra lateral, e mora no App.
      if (!temNota || evento.shiftKey) return;
      if (!(evento.ctrlKey || evento.metaKey) || evento.key.toLowerCase() !== 'f') return;
      evento.preventDefault();
      setBusca((prev) => prev ?? { termo: '', atual: 0 });
      // com a barra já aberta, Ctrl+F volta o foco para o campo e seleciona o
      // termo antigo — é o que todo editor faz, e poupa apagar antes de digitar
      buscaRef.current?.select();
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [temNota]);

  // Andar entre ocorrências tem de trazer o bloco para a tela: numa nota de
  // uma dúzia de blocos a próxima quase sempre está fora da área visível.
  useEffect(() => {
    if (!achadoAtual || !corpoRef.current) return;
    const alvo = corpoRef.current.querySelector(`[data-bloco="${achadoAtual.blocoId}"]`);
    if (alvo instanceof HTMLElement) alvo.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [achadoAtual?.blocoId, achadoAtual?.inicio]);

  function andarNaBusca(passo: 1 | -1) {
    if (achados.length === 0) return;
    const proxima = (atual + passo + achados.length) % achados.length;
    setBusca((prev) => (prev ? { ...prev, atual: proxima } : prev));
  }

  // As cores do diagrama ficam assadas dentro do SVG, então trocar de tema ou
  // de cor de destaque exige refazê-lo. Este efeito vem antes do que desenha
  // justamente para o próximo já encontrar serviço.
  useEffect(() => {
    if (previewRef.current) esquecerDiagramas(previewRef.current);
  }, [temaEscuro, acento]);

  // Ligação para nota que ainda não existe fica com outra cara: clicar nela vai
  // criar a nota, e isso precisa ser visível antes do clique, não depois.
  useEffect(() => {
    const raiz = previewRef.current;
    if (!raiz) return;
    for (const ligacao of raiz.querySelectorAll<HTMLElement>('a.ligacao[data-alvo]')) {
      ligacao.classList.toggle('ligacao--nova', !existeNota(ligacao.dataset.alvo ?? ''));
    }
  });

  /**
   * Sem lista de dependências de propósito. O React reescreve o HTML desta
   * pré-visualização em rerrenderizações que nada têm a ver com o texto —
   * arrastar a divisória, por exemplo — e leva junto o SVG que injetamos. Vigiar
   * só o `html` deixava o diagrama voltar a ser código nessas horas.
   *
   * Repor o que já foi desenhado é imediato; só o diagrama novo espera a pausa
   * na digitação, porque desenhar é lento.
   */
  useEffect(() => {
    const raiz = previewRef.current;
    if (!raiz) return;
    if (!reporDiagramas(raiz)) return;

    const timer = setTimeout(() => {
      desenharDiagramas(raiz, temaEscuro).catch((err) =>
        console.error('Não foi possível desenhar o diagrama:', err),
      );
    }, 300);
    return () => clearTimeout(timer);
  });

  /**
   * Arrastar a divisória escreve direto no style, sem passar pelo React: a cada
   * pixel o estado subiria até o App e mandaria a nota inteira e a
   * pré-visualização renderizarem de novo. O valor só vira preferência quando
   * o botão é solto.
   */
  function arrastarDivisoria(event: ReactPointerEvent<HTMLDivElement>) {
    const corpo = corpoRef.current;
    if (!corpo) return;
    event.currentTarget.setPointerCapture(event.pointerId);

    const caixa = corpo.getBoundingClientRect();
    let ultima = divisoria;

    function mover(movimento: PointerEvent) {
      const bruto = ((movimento.clientX - caixa.left) / caixa.width) * 100;
      ultima = Math.min(80, Math.max(20, Math.round(bruto)));
      corpo?.style.setProperty('--divisoria', `${ultima}%`);
    }

    function soltar() {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      onMudarDivisoria(ultima);
    }

    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
  }

  /** O HTML é injetado inteiro, então o clique é ouvido no pai e não em cada link. */
  function aoClicarNoTexto(event: ReactMouseEvent<HTMLDivElement>) {
    const ligacao = (event.target as HTMLElement).closest<HTMLElement>('a.ligacao[data-alvo]');
    if (!ligacao) return;
    event.preventDefault();
    onAbrirLigacao(ligacao.dataset.alvo ?? '');
  }

  if (!note) {
    // Primeira abertura: a tela vazia é a única chance de ensinar o básico, e
    // três linhas é o que alguém lê antes de começar a escrever.
    return (
      <main className="editor editor--empty">
        {cadernoVazio ? (
          <div className="primeiros-passos">
            <h2 className="primeiros-passos__titulo">Um caderno em branco</h2>
            <p className="primeiros-passos__linha">
              <kbd>Ctrl + N</kbd> cria uma nota. A primeira linha vira o título dela, e o nome do
              arquivo <code>.md</code> na sua pasta.
            </p>
            <p className="primeiros-passos__linha">
              <strong>Duplo clique</strong> em qualquer ponto vazio da página começa um bloco ali —
              a nota é uma folha de rascunho, não uma coluna.
            </p>
            <p className="primeiros-passos__linha">
              <kbd>Ctrl + /</kbd> mostra o resto dos atalhos. Nada aqui exige mouse.
            </p>
          </div>
        ) : (
          <p className="editor__hint">
            Nenhuma nota aberta
            <span>Ctrl + N para criar uma</span>
          </p>
        )}
      </main>
    );
  }

  return (
    <main className="editor">
      <header className="editor__header">
        <div className="editor__meta">
          {renomeando === null ? (
            <h1
              className="editor__title"
              title="Clique para renomear"
              onClick={() => setRenomeando(deriveTitle(texto))}
            >
              {deriveTitle(texto)}
            </h1>
          ) : (
            <input
              className="editor__title editor__title--editando"
              aria-label="Título da nota"
              autoFocus
              value={renomeando}
              onChange={(evento) => setRenomeando(evento.target.value)}
              onKeyDown={(evento) => {
                if (evento.key === 'Enter') confirmarNome();
                if (evento.key === 'Escape') setRenomeando(null);
              }}
              onBlur={confirmarNome}
            />
          )}
          <span className="editor__time">Editado em {timeFormat.format(note.updatedAt)}</span>
        </div>

        <div className="opcoes">
          <button
            className={`opcao${note.tipo === 'markdown' ? ' opcao--on' : ''}`}
            onClick={() => onMudarTipo('markdown')}
            title="Tratar esta nota como Markdown"
          >
            Markdown
          </button>
          <button
            className={`opcao${note.tipo === 'texto' ? ' opcao--on' : ''}`}
            onClick={() => onMudarTipo('texto')}
            title="Tratar esta nota como texto puro"
          >
            Texto
          </button>
        </div>

        {ehMarkdown && (
          <button
            className={`icone${preview ? ' icone--ativo' : ''}`}
            onClick={onAlternarPreview}
            title="Pré-visualização (Ctrl + E)"
            aria-label="Alternar pré-visualização"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <rect
                x="1.5"
                y="3"
                width="13"
                height="10"
                rx="1.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path d="M8 3v10" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        )}

        <button
          className={`btn btn--danger${confirmingDelete ? ' btn--armed' : ''}`}
          onClick={() => (confirmingDelete ? onDelete(note.id) : setConfirmingDelete(true))}
        >
          {confirmingDelete ? 'Confirmar' : 'Excluir'}
        </button>
      </header>

      {conflito && (
        <div className="conflito" role="alert">
          <span className="conflito__aviso">
            Este arquivo mudou por fora enquanto você escrevia aqui.
          </span>
          <button className="conflito__acao" onClick={onManterOMeu}>
            Ficar com o meu
          </button>
          <button className="conflito__acao" onClick={onUsarODoDisco}>
            Usar o do disco
          </button>
        </div>
      )}

      <div
        className={`editor__corpo${mostrandoPreview ? ' editor__corpo--dividido' : ''}`}
        ref={corpoRef}
        style={{ '--divisoria': `${divisoria}%` } as CSSProperties}
      >
        {busca && (
          <BuscaNaNota
            campoRef={buscaRef}
            termo={busca.termo}
            onTermo={(termo) => setBusca({ termo, atual: 0 })}
            total={achados.length}
            atual={atual}
            onAndar={andarNaBusca}
            onFechar={() => setBusca(null)}
          />
        )}
        <Canvas
          key={note.id}
          blocos={note.blocos}
          tipo={note.tipo}
          onChange={onChange}
          onColarImagem={onColarImagem}
          titulos={titulos}
          trechos={trechos}
          achados={achados}
          achadoAtual={achadoAtual}
          onSair={onSairDoBloco}
        />
        {mostrandoPreview && (
          <div
            className="divisoria"
            role="separator"
            aria-label="Ajustar a divisão entre escrita e pré-visualização"
            onPointerDown={arrastarDivisoria}
          />
        )}
        {mostrandoPreview &&
          (texto.trim() ? (
            // o html vem de renderizar(), que escapa todo o texto do usuário
            <div
              className="preview"
              ref={previewRef}
              onClick={aoClicarNoTexto}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <div className="preview">
              <p className="preview__vazio">A pré-visualização aparece aqui conforme você escreve.</p>
            </div>
          ))}
      </div>

      {backlinks.length > 0 && (
        <div className="backlinks">
          <span className="backlinks__rotulo">Apontam para esta nota</span>
          {backlinks.map((quem) => (
            <button key={quem.id} className="backlinks__nota" onClick={() => onAbrirNota(quem.id)}>
              {quem.titulo}
            </button>
          ))}
        </div>
      )}

      <footer className="editor__footer">
        <span>{countWords(texto)} palavras</span>
        <span>{texto.length} caracteres</span>
        <span>{texto.split('\n').length} linhas</span>
        <span className={salvamento === 'erro' ? 'editor__estado--erro' : undefined}>
          {RECADO[salvamento]}
        </span>
        {recado && <span className="editor__recado">{recado}</span>}
      </footer>
    </main>
  );
}
