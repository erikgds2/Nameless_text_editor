import { useEffect, useRef, useState } from 'react';
import { CANETAS, FUNDOS, LETRAS, type Caneta, type Fundo, type Letra } from '../canvas';

/** O nome de cada caneta e de cada letra, como aparecem para quem escolhe. */
const NOME_DA_CANETA: Record<Caneta, string> = {
  grafite: 'Grafite',
  ocre: 'Ocre',
  terracota: 'Terracota',
  azul: 'Azul',
  verde: 'Verde',
};

const NOME_DO_FUNDO: Record<Fundo, string> = {
  nenhum: 'Sem papel',
  ocre: 'Papel ocre',
  terracota: 'Papel terracota',
  azul: 'Papel azul',
  verde: 'Papel verde',
};

const NOME_DA_LETRA: Record<Letra, string> = {
  mono: 'De sempre',
  leitura: 'De leitura',
  mao: 'De mão',
};

type Props = {
  caneta: Caneta;
  letra: Letra;
  fundo: Fundo;
  onCaneta: (caneta: Caneta) => void;
  onLetra: (letra: Letra) => void;
  onFundo: (fundo: Fundo) => void;
};

/**
 * O estojo da seção: com que caneta, em que papel e com que letra este trecho
 * foi escrito.
 *
 * Fica fechado até alguém pedir. Uma barra de cores sempre à mostra em toda
 * seção seria a interface cobrando pedágio de quem só quer escrever — e cada
 * peça aqui paga o próprio peso na tela.
 */
export default function Estojo({ caneta, letra, fundo, onCaneta, onLetra, onFundo }: Props) {
  const [aberto, setAberto] = useState(false);
  const raizRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!aberto) return;

    function fechar(evento: MouseEvent) {
      if (!raizRef.current?.contains(evento.target as Node)) setAberto(false);
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setAberto(false);
    }

    document.addEventListener('mousedown', fechar);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', fechar);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto]);

  /**
   * Nada aqui pode roubar o foco do texto. Uma seção ainda vazia some quando o
   * campo perde o foco — escolher a caneta antes de escrever apagaria a seção
   * debaixo de quem estava começando a escrever nela.
   */
  const naoRoubarFoco = (evento: { preventDefault: () => void }) => evento.preventDefault();

  return (
    <div className="estojo" ref={raizRef}>
      {/* O botão está dentro da seção: a caneta e a letra dela já chegam aqui
          por herança, e o "A" aparece exatamente como o texto vai sair. */}
      <button
        className="estojo__abrir"
        title="Caneta e letra desta seção"
        aria-label="Caneta e letra desta seção"
        aria-expanded={aberto}
        onMouseDown={naoRoubarFoco}
        onClick={() => setAberto((estava) => !estava)}
      >
        A
      </button>

      {aberto && (
        <div className="estojo__painel">
          <div className="estojo__grupo" role="group" aria-label="Caneta">
            {CANETAS.map((opcao) => (
              <button
                key={opcao}
                className={`estojo__caneta estojo--${opcao}${opcao === caneta ? ' estojo__caneta--atual' : ''}`}
                title={NOME_DA_CANETA[opcao]}
                aria-label={NOME_DA_CANETA[opcao]}
                aria-pressed={opcao === caneta}
                onMouseDown={naoRoubarFoco}
                onClick={() => onCaneta(opcao)}
              />
            ))}
          </div>

          <div className="estojo__grupo" role="group" aria-label="Papel">
            {FUNDOS.map((opcao) => (
              <button
                key={opcao}
                className={
                  `estojo__papel estojo--${opcao}` +
                  (opcao === 'nenhum' ? ' estojo__papel--nenhum' : '') +
                  (opcao === fundo ? ' estojo__papel--atual' : '')
                }
                title={NOME_DO_FUNDO[opcao]}
                aria-label={NOME_DO_FUNDO[opcao]}
                aria-pressed={opcao === fundo}
                onMouseDown={naoRoubarFoco}
                onClick={() => onFundo(opcao)}
              />
            ))}
          </div>

          <div className="estojo__grupo" role="group" aria-label="Letra">
            {LETRAS.map((opcao) => (
              <button
                key={opcao}
                className={`estojo__letra estojo--letra-${opcao}${opcao === letra ? ' estojo__letra--atual' : ''}`}
                aria-pressed={opcao === letra}
                onMouseDown={naoRoubarFoco}
                onClick={() => onLetra(opcao)}
              >
                {NOME_DA_LETRA[opcao]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
