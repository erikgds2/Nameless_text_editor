import { useEffect } from 'react';
import { ACENTOS, TAMANHOS, TEMAS, type Ajustes as AjustesTipo } from '../ajustes';

type Props = {
  ajustes: AjustesTipo;
  onMudar: (ajustes: AjustesTipo) => void;
  pasta: string | null;
  onAbrirPasta: () => void;
  onTrocarPasta: () => void;
  onFechar: () => void;
};

export default function Ajustes({
  ajustes,
  onMudar,
  pasta,
  onAbrirPasta,
  onTrocarPasta,
  onFechar,
}: Props) {
  useEffect(() => {
    function aoTeclar(event: KeyboardEvent) {
      if (event.key === 'Escape') onFechar();
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  return (
    <aside className="ajustes" role="dialog" aria-label="Ajustes">
      <header className="ajustes__topo">
        <h2 className="ajustes__titulo">Ajustes</h2>
        <button className="icone" onClick={onFechar} title="Fechar (Esc)" aria-label="Fechar ajustes">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path
              d="M3 3l8 8M11 3l-8 8"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      <div className="ajustes__corpo">
        <section className="ajustes__secao">
          <span className="ajustes__rotulo">Aparência</span>

          <div className="ajustes__linha">
            <span className="ajustes__nome">
              Tema
              <span className="ajustes__dica">Acrílico usa o material da janela do Windows</span>
            </span>
            <div className="opcoes">
              {TEMAS.map((tema) => (
                <button
                  key={tema.id}
                  className={`opcao${tema.id === ajustes.tema ? ' opcao--on' : ''}`}
                  onClick={() => onMudar({ ...ajustes, tema: tema.id })}
                >
                  {tema.rotulo}
                </button>
              ))}
            </div>
          </div>

          <div className="ajustes__linha">
            <span className="ajustes__nome">
              Cor de destaque
              <span className="ajustes__dica">Vale para links, marcações e diagramas</span>
            </span>
            <div className="cores">
              {ACENTOS.map((cor) => (
                <button
                  key={cor.hex}
                  className={`cor${cor.hex === ajustes.acento ? ' cor--on' : ''}`}
                  style={{ background: cor.hex }}
                  title={cor.rotulo}
                  aria-label={cor.rotulo}
                  onClick={() => onMudar({ ...ajustes, acento: cor.hex })}
                />
              ))}
              <input
                className="cor cor--livre"
                type="color"
                value={ajustes.acento}
                title="Escolher outra cor"
                aria-label="Escolher outra cor"
                onChange={(event) => onMudar({ ...ajustes, acento: event.target.value })}
              />
            </div>
          </div>

          {ajustes.tema === 'acrilico' && (
            <div className="ajustes__linha">
              <span className="ajustes__nome">
                Opacidade da janela
                <span className="ajustes__dica">
                  0% deixa o acrílico do Windows passar inteiro
                </span>
              </span>
              <div className="medida">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={ajustes.opacidade}
                  aria-label="Opacidade da janela"
                  onChange={(event) =>
                    onMudar({ ...ajustes, opacidade: Number(event.target.value) })
                  }
                />
                <span className="medida__valor">{ajustes.opacidade}%</span>
              </div>
            </div>
          )}

          <div className="ajustes__linha">
            <span className="ajustes__nome">
              Tamanho do texto
              <span className="ajustes__dica">Vale para a nota e a pré-visualização</span>
            </span>
            <div className="opcoes">
              {TAMANHOS.map((tamanho) => (
                <button
                  key={tamanho}
                  className={`opcao${tamanho === ajustes.corpo ? ' opcao--on' : ''}`}
                  onClick={() => onMudar({ ...ajustes, corpo: tamanho })}
                >
                  {tamanho}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="ajustes__secao">
          <span className="ajustes__rotulo">Editor</span>

          <div className="ajustes__linha">
            <span className="ajustes__nome">
              Tipo padrão
              <span className="ajustes__dica">O que uma nota nova é ao nascer</span>
            </span>
            <div className="opcoes">
              <button
                className={`opcao${ajustes.tipoPadrao === 'markdown' ? ' opcao--on' : ''}`}
                onClick={() => onMudar({ ...ajustes, tipoPadrao: 'markdown' })}
              >
                Markdown
              </button>
              <button
                className={`opcao${ajustes.tipoPadrao === 'texto' ? ' opcao--on' : ''}`}
                onClick={() => onMudar({ ...ajustes, tipoPadrao: 'texto' })}
              >
                Texto
              </button>
            </div>
          </div>

          <div className="ajustes__linha">
            <span className="ajustes__nome">
              Pré-visualização
              <span className="ajustes__dica">Painel à direita nas notas em Markdown</span>
            </span>
            <div className="opcoes">
              <button
                className={`opcao${ajustes.preview ? ' opcao--on' : ''}`}
                onClick={() => onMudar({ ...ajustes, preview: true })}
              >
                Ligada
              </button>
              <button
                className={`opcao${ajustes.preview ? '' : ' opcao--on'}`}
                onClick={() => onMudar({ ...ajustes, preview: false })}
              >
                Desligada
              </button>
            </div>
          </div>
        </section>

        {pasta && (
          <section className="ajustes__secao">
            <span className="ajustes__rotulo">Arquivos</span>

            <div className="ajustes__linha">
              <span className="ajustes__nome">
                Pasta das notas
                <span className="ajustes__dica" title={pasta}>
                  {pasta.split(/[\/]/).filter(Boolean).pop()}
                </span>
              </span>
              <div className="opcoes">
                <button className="opcao" onClick={onAbrirPasta}>
                  Abrir
                </button>
                <button className="opcao" onClick={onTrocarPasta}>
                  Trocar
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="ajustes__secao">
          <span className="ajustes__rotulo">Atalhos</span>
          <div className="ajustes__linha">
            <span className="ajustes__nome">Nova nota</span>
            <span className="ajustes__valor">Ctrl + N</span>
          </div>
          <div className="ajustes__linha">
            <span className="ajustes__nome">Buscar</span>
            <span className="ajustes__valor">Ctrl + F</span>
          </div>
          <div className="ajustes__linha">
            <span className="ajustes__nome">Pré-visualização</span>
            <span className="ajustes__valor">Ctrl + E</span>
          </div>
          <div className="ajustes__linha">
            <span className="ajustes__nome">Ajustes</span>
            <span className="ajustes__valor">Ctrl + ,</span>
          </div>
          <div className="ajustes__linha">
            <span className="ajustes__nome">Novo bloco</span>
            <span className="ajustes__valor">Duplo clique na página</span>
          </div>
        </section>
      </div>
    </aside>
  );
}
