import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { KeyboardEvent, MouseEvent, PointerEvent, UIEvent } from 'react';
import { ALTURA_MINIMA, LARGURA_MINIMA, criarBloco, type Bloco } from '../canvas';
import { realcar } from '../markdown';
import { alternarMarca, aoTeclarEnter, aoTeclarTab, inserirLink } from '../edicao';
import type { TipoDoc } from '../notes';

type Props = {
  blocos: Bloco[];
  tipo: TipoDoc;
  onChange: (blocos: Bloco[]) => void;
};

/** Margem de tolerância do auto-crescimento do bloco, em pixels. */
const FOLGA = 4;

type Arraste =
  | { tipo: 'mover'; id: string; offsetX: number; offsetY: number }
  | { tipo: 'redimensionar'; id: string; inicioX: number; inicioY: number; larguraInicial: number; alturaInicial: number };

export default function Canvas({ blocos, tipo, onChange }: Props) {
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
      {blocos.map((bloco) => (
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
        >
          <div
            className="bloco__alca"
            onPointerDown={(event) => handlePointerDownAlca(event, bloco)}
            onPointerMove={handlePointerMoveAlca}
            onPointerUp={handlePointerUp}
          />
          <Escrita
            bloco={bloco}
            realce={tipo === 'markdown'}
            autoFocus={bloco.id === criadoRecentemente || notaEmBranco}
            onFocus={() => setAtivoId(bloco.id)}
            onChange={(texto) => handleChangeTexto(bloco.id, texto)}
            onAltura={(altura) => handleAltura(bloco.id, altura)}
            onBlur={() => handleBlurTexto(bloco)}
          />
          <div
            className="bloco__canto"
            onPointerDown={(event) => handlePointerDownCanto(event, bloco)}
            onPointerMove={handlePointerMoveCanto}
            onPointerUp={handlePointerUp}
          />
        </div>
      ))}
    </div>
  );
}

type EscritaProps = {
  bloco: Bloco;
  realce: boolean;
  autoFocus: boolean;
  onFocus: () => void;
  onChange: (texto: string) => void;
  onAltura: (altura: number) => void;
  onBlur: () => void;
};

/**
 * O texto é digitado num textarea transparente; o que se vê é a camada de
 * realce atrás dele, com a mesma métrica. É o que permite negrito e título
 * coloridos sem perder o cursor, o desfazer e a acentuação nativos do sistema.
 */
function Escrita({ bloco, realce, autoFocus, onFocus, onChange, onAltura, onBlur }: EscritaProps) {
  const espelhoRef = useRef<HTMLDivElement | null>(null);
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

  function acompanharRolagem(event: UIEvent<HTMLTextAreaElement>) {
    if (!espelhoRef.current) return;
    espelhoRef.current.scrollTop = event.currentTarget.scrollTop;
    espelhoRef.current.scrollLeft = event.currentTarget.scrollLeft;
  }

  return (
    <>
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
        onScroll={acompanharRolagem}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
    </>
  );
}

// Uma quebra de linha final não gera linha visível numa div: sem o espaço, o
// espelho fica uma linha mais curto que o textarea e o texto sai do lugar.
function paraEspelho(texto: string): string {
  return realcar(texto) + (texto.endsWith('\n') ? ' ' : '');
}
