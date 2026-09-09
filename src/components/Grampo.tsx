import { nomeDoAnexo, type Anexo } from '../canvas';

/**
 * O arquivo grampeado na seção: o que não é imagem não tem como ser mostrado
 * na folha, mas tem nome — e o nome é o que se procura depois.
 *
 * Clicar abre a pasta com ele selecionado, e não o arquivo. Um anexo pode ser
 * qualquer coisa que estava na área de transferência; abri-lo com dois cliques
 * seria transformar um "colar" distraído numa execução.
 */
export default function Grampo({ anexo, onMostrar }: { anexo: Anexo; onMostrar?: () => void }) {
  const nome = nomeDoAnexo(anexo);

  return (
    <button
      className="bloco__grampo"
      title={`Mostrar ${nome} na pasta`}
      onMouseDown={(evento) => evento.preventDefault()}
      onClick={onMostrar}
    >
      <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true">
        <path
          d="M7 1H2.5v12h7V3.5M7 1l2.5 2.5M7 1v2.5h2.5"
          stroke="currentColor"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="bloco__grampo-nome">{nome}</span>
    </button>
  );
}
