import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent } from 'react';
import { calcularAlinhamento, type Guia } from '../alinhamento';
import {
  ALTURA_MINIMA,
  ESPACO,
  LARGURA_MINIMA,
  LARGURA_PADRAO,
  criarBloco,
  duplicarBloco,
  moverFigura,
  type Bloco,
  type Caneta,
  type Fundo,
  type Imagem,
  type Letra,
} from '../canvas';
import Escrita from './Escrita';
import Estojo from './Estojo';
import Figuras from './Figuras';
import Grampo from './Grampo';
import { achadosDoBloco, type Ocorrencia } from '../busca';
import {
  ALTURA_MINIMA_DA_FIGURA,
  alturaDaFigura,
  enderecoDaImagem,
  nomeDeAnexoLimpo,
  tamanhoDoBloco,
} from '../imagem';
import type { TipoDoc } from '../notes';

type Props = {
  blocos: Bloco[];
  tipo: TipoDoc;
  onChange: (blocos: Bloco[]) => void;
  onColarImagem: (bytes: Uint8Array, tipo: string, nome?: string) => Promise<string | null>;
  /** Abre a pasta com o anexo selecionado; ausente fora do app instalado. */
  onMostrarAnexo?: (src: string) => void;
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

/**
 * O que fica para o texto quando a seção cresce por causa de uma foto. Duas
 * linhas, e não uma: com uma só, a seção parece não ter onde escrever, e foi
 * exatamente essa a queixa. O campo cresce sozinho a partir daí.
 */
const ESPACO_PARA_O_TEXTO = 72;

type Arraste =
  | { tipo: 'mover'; id: string; offsetX: number; offsetY: number }
  | { tipo: 'redimensionar'; id: string; inicioX: number; inicioY: number; larguraInicial: number; alturaInicial: number };

export default function Canvas({
  blocos,
  tipo,
  onChange,
  onColarImagem,
  onMostrarAnexo,
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
  const [guiasAtivas, setGuiasAtivas] = useState<Guia[]>([]);
  const [figuraSendoArrastada, setFiguraSendoArrastada] = useState<string | null>(null);
  const [alvoSolturaFigura, setAlvoSolturaFigura] = useState<string | null>(null);
  const [modoFoco, setModoFoco] = useState(false);

  /**
   * De qual seção a foto foi pega. Fica numa ref, e não no estado, porque
   * ninguém precisa redesenhar enquanto a mão atravessa a página: só importa
   * onde ela soltou.
   */
  const figuraNaMao = useRef<string | null>(null);

  // Modo foco: oculta distrações da folha para focar na seção atual.
  useEffect(() => {
    function aoTeclar(evento: globalThis.KeyboardEvent) {
      if ((evento.ctrlKey || evento.metaKey) && evento.shiftKey && evento.key === 'Enter') {
        evento.preventDefault();
        setModoFoco((antigo) => !antigo);
      } else if (evento.key === 'Escape' && modoFoco) {
        setModoFoco(false);
      }
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [modoFoco]);

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
   * Arquivo que não é imagem: fica grampeado NA SEÇÃO onde foi colado, com o
   * nome à mostra. Seção que já tem um anexo não recebe outro por cima — o
   * novo abre a sua própria, logo abaixo, como acontece com a segunda foto.
   */
  async function handleArquivoColado(alvo: Bloco, arquivo: File) {
    const nome = await onColarImagem(
      new Uint8Array(await arquivo.arrayBuffer()),
      arquivo.type,
      nomeDeAnexoLimpo(arquivo.name),
    );
    if (!nome) return;

    const anexo = { src: `anexos/${nome}` };
    const agora = blocosRef.current;
    const dono =
      agora.find((bloco) => bloco.id === alvo.id) ??
      agora.find((bloco) => bloco.x === alvo.x && bloco.y === alvo.y);

    if (!dono || dono.anexo) {
      const nova = { ...criarBloco(alvo.x, alvo.y + (dono?.altura ?? 0) + ESPACO), anexo };
      onChange([...agora, nova]);
      setAtivoId(nova.id);
      return;
    }

    onChange(agora.map((bloco) => (bloco.id === dono.id ? { ...bloco, anexo } : bloco)));
    setAtivoId(dono.id);
  }

  /**
   * Clicar na foto põe o cursor no texto da seção, no fim do que já está
   * escrito. Numa folha de papel a mão vai para onde se olha; aqui a foto
   * ocupa metade do quadrado, e clicar nela não podia não fazer nada.
   */
  function escreverNaSecao(id: string) {
    setAtivoId(id);
    const campo = canvasRef.current?.querySelector<HTMLTextAreaElement>(
      `[data-bloco="${CSS.escape(id)}"] .bloco__texto`,
    );
    if (!campo) return;
    campo.focus();
    campo.setSelectionRange(campo.value.length, campo.value.length);
  }

  /**
   * Soltou a foto nesta seção. Vinda de outra, ela muda de dono — e o foco vai
   * junto, porque a próxima coisa que se faz depois de mover uma foto é
   * escrever ao lado dela.
   */
  function soltarFigura(id: string) {
    const de = figuraNaMao.current;
    figuraNaMao.current = null;
    setFiguraSendoArrastada(null);
    setAlvoSolturaFigura(null);
    if (!de || de === id) return;

    onChange(moverFigura(blocosRef.current, de, id));
    setAtivoId(id);
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

  /**
   * Com que caneta e com que letra esta seção passa a ser escrita.
   *
   * Escolher o padrão APAGA a propriedade em vez de gravá-la: seção sem escolha
   * é seção sem atributo no marcador, e a nota não engorda por guardar aquilo
   * que já é o normal.
   */
  function handleEscolha(id: string, escolha: { caneta?: Caneta; letra?: Letra; fundo?: Fundo }) {
    onChange(
      blocos.map((bloco) => {
        if (bloco.id !== id) return bloco;
        const { caneta, letra, fundo, ...resto } = bloco;
        const proxima = escolha.caneta ?? caneta;
        const proximaLetra = escolha.letra ?? letra;
        const proximoPapel = escolha.fundo ?? fundo;
        return {
          ...resto,
          ...(proxima && proxima !== 'grafite' ? { caneta: proxima } : {}),
          ...(proximaLetra && proximaLetra !== 'mono' ? { letra: proximaLetra } : {}),
          ...(proximoPapel && proximoPapel !== 'nenhum' ? { fundo: proximoPapel } : {}),
        };
      }),
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
    const candX = Math.max(0, event.clientX - rect.left - arraste.offsetX);
    const candY = Math.max(0, event.clientY - rect.top - arraste.offsetY);
    const blocoAtual = blocos.find((b) => b.id === arraste.id);
    if (!blocoAtual) return;

    const { x, y, guias } = calcularAlinhamento(
      { id: blocoAtual.id, x: candX, y: candY, largura: blocoAtual.largura, altura: blocoAtual.altura },
      blocos,
    );
    setGuiasAtivas(guias);
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
    setGuiasAtivas([]);
  }

  return (
    <div
      className={['canvas', modoFoco ? 'canvas--modo-foco' : ''].filter(Boolean).join(' ')}
      ref={canvasRef}
      onDoubleClick={handleDuploClique}
      // soltar a foto no vazio não a leva a lugar nenhum, mas a mão se abre
      onPointerUp={() => {
        figuraNaMao.current = null;
        setFiguraSendoArrastada(null);
        setAlvoSolturaFigura(null);
        setGuiasAtivas([]);
      }}
    >
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
            // a caneta pinta o texto da seção; a letra troca a família das três
            // camadas de uma vez, para que continuem casando pixel a pixel
            bloco.caneta ? `bloco--tinta bloco--caneta-${bloco.caneta}` : '',
            bloco.letra ? `bloco--letra-${bloco.letra}` : '',
            bloco.fundo && bloco.fundo !== 'nenhum' ? `bloco--papel-${bloco.fundo}` : '',
            bloco.id === alvoSolturaFigura ? 'bloco--alvo-figura' : '',
            bloco.id === figuraSendoArrastada ? 'bloco--arrastando-figura' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ left: bloco.x, top: bloco.y, width: bloco.largura, height: bloco.altura }}
          data-bloco={bloco.id}
          onPointerEnter={() => {
            if (figuraNaMao.current && figuraNaMao.current !== bloco.id) {
              setAlvoSolturaFigura(bloco.id);
            }
          }}
          onPointerLeave={() => {
            if (alvoSolturaFigura === bloco.id) {
              setAlvoSolturaFigura(null);
            }
          }}
          onPointerUp={() => soltarFigura(bloco.id)}
        >
          <div
            className="bloco__alca"
            onPointerDown={(event) => handlePointerDownAlca(event, bloco)}
            onPointerMove={handlePointerMoveAlca}
            onPointerUp={handlePointerUp}
          />
          <Estojo
            caneta={bloco.caneta ?? 'grafite'}
            letra={bloco.letra ?? 'mono'}
            fundo={bloco.fundo ?? 'nenhum'}
            onCaneta={(caneta) => handleEscolha(bloco.id, { caneta })}
            onLetra={(letra) => handleEscolha(bloco.id, { letra })}
            onFundo={(fundo) => handleEscolha(bloco.id, { fundo })}
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
              onArquivoColado={(arquivo) => handleArquivoColado(bloco, arquivo)}
              titulos={titulos}
              trechos={trechos}
              onSair={onSair}
              onDuplicar={() => handleDuplicarBloco(bloco)}
              onBlur={() => handleBlurTexto(bloco)}
            alturaDaFigura={figura?.altura ?? (figura ? ALTURA_MINIMA_DA_FIGURA : 0)}
          />
          {bloco.anexo && (
            <Grampo
              anexo={bloco.anexo}
              onMostrar={onMostrarAnexo ? () => onMostrarAnexo(bloco.anexo!.src) : undefined}
            />
          )}
          {figura && (
            <Figuras
              figura={figura}
              onMedida={(natural) => handleMedidaDaFigura(bloco, natural)}
              onEscrever={() => escreverNaSecao(bloco.id)}
              onPegar={() => {
                figuraNaMao.current = bloco.id;
                setFiguraSendoArrastada(bloco.id);
              }}
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
      {guiasAtivas.map((guia, i) => (
        <div
          key={i}
          className={`guia-alinhamento guia-alinhamento--${guia.orientacao}`}
          style={
            guia.orientacao === 'vertical'
              ? { left: `${guia.posicao}px` }
              : { top: `${guia.posicao}px` }
          }
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
