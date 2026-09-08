// Diagramas de fluxo escritos como texto, na pré-visualização.
//
// A biblioteca é pesada e a maioria das notas não tem diagrama nenhum, então ela
// só é baixada na primeira vez que um aparece — o import dinâmico é o que
// mantém a abertura do app rápida.

type Mermaid = typeof import('mermaid').default;

let carregando: Promise<Mermaid> | null = null;
let temaCarregado: string | null = null;

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
  const tema = escuro ? 'escuro' : 'claro';
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
    temaCarregado = tema;
  }
  return mermaid;
}

let contador = 0;

/**
 * Troca cada `<pre class="diagrama">` pelo desenho correspondente. Diagrama que
 * não compila mantém o código à vista: perder o texto que a pessoa escreveu por
 * causa de uma vírgula é pior do que não desenhar.
 */
export async function desenharDiagramas(raiz: HTMLElement, escuro: boolean): Promise<void> {
  const alvos = [...raiz.querySelectorAll<HTMLElement>('pre.diagrama:not(.diagrama--feito)')];
  if (alvos.length === 0) return;

  const mermaid = await motor(escuro);

  for (const alvo of alvos) {
    const fonte = alvo.textContent ?? '';
    // marcar antes de desenhar evita redesenhar o mesmo bloco se a
    // pré-visualização re-renderizar enquanto este await ainda não voltou
    alvo.classList.add('diagrama--feito');
    try {
      contador += 1;
      const { svg } = await mermaid.render(`ardosia-diagrama-${contador}`, fonte);
      alvo.innerHTML = svg;
    } catch {
      alvo.classList.add('diagrama--erro');
      alvo.classList.remove('diagrama--feito');
    }
  }
}
