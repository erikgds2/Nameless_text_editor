import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { deriveTitle, textoDaNota, type Note, type TipoDoc } from '../notes';
import type { Bloco } from '../canvas';
import { renderizar } from '../markdown';
import { desenharDiagramas, esquecerDiagramas, reporDiagramas } from '../diagrama';
import Canvas from './Canvas';

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
}: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const corpoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setConfirmingDelete(false), [note?.id]);

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

  // As cores do diagrama ficam assadas dentro do SVG, então trocar de tema ou
  // de cor de destaque exige refazê-lo. Este efeito vem antes do que desenha
  // justamente para o próximo já encontrar serviço.
  useEffect(() => {
    if (previewRef.current) esquecerDiagramas(previewRef.current);
  }, [temaEscuro, acento]);

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
          <h1 className="editor__title">{deriveTitle(texto)}</h1>
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

      <div
        className={`editor__corpo${mostrandoPreview ? ' editor__corpo--dividido' : ''}`}
        ref={corpoRef}
        style={{ '--divisoria': `${divisoria}%` } as CSSProperties}
      >
        <Canvas
          key={note.id}
          blocos={note.blocos}
          tipo={note.tipo}
          onChange={onChange}
          onColarImagem={onColarImagem}
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
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <div className="preview">
              <p className="preview__vazio">A pré-visualização aparece aqui conforme você escreve.</p>
            </div>
          ))}
      </div>

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
