import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { ClipboardEvent, KeyboardEvent, MouseEvent, PointerEvent, UIEvent } from 'react';
import { ALTURA_MINIMA, LARGURA_MINIMA, LARGURA_PADRAO, criarBloco, type Bloco } from '../canvas';
import { realcar } from '../markdown';
import { achadosDoBloco, realcarAchados, type Ocorrencia } from '../busca';
import { enderecoDaImagem, imagemDoBloco, marcarImagem, origemDoHtml, tamanhoDoBloco } from '../imagem';
import { alternarMarca, aoTeclarEnter, aoTeclarTab, inserirLink } from '../edicao';
import { completarLigacao, ligacaoSendoEscrita, ordenarCandidatos, type Escrevendo } from '../sugestoes';
import type { TipoDoc } from '../notes';

type Props = {
  blocos: Bloco[];
  tipo: TipoDoc;
  onChange: (blocos: Bloco[]) => void;
  onColarImagem: (bytes: Uint8Array, tipo: string) => Promise<string | null>;
  /** Títulos das outras notas, para sugerir enquanto se escreve uma ligação. */
  titulos: string[];
  /** Ocorrências da busca na nota, em ordem de leitura. Vazio quando não há busca. */
  achados: Ocorrencia[];
  /** Aquela em que a navegação parou, para destacá-la entre as outras. */
  achadoAtual: Ocorrencia | null;
};

/** Margem de tolerância do auto-crescimento do bloco, em pixels. */
const FOLGA = 4;

/** Respiro entre o bloco onde a imagem foi colada e a figura que nasce abaixo. */
const ESPACO = 16;

/**
 * As dimensões da imagem, para o bloco nascer do tamanho dela. Se não der para
 * medir, o bloco vem numa proporção de print e a pessoa ajusta pelo canto.
 */
async function medirImagem(arquivo: File): Promise<{ largura: number; altura: number }> {
  try {
    const bitmap = await createImageBitmap(arquivo);
    const medida = { largura: bitmap.width, altura: bitmap.height };
    bitmap.close();
    return medida;
  } catch {
    return { largura: LARGURA_PADRAO, altura: Math.round((LARGURA_PADRAO * 3) / 4) };
  }
}

type Arraste =
  | { tipo: 'mover'; id: string; offsetX: number; offsetY: number }
  | { tipo: 'redimensionar'; id: string; inicioX: number; inicioY: number; larguraInicial: number; alturaInicial: number };

export default function Canvas({
  blocos,
  tipo,
  onChange,
  onColarImagem,
  titulos,
  achados,
  achadoAtual,
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
   * A imagem colada vira figura na página: um bloco próprio, do tamanho dela,
   * que se arrasta e se redimensiona como qualquer outro. Colada num bloco
   * ainda vazio, ela ocupa esse bloco — foi ali que a pessoa pediu. Colada num
   * bloco que já tem texto, nasce logo abaixo, para não partir a frase ao meio.
   */
  async function handleImagemColada(alvo: Bloco, arquivo: File, origem: string | null) {
    const nome = await onColarImagem(new Uint8Array(await arquivo.arrayBuffer()), arquivo.type);
    if (!nome) return;

    const texto = marcarImagem(nome, origem);
    const medida = await medirImagem(arquivo);
    const { largura, altura } = tamanhoDoBloco(medida.largura, medida.altura);
    const agora = blocosRef.current;
    const dono = agora.find((bloco) => bloco.id === alvo.id);

    if (dono && dono.texto.trim() === '') {
      onChange(agora.map((bloco) => (bloco.id === dono.id ? { ...bloco, texto, largura, altura } : bloco)));
      setAtivoId(dono.id);
      return;
    }

    const base = dono ?? alvo;
    const novo = { ...criarBloco(base.x, base.y + base.altura + ESPACO), texto, largura, altura };
    onChange([...agora, novo]);
    setAtivoId(novo.id);
  }

  // O bloco acompanha o texto para baixo, como no papel. Encolher fica a cargo
  // do canto de redimensionar: ninguém quer o bloco pulando enquanto apaga.
  function handleAltura(id: string, altura: number) {
    onChange(
      blocos.map((bloco) =>
        bloco.id === id && altura > bloco.altura ? { ...bloco, altura } : bloco,
      ),
    );
  }

  function handleBlurTexto(bloco: Bloco) {
    if (bloco.texto.trim() !== '' || blocos.length <= 1) return;
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
        // Numa nota de texto puro a marcação não vira figura: ali `![](...)` é
        // o que está escrito, e não uma instrução.
        const figura = tipo === 'markdown' ? imagemDoBloco(bloco.texto) : null;
        const endereco = figura && enderecoDaImagem(figura.src);
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
          {figura && endereco ? (
            <>
              <img
                className="bloco__imagem"
                src={endereco}
                alt="Imagem colada na nota"
                draggable={false}
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
            </>
          ) : (
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
              onBlur={() => handleBlurTexto(bloco)}
            />
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
  onBlur: () => void;
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
  onBlur,
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

  // A folga não é frescura: sem ela, um scrollHeight que volta um ou dois
  // pixels maior que a altura recém-aplicada realimenta o efeito para sempre e
  // trava a aba. Crescer só quando falta espaço de verdade faz o laço convergir.
  useEffect(() => {
    const area = areaRef.current;
    if (area && area.scrollHeight > bloco.altura + FOLGA) onAltura(area.scrollHeight + FOLGA);
    // onAltura vem do render atual; incluí-lo aqui repetiria o efeito à toa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloco.texto, bloco.altura, bloco.largura]);

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
    const item = [...event.clipboardData.items].find(
      (candidato) => candidato.kind === 'file' && candidato.type.startsWith('image/'),
    );
    const imagem = item?.getAsFile();
    if (!imagem) return;

    event.preventDefault();
    onImagemColada(imagem, origemDoHtml(event.clipboardData.getData('text/html')));
  }

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
          ref={achadosRef}
          aria-hidden="true"
          // vem de realcarAchados(), que escapa tudo que o usuário digitou
          dangerouslySetInnerHTML={{ __html: realcarAchados(bloco.texto, achados, achadoAtual) }}
        />
      )}
      {realce && (
        <div
          className="bloco__espelho"
          ref={espelhoRef}
          aria-hidden="true"
          // o texto vem de realcar(), que escapa tudo que o usuário digitou
          dangerouslySetInnerHTML={{ __html: paraEspelho(bloco.texto) }}
        />
      )}
      <textarea
        className="bloco__texto"
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
                {titulo}
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
