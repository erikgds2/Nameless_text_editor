import type { CSSProperties } from 'react';
import type { Imagem } from '../canvas';
import { ALTURA_MINIMA_DA_FIGURA } from '../imagem';

/**
 * As figuras de um bloco. `inteira` é o caso do bloco que não tem mais nada:
 * a foto ocupa a caixa toda. Senão, elas ficam numa faixa no rodapé, embaixo
 * do texto — que foi onde a pessoa colou.
 */
export default function Figuras({
  figura,
  inteira = false,
  onMedida,
}: {
  figura: Imagem & { endereco: string };
  inteira?: boolean;
  /** Só é chamado quando a seção ainda não sabe quanto a foto pede. */
  onMedida?: (natural: { largura: number; altura: number }) => void;
}) {
  return (
    <div
      className={inteira ? 'bloco__figuras bloco__figuras--inteira' : 'bloco__figuras'}
      style={inteira ? undefined : ({ '--figura': `${figura.altura ?? ALTURA_MINIMA_DA_FIGURA}px` } as CSSProperties)}
    >
      <div className="bloco__figura">
        <img
          className="bloco__imagem"
          src={figura.endereco}
          alt="Imagem colada na nota"
          draggable={false}
          onLoad={(evento) => {
            // Nota colada por uma versão que ainda não guardava o tamanho da
            // faixa: a foto se mede na primeira vez que é desenhada, e a seção
            // aprende quanto ela pede. Sem isto, ela abriria espremida no piso.
            if (figura.altura || !onMedida) return;
            const img = evento.currentTarget;
            if (img.naturalWidth > 0) {
              onMedida({ largura: img.naturalWidth, altura: img.naturalHeight });
            }
          }}
        />
        {figura.fonte && (
          <a
            className="bloco__origem"
            href={figura.fonte}
            target="_blank"
            rel="noreferrer"
            title={`Abrir a origem: ${figura.fonte}`}
            aria-label="Abrir a origem da imagem"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path
                d="M4.5 1H9v4.5M9 1L4.6 5.4M7.5 6.2V9H1V2.5h2.8"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}
