/**
 * Analisador inline e tipos compartilhados entre o motor de renderização
 * (markdown.ts) e o motor de realce em tempo real (realce.ts).
 */

export type Segmento =
  | { tipo: 'texto'; valor: string }
  | { tipo: 'codigo'; conteudo: string }
  | { tipo: 'forte'; filhos: Segmento[] }
  | { tipo: 'enfase'; marcador: '*' | '_'; filhos: Segmento[] }
  | { tipo: 'riscado'; filhos: Segmento[] }
  | { tipo: 'grifo'; filhos: Segmento[] }
  | { tipo: 'link'; texto: string; url: string }
  | { tipo: 'imagem'; alt: string; src: string }
  | { tipo: 'linkImagem'; alt: string; src: string; url: string }
  | { tipo: 'linkBruto'; bruto: string }
  | { tipo: 'ligacao'; alvo: string; bruto: string };

export const RE_CERCA = /^```(.*)$/;
export const RE_LINGUAGEM_VALIDA = /^[a-zA-Z0-9+-]{1,20}$/;
export const RE_TITULO = /^(#{1,6}) (.*)$/;
export const RE_UL = /^[-*] /;
export const RE_OL = /^\d+\. /;
export const RE_URL_PERMITIDA = /^(https?:\/\/|#)/;
export const RE_SRC_PERMITIDA = /^(https?:\/\/|ardosia:\/\/|anexos\/)/;
export const RE_IMAGEM = /^\[([^\]]*)\]\(([^)]*)\)/;
export const RE_LINK_IMAGEM = /^\[!\[([^\]]*)\]\(([^)]*)\)\]\(([^)]*)\)/;
export const RE_TAREFA = /^\[([ xX])\] (.*)$/;
export const RE_CELULA_SEPARADORA = /^:?-+:?$/;

/** Linguagem normalizada (minúscula) de uma cerca de código, ou `null` se ausente/inválida. */
export function normalizarLinguagem(bruto: string): string | null {
  if (!RE_LINGUAGEM_VALIDA.test(bruto)) return null;
  return bruto.toLowerCase();
}

export function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escaparAtributo(s: string): string {
  return escapar(s).replace(/"/g, '&quot;');
}

/**
 * Analisa a sintaxe inline (negrito, ênfase, código, riscado, grifo, link) de uma
 * única linha (ou trecho sem quebras) e devolve uma árvore de segmentos.
 */
export function parseInline(texto: string): Segmento[] {
  const segmentos: Segmento[] = [];
  let buffer = '';
  let i = 0;
  const n = texto.length;

  const flush = () => {
    if (buffer) {
      segmentos.push({ tipo: 'texto', valor: buffer });
      buffer = '';
    }
  };

  while (i < n) {
    const c = texto[i];

    if (c === '`') {
      const fim = texto.indexOf('`', i + 1);
      if (fim !== -1) {
        flush();
        segmentos.push({ tipo: 'codigo', conteudo: texto.slice(i + 1, fim) });
        i = fim + 1;
        continue;
      }
    }

    if (c === '*' && texto[i + 1] === '*') {
      const fim = texto.indexOf('**', i + 2);
      if (fim !== -1) {
        flush();
        segmentos.push({ tipo: 'forte', filhos: parseInline(texto.slice(i + 2, fim)) });
        i = fim + 2;
        continue;
      }
    }

    if (c === '~' && texto[i + 1] === '~') {
      const fim = texto.indexOf('~~', i + 2);
      if (fim !== -1) {
        flush();
        segmentos.push({ tipo: 'riscado', filhos: parseInline(texto.slice(i + 2, fim)) });
        i = fim + 2;
        continue;
      }
    }

    if (c === '=' && texto[i + 1] === '=') {
      const fim = texto.indexOf('==', i + 2);
      if (fim !== -1) {
        flush();
        segmentos.push({ tipo: 'grifo', filhos: parseInline(texto.slice(i + 2, fim)) });
        i = fim + 2;
        continue;
      }
    }

    if (c === '*' || c === '_') {
      const fim = texto.indexOf(c, i + 1);
      if (fim > i + 1) {
        flush();
        segmentos.push({ tipo: 'enfase', marcador: c, filhos: parseInline(texto.slice(i + 1, fim)) });
        i = fim + 1;
        continue;
      }
    }

    if (c === '!' && texto[i + 1] === '[') {
      const m = texto.slice(i + 1).match(RE_IMAGEM);
      if (m) {
        flush();
        const alt = m[1];
        const src = m[2];
        if (RE_SRC_PERMITIDA.test(src)) {
          segmentos.push({ tipo: 'imagem', alt, src });
        } else {
          segmentos.push({ tipo: 'linkBruto', bruto: '!' + m[0] });
        }
        i += 1 + m[0].length;
        continue;
      }
    }

    if (c === '[' && texto[i + 1] === '[') {
      const fim = texto.indexOf(']]', i + 2);
      if (fim !== -1) {
        const bruto = texto.slice(i + 2, fim);
        const alvo = bruto.trim();
        if (alvo !== '') {
          flush();
          segmentos.push({ tipo: 'ligacao', alvo, bruto });
          i = fim + 2;
          continue;
        }
      }
    }

    if (c === '[') {
      const nested = texto.slice(i).match(RE_LINK_IMAGEM);
      if (nested) {
        const alt = nested[1];
        const src = nested[2];
        const url = nested[3];
        if (RE_SRC_PERMITIDA.test(src) && RE_URL_PERMITIDA.test(url)) {
          flush();
          segmentos.push({ tipo: 'linkImagem', alt, src, url });
          i += nested[0].length;
          continue;
        }
      }

      const m = texto.slice(i).match(RE_IMAGEM);
      if (m) {
        flush();
        const url = m[2];
        if (RE_URL_PERMITIDA.test(url)) {
          segmentos.push({ tipo: 'link', texto: m[1], url });
        } else {
          segmentos.push({ tipo: 'linkBruto', bruto: m[0] });
        }
        i += m[0].length;
        continue;
      }
    }

    buffer += c;
    i++;
  }

  flush();
  return segmentos;
}
