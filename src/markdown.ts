/**
 * Motor de renderização de Markdown do Ardósia: produz HTML para a
 * pré-visualização. A camada de realce em tempo real fica em realce.ts
 * e é reexportada aqui para conveniência.
 */
import {
  escapar,
  escaparAtributo,
  normalizarLinguagem,
  parseInline,
  RE_CELULA_SEPARADORA,
  RE_CERCA,
  RE_OL,
  RE_TAREFA,
  RE_TITULO,
  RE_UL,
  type Segmento,
} from './inline';

export { realcar } from './realce';

export function renderizar(texto: string): string {
  if (!texto) return '';

  const linhas = texto.split('\n');
  const blocos: string[] = [];
  let i = 0;

  while (i < linhas.length) {
    const linha = linhas[i];

    const cercaAbertura = linha.match(RE_CERCA);
    if (cercaAbertura) {
      const linguagem = normalizarLinguagem(cercaAbertura[1]);
      i++;
      const conteudo: string[] = [];
      while (i < linhas.length && !RE_CERCA.test(linhas[i])) {
        conteudo.push(linhas[i]);
        i++;
      }
      if (i < linhas.length) i++; // pula a cerca de fechamento
      const fonte = escapar(conteudo.join('\n'));
      if (linguagem === 'mermaid') {
        blocos.push(`<pre class="diagrama"><code>${fonte}</code></pre>`);
      } else if (linguagem) {
        blocos.push(`<pre><code class="linguagem-${linguagem}">${fonte}</code></pre>`);
      } else {
        blocos.push(`<pre><code>${fonte}</code></pre>`);
      }
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
      blocos.push(`<ul>${itens.map((l) => itemListaParaHtml(l)).join('')}</ul>`);
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

    const tabela = inicioDeTabela(linhas, i);
    if (tabela) {
      i += 2;
      const corpo: string[][] = [];
      while (i < linhas.length && linhas[i].includes('|') && linhas[i].trim() !== '') {
        corpo.push(dividirCelulas(linhas[i]));
        i++;
      }
      blocos.push(tabelaParaHtml(tabela.cabecalho, tabela.alinhamentos, corpo));
      continue;
    }

    const paragrafo: string[] = [];
    while (i < linhas.length && !ehLimiteDeBloco(linhas, i)) {
      paragrafo.push(linhas[i]);
      i++;
    }
    blocos.push(`<p>${paragrafo.map((l) => segmentosParaHtml(parseInline(l))).join('<br>')}</p>`);
  }

  return blocos.join('');
}

function ehLimiteDeBloco(linhas: string[], i: number): boolean {
  const linha = linhas[i];
  return (
    linha.trim() === '' ||
    RE_CERCA.test(linha) ||
    linha === '---' ||
    RE_TITULO.test(linha) ||
    ehCitacao(linha) ||
    RE_UL.test(linha) ||
    RE_OL.test(linha) ||
    inicioDeTabela(linhas, i) !== null
  );
}

function ehCitacao(linha: string): boolean {
  return linha === '>' || linha.startsWith('> ');
}

function conteudoCitacao(linha: string): string {
  return linha === '>' ? '' : linha.slice(2);
}

function itemListaParaHtml(conteudo: string): string {
  const tarefa = conteudo.match(RE_TAREFA);
  if (tarefa) {
    const marcado = tarefa[1].toLowerCase() === 'x';
    const texto = tarefa[2];
    return `<li class="tarefa"><input type="checkbox"${marcado ? ' checked' : ''} disabled> ${segmentosParaHtml(parseInline(texto))}</li>`;
  }
  return `<li>${segmentosParaHtml(parseInline(conteudo))}</li>`;
}

function dividirCelulas(linha: string): string[] {
  const brutas: string[] = [];
  let atual = '';
  for (let j = 0; j < linha.length; j++) {
    const c = linha[j];
    if (c === '\\' && linha[j + 1] === '|') {
      atual += '|';
      j++;
      continue;
    }
    if (c === '|') {
      brutas.push(atual);
      atual = '';
      continue;
    }
    atual += c;
  }
  brutas.push(atual);

  const celulas = brutas.map((c) => c.trim());
  if (celulas.length > 0 && celulas[0] === '') celulas.shift();
  if (celulas.length > 0 && celulas[celulas.length - 1] === '') celulas.pop();
  return celulas;
}

function alinhamentoCelula(celula: string): string | null {
  if (!RE_CELULA_SEPARADORA.test(celula)) return null;
  const esquerda = celula.startsWith(':');
  const direita = celula.endsWith(':');
  if (esquerda && direita) return 'center';
  if (direita) return 'right';
  if (esquerda) return 'left';
  return '';
}

function linhaSeparadoraTabela(linha: string): string[] | null {
  const celulas = dividirCelulas(linha);
  if (celulas.length === 0) return null;
  const alinhamentos: string[] = [];
  for (const celula of celulas) {
    const alinhamento = alinhamentoCelula(celula);
    if (alinhamento === null) return null;
    alinhamentos.push(alinhamento);
  }
  return alinhamentos;
}

function inicioDeTabela(
  linhas: string[],
  i: number,
): { cabecalho: string[]; alinhamentos: string[] } | null {
  const linha = linhas[i];
  if (!linha.includes('|') || i + 1 >= linhas.length) return null;
  const alinhamentos = linhaSeparadoraTabela(linhas[i + 1]);
  if (!alinhamentos) return null;
  const cabecalho = dividirCelulas(linha);
  if (cabecalho.length === 0) return null;
  return { cabecalho, alinhamentos };
}

function tabelaParaHtml(cabecalho: string[], alinhamentos: string[], corpo: string[][]): string {
  const numColunas = cabecalho.length;
  const estilo = (idx: number): string => {
    const alinhamento = alinhamentos[idx];
    return alinhamento ? ` style="text-align:${alinhamento}"` : '';
  };
  const th = cabecalho
    .map((c, idx) => `<th${estilo(idx)}>${segmentosParaHtml(parseInline(c))}</th>`)
    .join('');
  const linhasHtml = corpo
    .map((celulas) => {
      const ajustadas = celulas.slice(0, numColunas);
      while (ajustadas.length < numColunas) ajustadas.push('');
      return `<tr>${ajustadas.map((c, idx) => `<td${estilo(idx)}>${segmentosParaHtml(parseInline(c))}</td>`).join('')}</tr>`;
    })
    .join('');
  return `<div class="preview__tabela"><table><thead><tr>${th}</tr></thead><tbody>${linhasHtml}</tbody></table></div>`;
}

export function segmentosParaHtml(segmentos: Segmento[]): string {
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
    case 'grifo':
      return `<mark class="md-grifo">${segmentosParaHtml(seg.filhos)}</mark>`;
    case 'link':
      return `<a href="${escaparAtributo(seg.url)}" target="_blank" rel="noreferrer">${escapar(seg.texto)}</a>`;
    case 'imagem':
      return `<img src="${escaparAtributo(seg.src)}" alt="${escaparAtributo(seg.alt)}">`;
    case 'linkImagem':
      return `<a href="${escaparAtributo(seg.url)}" target="_blank" rel="noreferrer"><img src="${escaparAtributo(seg.src)}" alt="${escaparAtributo(seg.alt)}"></a>`;
    case 'linkBruto':
      return escapar(seg.bruto);
    case 'ligacao':
      return `<a class="ligacao" data-alvo="${escaparAtributo(seg.alvo)}">${escapar(seg.alvo)}</a>`;
  }
}
