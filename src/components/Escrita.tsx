import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { ClipboardEvent, KeyboardEvent, UIEvent } from 'react';
import { alturaAjustada, type Bloco } from '../canvas';
import { realcar } from '../markdown';
import { realcarAchados, type Ocorrencia } from '../busca';
import { melhorImagem, origemDoHtml } from '../imagem';
import { alternarMarca, aoTeclarEnter, aoTeclarTab, inserirLink, urlColada } from '../edicao';
import { completarLigacao, ligacaoSendoEscrita, ordenarCandidatos, type Escrevendo } from '../sugestoes';

export type EscritaProps = {
  bloco: Bloco;
  realce: boolean;
  achados: Ocorrencia[];
  achadoAtual: Ocorrencia | null;
  autoFocus: boolean;
  onFocus: () => void;
  onChange: (texto: string) => void;
  onAltura: (altura: number) => void;
  onImagemColada: (arquivo: File, origem: string | null) => void;
  titulos: string[];
  trechos: Record<string, string>;
  onSair: () => void;
  onDuplicar: () => void;
  onBlur: () => void;
  /** Quanto do rodapé do bloco a figura ocupa; o texto para acima dela. */
  alturaDaFigura: number;
};

/**
 * O texto é digitado num textarea transparente; o que se vê é a camada de
 * realce atrás dele, com a mesma métrica. É o que permite negrito e título
 * coloridos sem perder o cursor, o desfazer e a acentuação nativos do sistema.
 */
export default function Escrita({
  bloco,
  realce,
  achados,
  achadoAtual,
  autoFocus,
  onFocus,
  onChange,
  onAltura,
  onImagemColada,
  titulos,
  trechos,
  onSair,
  onDuplicar,
  onBlur,
  alturaDaFigura,
}: EscritaProps) {
  const [escrevendo, setEscrevendo] = useState<Escrevendo | null>(null);
  const [escolhido, setEscolhido] = useState(0);

  const candidatos = escrevendo ? ordenarCandidatos(titulos, escrevendo.termo).slice(0, 8) : [];

  // Quem digita `[[` está procurando uma nota; a lista acompanha o que já foi
  // escrito e some assim que a ligação fecha.
  function reavaliar(area: HTMLTextAreaElement) {
    setEscrevendo(realce ? ligacaoSendoEscrita(area.value, area.selectionStart) : null);
    setEscolhido(0);
  }

  /**
   * O trecho a substituir é recalculado do campo AGORA, e não lido do estado.
   * O estado fica para trás quando se digita mais rápido do que o React
   * reconcilia — e substituir usando uma posição velha parte o texto ao meio,
   * deixando sobras como `[[Nome]]ome]]`.
   */
  function escolher(area: HTMLTextAreaElement, alvo: string) {
    const onde = ligacaoSendoEscrita(area.value, area.selectionStart);
    if (!onde) return;
    const { texto, cursor } = completarLigacao(area.value, alvo, onde);
    setEscrevendo(null);
    flushSync(() => onChange(texto));
    area.setSelectionRange(cursor, cursor);
  }
  const espelhoRef = useRef<HTMLDivElement | null>(null);
  const achadosRef = useRef<HTMLDivElement | null>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  // Zerar a altura por um instante é o que dá a medida do TEXTO, e não a do
  // campo: com o bloco maior que o conteúdo, o scrollHeight é só a altura do
  // próprio campo — e depender dela é o que fazia o efeito se realimentar e
  // travar a aba. Quem decide o que fazer com a medida é `alturaAjustada`.
  const textoAnterior = useRef(bloco.texto);
  useEffect(() => {
    const area = areaRef.current;
    const encolheu = bloco.texto.length < textoAnterior.current.length;
    textoAnterior.current = bloco.texto;
    if (!area) return;

    area.style.height = '0px';
    const conteudo = area.scrollHeight;
    area.style.height = '';

    // a faixa da figura entra na conta: sem isso, apagar uma linha de texto
    // encolheria o bloco por cima da foto que está no rodapé dele
    const alvo = alturaAjustada(bloco.altura, conteudo + alturaDaFigura, encolheu);
    if (alvo !== null) onAltura(alvo);
    // onAltura vem do render atual; incluí-lo aqui repetiria o efeito à toa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloco.texto, bloco.altura, bloco.largura, alturaDaFigura]);

  /**
   * As regras de Markdown no teclado — continuar a lista, sair dela, indentar,
   * envolver a seleção em negrito. Elas moram em edicao.ts como funções puras;
   * aqui só traduzimos tecla em chamada e devolvemos o cursor ao lugar certo.
   */
  function aoTeclar(event: KeyboardEvent<HTMLTextAreaElement>) {
    const area = event.currentTarget;

    // Com a lista aberta, as setas e o Enter pertencem a ela: continuar a lista
    // de Markdown no meio de uma escolha seria o contrário do esperado.
    if (candidatos.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setEscolhido((atual) => Math.min(candidatos.length - 1, atual + 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setEscolhido((atual) => Math.max(0, atual - 1));
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        escolher(area, candidatos[escolhido]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setEscrevendo(null);
        return;
      }
    }

    // Duplicar o bloco inteiro, com o mesmo tamanho e a mesma posição relativa.
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      onDuplicar();
      return;
    }

    // Fora de uma lista aberta, Esc é a saída do bloco: o teclado volta para a
    // lista de notas, e sair do texto deixa de precisar do mouse.
    if (event.key === 'Escape') {
      event.preventDefault();
      area.blur();
      onSair();
      return;
    }

    const estado = { texto: area.value, inicio: area.selectionStart, fim: area.selectionEnd };

    const novo = (() => {
      if (!realce) return null;
      if (event.key === 'Enter' && !event.shiftKey) return aoTeclarEnter(estado);
      if (event.key === 'Tab') return aoTeclarTab(estado, event.shiftKey);
      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'b') return alternarMarca(estado, '**');
        if (event.key === 'i') return alternarMarca(estado, '*');
        if (event.key === 'k') return inserirLink(estado, 'https://');
      }
      return null;
    })();

    if (!novo) return;
    event.preventDefault();
    // flushSync é obrigatório: sem ele o valor só chega ao campo no próximo
    // frame, e a tecla seguinte de quem digita rápido cai na posição antiga do
    // cursor — o que come letras no meio da palavra.
    flushSync(() => onChange(novo.texto));
    area.setSelectionRange(novo.inicio, novo.fim);
  }

  /**
   * A colagem de imagem não escreve nada aqui: quem monta a figura é o canvas,
   * porque ela vira um bloco, e não um trecho de texto. Só a origem tem de ser
   * lida agora — o evento não sobrevive ao primeiro `await`.
   */
  function aoColar(event: ClipboardEvent<HTMLTextAreaElement>) {
    const arquivos = [...event.clipboardData.items]
      .filter((candidato) => candidato.kind === 'file')
      .map((candidato) => candidato.getAsFile())
      .filter((arquivo): arquivo is File => arquivo !== null);

    const imagem = melhorImagem(arquivos);
    if (imagem) {
      event.preventDefault();
      onImagemColada(imagem, origemDoHtml(event.clipboardData.getData('text/html')));
      return;
    }

    // Endereço colado por cima de um trecho selecionado vira link com aquele
    // trecho por texto. Sem seleção, colar um endereço é colar um endereço.
    const area = event.currentTarget;
    const url = realce ? urlColada(event.clipboardData.getData('text/plain')) : null;
    if (!url || area.selectionStart === area.selectionEnd) return;

    event.preventDefault();
    const novo = inserirLink(
      { texto: area.value, inicio: area.selectionStart, fim: area.selectionEnd },
      url,
    );
    // flushSync pelo mesmo motivo do teclado: sem ele a seleção seguinte cai
    // na posição antiga do texto
    flushSync(() => onChange(novo.texto));
    area.setSelectionRange(novo.inicio, novo.fim);
  }

  // O texto para onde a figura começa. Vale para as três camadas juntas: se o
  // espelho não recuar igual, o realce descola das palavras.
  // o mesmo teto do CSS da faixa: o texto nunca fica sem espaço
  const recuo =
    alturaDaFigura > 0
      ? { bottom: `min(${alturaDaFigura}px, calc(100% - 44px))` }
      : undefined;

  // As camadas de baixo têm de rolar junto com o texto, senão o realce
  // descola das palavras assim que o bloco passa da própria altura.
  function acompanharRolagem(event: UIEvent<HTMLTextAreaElement>) {
    const { scrollTop, scrollLeft } = event.currentTarget;
    for (const camada of [espelhoRef.current, achadosRef.current]) {
      if (!camada) continue;
      camada.scrollTop = scrollTop;
      camada.scrollLeft = scrollLeft;
    }
  }

  return (
    <>
      {achados.length > 0 && (
        <div
          className="bloco__achados"
          style={recuo}
          ref={achadosRef}
          aria-hidden="true"
          // vem de realcarAchados(), que escapa tudo que o usuário digitou
          dangerouslySetInnerHTML={{ __html: realcarAchados(bloco.texto, achados, achadoAtual) }}
        />
      )}
      {realce && (
        <div
          className="bloco__espelho"
          style={recuo}
          ref={espelhoRef}
          aria-hidden="true"
          // o texto vem de realcar(), que escapa tudo que o usuário digitou
          dangerouslySetInnerHTML={{ __html: paraEspelho(bloco.texto) }}
        />
      )}
      <textarea
        className="bloco__texto"
        style={recuo}
        ref={areaRef}
        value={bloco.texto}
        spellCheck={false}
        autoFocus={autoFocus}
        onFocus={onFocus}
        onKeyDown={aoTeclar}
        onPaste={aoColar}
        onScroll={acompanharRolagem}
        onChange={(event) => {
          onChange(event.target.value);
          reavaliar(event.target);
        }}
        onSelect={(event) => reavaliar(event.currentTarget)}
        onBlur={() => {
          setEscrevendo(null);
          onBlur();
        }}
      />

      {candidatos.length > 0 && (
        <ul className="sugestoes">
          {candidatos.map((titulo, indice) => (
            <li key={titulo}>
              <button
                className={`sugestao${indice === escolhido ? ' sugestao--on' : ''}`}
                // onMouseDown e não onClick: o clique tira o foco do campo antes
                // de disparar, e aí a lista já teria fechado
                onMouseDown={(event) => {
                  event.preventDefault();
                  const area = areaRef.current;
                  if (area) escolher(area, titulo);
                }}
              >
                <span className="sugestao__titulo">{titulo}</span>
                {trechos[titulo] && <span className="sugestao__trecho">{trechos[titulo]}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// Uma quebra de linha final não gera linha visível numa div: sem o espaço, o
// espelho fica uma linha mais curto que o textarea e o texto sai do lugar.
function paraEspelho(texto: string): string {
  return realcar(texto) + (texto.endsWith('\n') ? ' ' : '');
}
