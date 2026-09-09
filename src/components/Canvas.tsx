import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type {
  ClipboardEvent,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  UIEvent,
} from 'react';
import {
  ALTURA_MINIMA,
  ESPACO,
  LARGURA_MINIMA,
  LARGURA_PADRAO,
  alturaAjustada,
  criarBloco,
  duplicarBloco,
  type Bloco,
  type Imagem,
} from '../canvas';
import Figuras from './Figuras';
import { realcar } from '../markdown';
import { achadosDoBloco, realcarAchados, type Ocorrencia } from '../busca';
import {
  ALTURA_MINIMA_DA_FIGURA,
  alturaDaFigura,
  enderecoDaImagem,
  melhorImagem,
  origemDoHtml,
  tamanhoDoBloco,
} from '../imagem';
import { alternarMarca, aoTeclarEnter, aoTeclarTab, inserirLink, urlColada } from '../edicao';
import { completarLigacao, ligacaoSendoEscrita, ordenarCandidatos, type Escrevendo } from '../sugestoes';
import type { TipoDoc } from '../notes';

type Props = {
  blocos: Bloco[];
  tipo: TipoDoc;
  onChange: (blocos: Bloco[]) => void;
  onColarImagem: (bytes: Uint8Array, tipo: string) => Promise<string | null>;
  /** Títulos das outras notas, para sugerir enquanto se escreve uma ligação. */
  titulos: string[];
  /** O começo de cada nota, por título: títulos parecidos não dizem qual é qual. */
  trechos: Record<string, string>;
  /** Ocorrências da busca na nota, em ordem de leitura. Vazio quando não há busca. */
  achados: Ocorrencia[];
  /** Aquela em que a navegação parou, para destacá-la entre as outras. */
  achadoAtual: Ocorrencia | null;
  /** Esc no bloco devolve o teclado para a lista de notas. */
  onSair: () => void;
  /** Aviso passageiro para o que falha em silêncio, como uma imagem ilegível. */
  onRecado: (mensagem: string) => void;
};

/**
 * As dimensões da imagem, para o bloco nascer do tamanho dela — e a prova de
 * que a imagem é legível. `null` quando não dá para decodificar: colar algo que
 * o navegador não consegue abrir tem de virar aviso, e não uma figura quebrada
 * na página que ninguém sabe de onde veio.
 *
 * Sem `createImageBitmap` (jsdom, por exemplo) fica o tamanho de um print, que
 * é chute honesto: ali não há decodificador nenhum para consultar.
 */
async function medirImagem(arquivo: File): Promise<{ largura: number; altura: number } | null> {
  if (typeof createImageBitmap !== 'function') {
    return { largura: LARGURA_PADRAO, altura: Math.round((LARGURA_PADRAO * 3) / 4) };
  }
  try {
    const bitmap = await createImageBitmap(arquivo);
    const medida = { largura: bitmap.width, altura: bitmap.height };
    bitmap.close();
    return medida.largura > 0 && medida.altura > 0 ? medida : null;
  } catch {
    return null;
  }
}

/** O que fica para o texto quando a seção cresce por causa de uma foto. */
const ESPACO_PARA_O_TEXTO = 44;

type Arraste =
  | { tipo: 'mover'; id: string; offsetX: number; offsetY: number }
  | { tipo: 'redimensionar'; id: string; inicioX: number; inicioY: number; larguraInicial: number; alturaInicial: number };

export default function Canvas({
  blocos,
  tipo,
  onChange,
  onColarImagem,
  titulos,
  trechos,
  achados,
  achadoAtual,
  onSair,
  onRecado,
}: Props) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [ativoId, setAtivoId] = useState<string | null>(null);
  const [criadoRecentemente, setCriadoRecentemente] = useState<string | null>(null);
  const [arraste, setArraste] = useState<Arraste | null>(null);

  // Abrir uma nota em branco já deixa o cursor pronto: capturar uma ideia não
  // pode custar um clique a mais. (O Canvas remonta a cada nota, via key.)
  const notaEmBranco = blocos.length === 1 && blocos[0].texto === '';

  function handleDuploClique(event: MouseEvent<HTMLDivElement>) {
    if (event.target !== canvasRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    // somar o scroll e obrigatorio: o retangulo e relativo a viewport, mas a
    // posicao do bloco e relativa ao conteudo, que pode estar rolado
    const bloco = criarBloco(
      event.clientX - rect.left + canvas.scrollLeft,
      event.clientY - rect.top + canvas.scrollTop,
    );
    onChange([...blocos, bloco]);
    setAtivoId(bloco.id);
    setCriadoRecentemente(bloco.id);
  }

  function handleChangeTexto(id: string, texto: string) {
    onChange(blocos.map((bloco) => (bloco.id === id ? { ...bloco, texto } : bloco)));
  }

  // Guardar a imagem no disco leva alguns milissegundos, e quem colou pode ter
  // continuado a digitar nesse meio-tempo. Escrever a partir de `blocos` — que
  // é o valor de quando a colagem começou — devolveria o texto ao que era.
  const blocosRef = useRef(blocos);
  blocosRef.current = blocos;

  /**
   * A imagem colada fica no quadrado onde foi colada — é onde a pessoa pediu.
   *
   * Bloco vazio vira a figura inteira, do tamanho dela. Bloco com texto ganha a
   * marcação numa linha nova e cresce para abrir espaço à foto no rodapé: abrir
   * outro quadrado ao lado, como se fazia antes, era mudar a nota de lugar sem
   * ninguém ter pedido.
   */
  async function handleImagemColada(alvo: Bloco, arquivo: File, origem: string | null) {
    const medida = await medirImagem(arquivo);
    if (!medida) {
      onRecado('Não foi possível ler a imagem colada.');
      return;
    }

    const nome = await onColarImagem(new Uint8Array(await arquivo.arrayBuffer()), arquivo.type);
    if (!nome) return;

    const imagem: Imagem = { src: `anexos/${nome}`, ...(origem ? { fonte: origem } : {}) };
    const agora = blocosRef.current;

    // A seção pode ter mudado de identidade enquanto a imagem era lida e
    // gravada: uma releitura da pasta reconstrói os blocos. Procura-se pelo id
    // e, se ele não existir mais, pelo lugar que a seção ocupava na página.
    const dono =
      agora.find((bloco) => bloco.id === alvo.id) ??
      agora.find((bloco) => bloco.x === alvo.x && bloco.y === alvo.y);

    // sumiu de vez: a foto vira uma seção nova, onde a antiga estava. Perder o
    // que a pessoa acabou de colar é o pior desfecho possível
    if (!dono) {
      const { largura } = tamanhoDoBloco(medida.largura, medida.altura);
      const faixa = alturaDaFigura(largura, medida.largura, medida.altura);
      const nova = {
        ...criarBloco(alvo.x, alvo.y),
        imagem: { ...imagem, altura: faixa },
        largura,
        altura: faixa + ESPACO_PARA_O_TEXTO,
      };
      onChange([...agora, nova]);
      setAtivoId(nova.id);
      return;
    }

    // seção ainda em branco: a foto no rodapé e uma linha de escrita em cima.
    // Antes ela ocupava a caixa inteira e a seção ficava sem campo nenhum —
    // não dava para escrever uma legenda, nem antes nem depois da foto.
    if (dono.texto.trim() === '' && !dono.imagem) {
      const { largura } = tamanhoDoBloco(medida.largura, medida.altura);
      const faixa = alturaDaFigura(largura, medida.largura, medida.altura);
      onChange(
        agora.map((bloco) =>
          bloco.id === dono.id
            ? {
                ...bloco,
                imagem: { ...imagem, altura: faixa },
                largura,
                altura: faixa + ESPACO_PARA_O_TEXTO,
              }
            : bloco,
        ),
      );
      setAtivoId(dono.id);
      return;
    }

    // seção que já tem foto: a nova vira outra seção, logo abaixo. Duas fotos
    // no mesmo quadrado seriam duas coisas disputando o mesmo espaço.
    if (dono.imagem) {
      const { largura } = tamanhoDoBloco(medida.largura, medida.altura);
      const faixa = alturaDaFigura(largura, medida.largura, medida.altura);
      const nova = {
        ...criarBloco(dono.x, dono.y + dono.altura + ESPACO),
        imagem: { ...imagem, altura: faixa },
        largura,
        altura: faixa + ESPACO_PARA_O_TEXTO,
      };
      onChange([...agora, nova]);
      setAtivoId(nova.id);
      return;
    }

    // seção com texto: a foto entra no rodapé DELA, e o quadrado cresce
    // exatamente o que a foto pede — nem uma faixa fixa que a espreme, nem
    // espaço vazio sobrando embaixo
    const faixa = alturaDaFigura(dono.largura, medida.largura, medida.altura);
    onChange(
      agora.map((bloco) =>
        bloco.id === dono.id
          ? { ...bloco, imagem: { ...imagem, altura: faixa }, altura: bloco.altura + faixa }
          : bloco,
      ),
    );
    setAtivoId(dono.id);
  }

  /**
   * A seção aprende quanto a foto pede, na primeira vez que a foto é desenhada.
   * Serve às notas coladas por versões que ainda não guardavam essa medida — e
   * a seção cresce, se for preciso, para a foto não ficar espremida contra o
   * texto que já estava lá.
   */
  function handleMedidaDaFigura(bloco: Bloco, natural: { largura: number; altura: number }) {
    if (!bloco.imagem || bloco.imagem.altura) return;

    const faixa = alturaDaFigura(bloco.largura, natural.largura, natural.altura);
    onChange(
      blocosRef.current.map((outro) =>
        outro.id === bloco.id
          ? {
              ...outro,
              imagem: { ...outro.imagem!, altura: faixa },
              altura: Math.max(outro.altura, faixa + ESPACO_PARA_O_TEXTO),
            }
          : outro,
      ),
    );
  }

  // O bloco acompanha o texto, para baixo e de volta. Quem decide se é hora de
  // encolher é a Escrita, que sabe se o texto diminuiu; aqui só se garante que
  // nenhum bloco fique menor do que um bloco pode ser.
  function handleAltura(id: string, altura: number) {
    onChange(
      blocos.map((bloco) =>
        bloco.id === id ? { ...bloco, altura: Math.max(ALTURA_MINIMA, altura) } : bloco,
      ),
    );
  }

  /** Ctrl+D copia o bloco em que se está escrevendo, e o foco vai para a cópia. */
  function handleDuplicarBloco(bloco: Bloco) {
    const copia = duplicarBloco(bloco);
    onChange([...blocos, copia]);
    setAtivoId(copia.id);
    setCriadoRecentemente(copia.id);
  }

  /**
   * Seção vazia que perde o foco vai embora — ela só existia porque alguém
   * clicou por engano. Mas seção com figura NUNCA some por não ter texto: a
   * foto é o conteúdo dela, e sumir levaria o que a pessoa acabou de colar.
   */
  function handleBlurTexto(bloco: Bloco) {
    if (bloco.texto.trim() !== '' || bloco.imagem || blocos.length <= 1) return;
    onChange(blocos.filter((b) => b.id !== bloco.id));
  }

  function handlePointerDownAlca(event: PointerEvent<HTMLDivElement>, bloco: Bloco) {
    if (!canvasRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setAtivoId(bloco.id);
    const rect = canvasRef.current.getBoundingClientRect();
    setArraste({
      tipo: 'mover',
      id: bloco.id,
      offsetX: event.clientX - rect.left - bloco.x,
      offsetY: event.clientY - rect.top - bloco.y,
    });
  }

  function handlePointerMoveAlca(event: PointerEvent<HTMLDivElement>) {
    if (!arraste || arraste.tipo !== 'mover' || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, event.clientX - rect.left - arraste.offsetX);
    const y = Math.max(0, event.clientY - rect.top - arraste.offsetY);
    onChange(blocos.map((bloco) => (bloco.id === arraste.id ? { ...bloco, x, y } : bloco)));
  }

  function handlePointerDownCanto(event: PointerEvent<HTMLDivElement>, bloco: Bloco) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setAtivoId(bloco.id);
    setArraste({
      tipo: 'redimensionar',
      id: bloco.id,
      inicioX: event.clientX,
      inicioY: event.clientY,
      larguraInicial: bloco.largura,
      alturaInicial: bloco.altura,
    });
  }

  function handlePointerMoveCanto(event: PointerEvent<HTMLDivElement>) {
    if (!arraste || arraste.tipo !== 'redimensionar') return;
    const largura = Math.max(LARGURA_MINIMA, arraste.larguraInicial + (event.clientX - arraste.inicioX));
    const altura = Math.max(ALTURA_MINIMA, arraste.alturaInicial + (event.clientY - arraste.inicioY));
    onChange(blocos.map((bloco) => (bloco.id === arraste.id ? { ...bloco, largura, altura } : bloco)));
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.releasePointerCapture(event.pointerId);
    setArraste(null);
  }

  return (
    <div className="canvas" ref={canvasRef} onDoubleClick={handleDuploClique}>
      {blocos.map((bloco) => {
        // A figura é da seção, e não do texto: uma página de caderno pode ter
        // uma foto colada mesmo quando não é Markdown nenhum.
        const endereco = bloco.imagem ? enderecoDaImagem(bloco.imagem.src) : null;
        const figura = endereco ? { ...bloco.imagem!, endereco } : null;
        return (
        <div
          key={bloco.id}
          className={[
            'bloco',
            bloco.id === ativoId ? 'bloco--ativo' : '',
            tipo === 'texto' ? 'bloco--puro' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ left: bloco.x, top: bloco.y, width: bloco.largura, height: bloco.altura }}
          data-bloco={bloco.id}
        >
          <div
            className="bloco__alca"
            onPointerDown={(event) => handlePointerDownAlca(event, bloco)}
            onPointerMove={handlePointerMoveAlca}
            onPointerUp={handlePointerUp}
          />
          {blocos.length > 1 && (
            <button
              className="bloco__excluir"
              title="Excluir este bloco"
              aria-label="Excluir este bloco"
              onClick={() => onChange(blocos.filter((outro) => outro.id !== bloco.id))}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <Escrita
              bloco={bloco}
              realce={tipo === 'markdown'}
              achados={achadosDoBloco(achados, bloco.id)}
              achadoAtual={achadoAtual}
              autoFocus={bloco.id === criadoRecentemente || notaEmBranco}
              onFocus={() => setAtivoId(bloco.id)}
              onChange={(texto) => handleChangeTexto(bloco.id, texto)}
              onAltura={(altura) => handleAltura(bloco.id, altura)}
              onImagemColada={(arquivo, origem) => handleImagemColada(bloco, arquivo, origem)}
              titulos={titulos}
              trechos={trechos}
              onSair={onSair}
              onDuplicar={() => handleDuplicarBloco(bloco)}
              onBlur={() => handleBlurTexto(bloco)}
            alturaDaFigura={figura?.altura ?? (figura ? ALTURA_MINIMA_DA_FIGURA : 0)}
          />
          {figura && (
            <Figuras figura={figura} onMedida={(natural) => handleMedidaDaFigura(bloco, natural)} />
          )}
          <div
            className="bloco__canto"
            onPointerDown={(event) => handlePointerDownCanto(event, bloco)}
            onPointerMove={handlePointerMoveCanto}
            onPointerUp={handlePointerUp}
          />
        </div>
        );
      })}
    </div>
  );
}

type EscritaProps = {
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
function Escrita({
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
