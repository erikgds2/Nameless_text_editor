import { useEffect } from 'react';

/**
 * A lista de atalhos, sobreposta com `Ctrl + /`.
 *
 * Existe porque o app é feito para ser usado sem mouse, e um atalho que não se
 * descobre não existe. A lista é escrita à mão de propósito: nem tudo o que se
 * faz pelo teclado é um comando da paleta — duplo clique, Tab na lista, Esc.
 */
const ATALHOS: { secao: string; itens: [string, string][] }[] = [
  {
    secao: 'Notas',
    itens: [
      ['Ctrl + N', 'Nova nota'],
      ['Ctrl + Shift + D', 'Nota de hoje'],
      ['Ctrl + Shift + F', 'Buscar entre as notas'],
      ['Ctrl + K', 'Paleta de comandos'],
      ['↑ ↓ na lista', 'Trocar de nota'],
    ],
  },
  {
    secao: 'Escrita',
    itens: [
      ['Duplo clique na página', 'Novo bloco ali'],
      ['Ctrl + F', 'Buscar dentro da nota'],
      ['Enter / Shift + Enter', 'Ocorrência seguinte e anterior'],
      ['Esc', 'Sair do bloco para a lista'],
      ['Ctrl + Z / Ctrl + Y', 'Desfazer e refazer a nota inteira'],
      ['Ctrl + B / I / K', 'Negrito, itálico e link'],
      ['Tab / Shift + Tab', 'Aninhar e desaninhar item de lista'],
      ['[[', 'Ligar para outra nota'],
    ],
  },
  {
    secao: 'Janela',
    itens: [
      ['Ctrl + E', 'Pré-visualização'],
      ['Ctrl + \\', 'Recolher a barra lateral'],
      ['Ctrl + ,', 'Ajustes'],
      ['Ctrl + /', 'Esta lista'],
    ],
  },
];

export default function Atalhos({ onFechar }: { onFechar: () => void }) {
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') onFechar();
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  return (
    <div className="atalhos__fundo" onClick={onFechar}>
      <section
        className="atalhos"
        role="dialog"
        aria-label="Atalhos do teclado"
        onClick={(evento) => evento.stopPropagation()}
      >
        {ATALHOS.map(({ secao, itens }) => (
          <div className="atalhos__grupo" key={secao}>
            <h2 className="atalhos__secao">{secao}</h2>
            {itens.map(([tecla, oQueFaz]) => (
              <p className="atalhos__linha" key={tecla}>
                <kbd className="atalhos__tecla">{tecla}</kbd>
                <span className="atalhos__texto">{oQueFaz}</span>
              </p>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
