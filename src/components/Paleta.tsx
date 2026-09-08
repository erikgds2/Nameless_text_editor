import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { filtrar, type Comando } from '../comandos';

type Props = {
  comandos: Comando[];
  onFechar: () => void;
};

export default function Paleta({ comandos, onFechar }: Props) {
  const [consulta, setConsulta] = useState('');
  const [escolhido, setEscolhido] = useState(0);
  const listaRef = useRef<HTMLDivElement | null>(null);

  const encontrados = useMemo(() => filtrar(comandos, consulta), [comandos, consulta]);

  // Digitar de novo recomeça a escolha: o item 3 da busca anterior não tem
  // nada a ver com o item 3 desta.
  useEffect(() => setEscolhido(0), [consulta]);

  useEffect(() => {
    listaRef.current
      ?.querySelector('[data-escolhido="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [escolhido, encontrados]);

  function executar(comando: Comando | undefined) {
    if (!comando) return;
    onFechar();
    comando.executar();
  }

  function aoTeclar(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onFechar();
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setEscolhido((atual) => Math.min(encontrados.length - 1, atual + 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setEscolhido((atual) => Math.max(0, atual - 1));
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      executar(encontrados[escolhido]);
    }
  }

  return (
    <div className="paleta__fundo" onClick={onFechar}>
      <div
        className="paleta"
        role="dialog"
        aria-label="Paleta de comandos"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={aoTeclar}
      >
        <input
          className="paleta__busca"
          value={consulta}
          placeholder="O que você quer fazer?"
          aria-label="Buscar comando"
          autoFocus
          onChange={(event) => setConsulta(event.target.value)}
        />

        <div className="paleta__lista" ref={listaRef}>
          {encontrados.map((comando, indice) => {
            const anterior = encontrados[indice - 1];
            return (
              <div key={comando.id}>
                {comando.secao !== anterior?.secao && (
                  <span className="paleta__secao">{comando.secao}</span>
                )}
                <button
                  className={`paleta__item${indice === escolhido ? ' paleta__item--on' : ''}`}
                  data-escolhido={indice === escolhido}
                  onMouseMove={() => setEscolhido(indice)}
                  onClick={() => executar(comando)}
                >
                  <span>{comando.titulo}</span>
                  {comando.atalho && <span className="paleta__atalho">{comando.atalho}</span>}
                </button>
              </div>
            );
          })}

          {encontrados.length === 0 && <p className="paleta__vazio">Nenhum comando encontrado.</p>}
        </div>
      </div>
    </div>
  );
}
