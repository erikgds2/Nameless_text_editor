// Diagramas de fluxo escritos como texto, na pré-visualização.
//
// A biblioteca é pesada e a maioria das notas não tem diagrama nenhum, então ela
// só é baixada na primeira vez que um aparece — o import dinâmico é o que
// mantém a abertura do app rápida.

type Mermaid = typeof import('mermaid').default;

let carregando: Promise<Mermaid> | null = null;
let temaCarregado: string | null = null;

/**
 * O desenho já pronto de cada fonte. Existe porque o React reescreve o HTML da
 * pré-visualização inteira quando bem entende — ao arrastar a divisória, por
 * exemplo — e o SVG que injetamos vai junto. Sem esta memória, o diagrama
 * voltaria a ser código a cada rerrenderização, e só reapareceria depois de
 * outra volta pelo mermaid.
 */
const desenhados = new Map<string, string>();
const LIMITE = 50;

/** Lê um token do tema como ele está valendo agora, na tela. */
function token(nome: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

async function motor(escuro: boolean): Promise<Mermaid> {
  if (!carregando) carregando = import('mermaid').then((modulo) => modulo.default);
  const mermaid = await carregando;

  // Um diagrama com a paleta de fábrica (azul e cinza) destoaria de tudo o
  // mais. Ele herda os tokens do tema, então acompanha a troca de tema junto
  // com o resto do app. Reconfigurar é barato; só não vale repetir à toa.
  const tema = `${escuro}|${token('--accent')}`;
  if (temaCarregado !== tema) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      themeVariables: {
        darkMode: escuro,
        background: 'transparent',
        primaryColor: token('--surface-alt'),
        primaryTextColor: token('--ink'),
        primaryBorderColor: token('--accent'),
        secondaryColor: token('--surface'),
        tertiaryColor: token('--surface'),
        lineColor: token('--ink-soft'),
        textColor: token('--ink'),
        fontFamily: token('--mono'),
        fontSize: '13px',
      },
    });
    // o que foi desenhado com as cores antigas não serve mais
    desenhados.clear();
    temaCarregado = tema;
  }
  return mermaid;
}

/**
 * Repõe na hora os diagramas que já foram desenhados alguma vez. Devolve true
 * se ainda sobrou algum por desenhar — esse precisa do mermaid, que é lento e
 * assíncrono; este aqui é imediato e evita o diagrama piscar.
 */
export function reporDiagramas(raiz: HTMLElement): boolean {
  let faltam = false;
  for (const alvo of raiz.querySelectorAll<HTMLElement>('pre.diagrama:not(.diagrama--feito)')) {
    const pronto = desenhados.get(fonteDe(alvo));
    if (pronto) {
      alvo.innerHTML = pronto;
      alvo.classList.add('diagrama--feito');
    } else {
      faltam = true;
    }
  }
  return faltam;
}

/**
 * Manda desenhar tudo de novo. Trocar de tema muda as cores do diagrama, mas o
 * desenho pronto continuaria na tela — ele não é recalculado por CSS, é um SVG
 * com as cores assadas dentro.
 */
export function esquecerDiagramas(raiz: HTMLElement): void {
  desenhados.clear();
  temaCarregado = null;
  for (const alvo of raiz.querySelectorAll('pre.diagrama')) {
    alvo.classList.remove('diagrama--feito');
  }
}

/**
 * O código do diagrama, e não o texto que estiver na tela. Depois de desenhado,
 * o conteúdo do elemento é o SVG — ler `textContent` ali devolveria os rótulos
 * dos nós, que não são um diagrama válido. A fonte fica guardada no elemento na
 * primeira leitura, e é dela que todo redesenho parte.
 */
function fonteDe(alvo: HTMLElement): string {
  if (alvo.dataset.fonte === undefined) alvo.dataset.fonte = alvo.textContent ?? '';
  return alvo.dataset.fonte;
}

let contador = 0;

/**
 * Desenha o que ainda não tem desenho. Diagrama que não compila mantém o código
 * à vista: perder o texto que a pessoa escreveu por causa de uma vírgula é pior
 * do que não desenhar.
 */
export async function desenharDiagramas(raiz: HTMLElement, escuro: boolean): Promise<void> {
  if (raiz.querySelector('pre.diagrama:not(.diagrama--feito)') === null) return;

  const mermaid = await motor(escuro);
  // trocar de tema limpa a memória, então há mais o que repor antes de desenhar
  reporDiagramas(raiz);

  for (const alvo of raiz.querySelectorAll<HTMLElement>('pre.diagrama:not(.diagrama--feito)')) {
    const fonte = fonteDe(alvo);
    // marcar antes de desenhar evita redesenhar o mesmo bloco se a
    // pré-visualização re-renderizar enquanto este await ainda não voltou
    alvo.classList.add('diagrama--feito');
    try {
      contador += 1;
      const { svg } = await mermaid.render(`ardosia-diagrama-${contador}`, fonte);
      alvo.innerHTML = svg;
      if (desenhados.size >= LIMITE) desenhados.delete(desenhados.keys().next().value as string);
      desenhados.set(fonte, svg);
    } catch {
      alvo.classList.add('diagrama--erro');
      alvo.classList.remove('diagrama--feito');
    }
  }
}
