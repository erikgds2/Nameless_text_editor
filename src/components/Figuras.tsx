import { useEffect, useRef, useState } from 'react';
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
  const [falhou, setFalhou] = useState(false);
  /**
   * Quantas vezes já se tentou de novo. Uma versão anterior do app pedia a
   * imagem antes de o arquivo existir, e o Chromium guardou o 404: a foto
   * ficava quebrada para sempre, mesmo com o arquivo no lugar. Uma segunda
   * tentativa com endereço novo fura esse cache e conserta sozinha o que já
   * está envenenado — sem pedir nada a quem está escrevendo.
   */
  const [tentativa, setTentativa] = useState(0);
  const imgRef = useRef<HTMLImageElement | null>(null);

  /**
   * `onLoad` não dispara para imagem que veio do cache: ela já chega
   * `complete` antes de o React pendurar o ouvinte. Era por isso que a seção
   * nunca aprendia o tamanho da foto na SEGUNDA vez que a nota abria — e a
   * faixa ficava no piso, com o print reduzido a uma tira ilegível.
   *
   * Sem lista de dependências de propósito: a imagem pode completar em
   * qualquer render, e perguntar é barato.
   */
  useEffect(() => {
    const img = imgRef.current;
    if (!img || figura.altura || !onMedida) return;
    if (img.complete && img.naturalWidth > 0) {
      onMedida({ largura: img.naturalWidth, altura: img.naturalHeight });
    }
  });
  return (
    <div
      className={inteira ? 'bloco__figuras bloco__figuras--inteira' : 'bloco__figuras'}
      style={inteira ? undefined : ({ '--figura': `${figura.altura ?? ALTURA_MINIMA_DA_FIGURA}px` } as CSSProperties)}
    >
      <div className="bloco__figura">
        {falhou && (
          <p className="bloco__figura-quebrada" role="alert">
            Não foi possível abrir esta imagem.
            <span>{figura.src}</span>
          </p>
        )}
        <img
          ref={imgRef}
          className="bloco__imagem"
          src={tentativa === 0 ? figura.endereco : `${figura.endereco}?tentativa=${tentativa}`}
          alt="Imagem colada na nota"
          draggable={false}
          hidden={falhou}
          onError={() => {
            if (tentativa === 0) {
              setTentativa(1);
              return;
            }
            setFalhou(true);
          }}
          onLoad={(evento) => {
            setFalhou(false);
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
