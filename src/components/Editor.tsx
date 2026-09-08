import { useEffect, useMemo, useRef, useState } from 'react';
import { deriveTitle, textoDaNota, type Note, type TipoDoc } from '../notes';
import type { Bloco } from '../canvas';
import { renderizar } from '../markdown';
import { desenharDiagramas } from '../diagrama';
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
  recado?: string | null;
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
  recado,
}: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);

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

  // Desenhar a cada tecla travaria a digitação: espera a pausa. O efeito roda
  // depois que o React já pôs o HTML novo na tela, então há o que desenhar.
  useEffect(() => {
    if (!html) return;
    const timer = setTimeout(() => {
      if (previewRef.current) {
        desenharDiagramas(previewRef.current, temaEscuro).catch((err) =>
          console.error('Não foi possível desenhar o diagrama:', err),
        );
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [html, temaEscuro]);

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

      <div className={`editor__corpo${mostrandoPreview ? ' editor__corpo--dividido' : ''}`}>
        <Canvas
          key={note.id}
          blocos={note.blocos}
          tipo={note.tipo}
          onChange={onChange}
          onColarImagem={onColarImagem}
        />
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
