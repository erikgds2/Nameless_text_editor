import { useEffect } from 'react';
import type { KeyboardEvent, RefObject } from 'react';

type Props = {
  /** Vem de fora porque `Ctrl+F` com a barra já aberta tem de voltar o foco para cá. */
  campoRef: RefObject<HTMLInputElement | null>;
  termo: string;
  onTermo: (termo: string) => void;
  /** Quantas ocorrências existem na nota inteira. */
  total: number;
  /** Em qual delas a navegação está, contando de zero. */
  atual: number;
  onAndar: (passo: 1 | -1) => void;
  onFechar: () => void;
};

/**
 * A barra que procura dentro da nota aberta. Fica sobre o canvas, no alto à
 * direita, e o foco vai para o campo assim que ela abre — quem apertou Ctrl+F
 * já sabe o que vai digitar.
 *
 * A navegação nunca tira o foco daqui: andar entre ocorrências rola a página
 * até elas, mas continuar digitando tem de refinar a busca, não escrever na
 * nota.
 */
export default function BuscaNaNota({ campoRef, termo, onTermo, total, atual, onAndar, onFechar }: Props) {
  useEffect(() => campoRef.current?.focus(), [campoRef]);

  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      onFechar();
    }
    if (evento.key === 'Enter') {
      evento.preventDefault();
      onAndar(evento.shiftKey ? -1 : 1);
    }
  }

  const nada = termo.trim() !== '' && total === 0;

  return (
    <div className="busca-nota" role="search">
      <input
        ref={campoRef}
        className="busca-nota__campo"
        type="search"
        value={termo}
        placeholder="Procurar nesta nota"
        aria-label="Procurar nesta nota"
        onChange={(evento) => onTermo(evento.target.value)}
        onKeyDown={aoTeclar}
      />
      <span className={`busca-nota__conta${nada ? ' busca-nota__conta--nada' : ''}`}>
        {nada ? 'nada' : total === 0 ? '' : `${atual + 1} de ${total}`}
      </span>
      <button
        className="busca-nota__botao"
        onClick={() => onAndar(-1)}
        disabled={total === 0}
        title="Ocorrência anterior (Shift + Enter)"
        aria-label="Ocorrência anterior"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 7.5L6 4.5l3 3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        className="busca-nota__botao"
        onClick={() => onAndar(1)}
        disabled={total === 0}
        title="Próxima ocorrência (Enter)"
        aria-label="Próxima ocorrência"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 4.5L6 7.5l3-3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        className="busca-nota__botao"
        onClick={onFechar}
        title="Fechar a busca (Esc)"
        aria-label="Fechar a busca"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
