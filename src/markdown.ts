/**
 * Motor de Markdown do Ardósia: renderiza HTML para a pré-visualização
 * (`renderizar`) e uma camada de realce que espelha, caractere a caractere,
 * o texto de um textarea transparente (`realcar`).
 */

type Segmento =
  | { tipo: 'texto'; valor: string }
  | { tipo: 'codigo'; conteudo: string }
  | { tipo: 'forte'; filhos: Segmento[] }
  | { tipo: 'enfase'; marcador: '*' | '_'; filhos: Segmento[] }
  | { tipo: 'riscado'; filhos: Segmento[] }
  | { tipo: 'link'; texto: string; url: string }
  | { tipo: 'linkBruto'; bruto: string };

const RE_CERCA = /^```$/;
const RE_TITULO = /^(#{1,6}) (.*)$/;
const RE_UL = /^[-*] /;
const RE_OL = /^\d+\. /;
const RE_URL_PERMITIDA = /^(https?:\/\/|#)/;

export function renderizar(texto: string): string {
  if (!texto) return '';

  const linhas = texto.split('\n');
  const blocos: string[] = [];
  let i = 0;

  while (i < linhas.length) {
    const linha = linhas[i];

    if (RE_CERCA.test(linha)) {
      i++;
      const conteudo: string[] = [];
      while (i < linhas.length && !RE_CERCA.test(linhas[i])) {
        conteudo.push(linhas[i]);
        i++;
      }
      if (i < linhas.length) i++; // pula a cerca de fechamento
      blocos.push(`<pre><code>${escapar(conteudo.join('\n'))}</code></pre>`);
      continue;
    }

    if (linha.trim() === '') {
      i++;
      continue;
    }

    if (linha === '---') {
      blocos.push('<hr>');
      i++;
      continue;
    }

    const titulo = linha.match(RE_TITULO);
    if (titulo) {
      const nivel = titulo[1].length;
      blocos.push(`<h${nivel}>${segmentosParaHtml(parseInline(titulo[2]))}</h${nivel}>`);
      i++;
      continue;
    }

    if (ehCitacao(linha)) {
      const itens: string[] = [];
      while (i < linhas.length && ehCitacao(linhas[i])) {
        itens.push(conteudoCitacao(linhas[i]));
        i++;
      }
      blocos.push(
        `<blockquote>${itens.map((l) => segmentosParaHtml(parseInline(l))).join('<br>')}</blockquote>`,
      );
      continue;
    }

    if (RE_UL.test(linha)) {
      const itens: string[] = [];
      while (i < linhas.length && RE_UL.test(linhas[i])) {
        itens.push(linhas[i].slice(2));
        i++;
      }
      blocos.push(`<ul>${itens.map((l) => `<li>${segmentosParaHtml(parseInline(l))}</li>`).join('')}</ul>`);
      continue;
    }

    if (RE_OL.test(linha)) {
      const itens: string[] = [];
      while (i < linhas.length && RE_OL.test(linhas[i])) {
        itens.push(linhas[i].replace(RE_OL, ''));
        i++;
      }
      blocos.push(`<ol>${itens.map((l) => `<li>${segmentosParaHtml(parseInline(l))}</li>`).join('')}</ol>`);
      continue;
    }

    const paragrafo: string[] = [];
    while (i < linhas.length && !ehLimiteDeBloco(linhas[i])) {
      paragrafo.push(linhas[i]);
      i++;
    }
    blocos.push(`<p>${paragrafo.map((l) => segmentosParaHtml(parseInline(l))).join('<br>')}</p>`);
  }

  return blocos.join('');
}

export function realcar(texto: string): string {
  if (!texto) return '';

  const linhas = texto.split('\n');
  let dentroCodigo = false;

  const saida = linhas.map((linha) => {
    if (RE_CERCA.test(linha)) {
      dentroCodigo = !dentroCodigo;
      return `<span class="md-marcador">${escapar(linha)}</span>`;
    }
    if (dentroCodigo) {
      return `<span class="md-codigo">${escapar(linha)}</span>`;
    }
    return realcarLinha(linha);
  });

  return saida.join('\n');
}

function realcarLinha(linha: string): string {
  const titulo = linha.match(RE_TITULO);
  if (titulo) {
    const marcador = titulo[1];
    const resto = titulo[2];
    return `<span class="md-marcador">${escapar(marcador)}</span> <span class="md-titulo">${segmentosParaRealce(parseInline(resto))}</span>`;
  }

  if (linha === '---') {
    return `<span class="md-marcador">---</span>`;
  }

  if (ehCitacao(linha)) {
    if (linha === '>') {
      return `<span class="md-marcador">${escapar('>')}</span>`;
    }
    const resto = conteudoCitacao(linha);
    return `<span class="md-marcador">${escapar('>')}</span> <span class="md-citacao">${segmentosParaRealce(parseInline(resto))}</span>`;
  }

  if (RE_UL.test(linha)) {
    const marcador = linha[0];
    const resto = linha.slice(2);
    return `<span class="md-marcador">${escapar(marcador)}</span> <span class="md-lista">${segmentosParaRealce(parseInline(resto))}</span>`;
  }

  const ol = linha.match(RE_OL);
  if (ol) {
    const resto = linha.slice(ol[0].length);
    const marcador = ol[0].slice(0, -1); // remove o espaço final, devolvido depois como literal
    return `<span class="md-marcador">${escapar(marcador)}</span> <span class="md-lista">${segmentosParaRealce(parseInline(resto))}</span>`;
  }

  return segmentosParaRealce(parseInline(linha));
}

function ehLimiteDeBloco(linha: string): boolean {
  return (
    linha.trim() === '' ||
    RE_CERCA.test(linha) ||
    linha === '---' ||
    RE_TITULO.test(linha) ||
    ehCitacao(linha) ||
    RE_UL.test(linha) ||
    RE_OL.test(linha)
  );
}

function ehCitacao(linha: string): boolean {
  return linha === '>' || linha.startsWith('> ');
}

function conteudoCitacao(linha: string): string {
  return linha === '>' ? '' : linha.slice(2);
}

/**
 * Analisa a sintaxe inline (negrito, ênfase, código, riscado, link) de uma
 * única linha (ou trecho sem quebras) e devolve uma árvore de segmentos.
 * Usada por `renderizar` e `realcar`, que a percorrem de formas diferentes.
 */
function parseInline(texto: string): Segmento[] {
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

    if (c === '*' || c === '_') {
      const fim = texto.indexOf(c, i + 1);
      if (fim > i + 1) {
        flush();
        segmentos.push({ tipo: 'enfase', marcador: c, filhos: parseInline(texto.slice(i + 1, fim)) });
        i = fim + 1;
        continue;
      }
    }

    if (c === '[') {
      const m = texto.slice(i).match(/^\[([^\]]*)\]\(([^)]*)\)/);
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

function segmentosParaHtml(segmentos: Segmento[]): string {
  return segmentos.map(segmentoParaHtml).join('');
}

function segmentoParaHtml(seg: Segmento): string {
  switch (seg.tipo) {
    case 'texto':
      return escapar(seg.valor);
    case 'codigo':
      return `<code>${escapar(seg.conteudo)}</code>`;
    case 'forte':
      return `<strong>${segmentosParaHtml(seg.filhos)}</strong>`;
    case 'enfase':
      return `<em>${segmentosParaHtml(seg.filhos)}</em>`;
    case 'riscado':
      return `<del>${segmentosParaHtml(seg.filhos)}</del>`;
    case 'link':
      return `<a href="${escaparAtributo(seg.url)}" target="_blank" rel="noreferrer">${escapar(seg.texto)}</a>`;
    case 'linkBruto':
      return escapar(seg.bruto);
  }
}

function segmentosParaRealce(segmentos: Segmento[]): string {
  return segmentos.map(segmentoParaRealce).join('');
}

function segmentoParaRealce(seg: Segmento): string {
  switch (seg.tipo) {
    case 'texto':
      return escapar(seg.valor);
    case 'codigo':
      return `<span class="md-marcador">\`</span><span class="md-codigo">${escapar(seg.conteudo)}</span><span class="md-marcador">\`</span>`;
    case 'forte':
      return `<span class="md-marcador">**</span><span class="md-forte">${segmentosParaRealce(seg.filhos)}</span><span class="md-marcador">**</span>`;
    case 'enfase':
      return `<span class="md-marcador">${seg.marcador}</span><span class="md-enfase">${segmentosParaRealce(seg.filhos)}</span><span class="md-marcador">${seg.marcador}</span>`;
    case 'riscado':
      return `<span class="md-marcador">~~</span><span class="md-riscado">${segmentosParaRealce(seg.filhos)}</span><span class="md-marcador">~~</span>`;
    case 'link':
      return `<span class="md-marcador">[</span><span class="md-link">${escapar(seg.texto)}</span><span class="md-marcador">](</span>${escapar(seg.url)}<span class="md-marcador">)</span>`;
    case 'linkBruto':
      return escapar(seg.bruto);
  }
}

function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escaparAtributo(s: string): string {
  return escapar(s).replace(/"/g, '&quot;');
}
