/**
 * Camada de realce em tempo real do Ardósia: espelha caractere a caractere
 * o texto digitado num textarea transparente.
 */
import {
  escapar,
  parseInline,
  RE_CERCA,
  RE_OL,
  RE_TAREFA,
  RE_TITULO,
  RE_UL,
  type Segmento,
} from './inline';

function ehCitacao(linha: string): boolean {
  return linha === '>' || linha.startsWith('> ');
}

function conteudoCitacao(linha: string): string {
  return linha === '>' ? '' : linha.slice(2);
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
    const tarefa = resto.match(RE_TAREFA);
    if (tarefa) {
      const caixa = `[${tarefa[1]}]`;
      const texto = tarefa[2];
      return `<span class="md-marcador">${escapar(marcador)}</span> <span class="md-lista"><span class="md-tarefa">${escapar(caixa)}</span> ${segmentosParaRealce(parseInline(texto))}</span>`;
    }
    return `<span class="md-marcador">${escapar(marcador)}</span> <span class="md-lista">${segmentosParaRealce(parseInline(resto))}</span>`;
  }

  const ol = linha.match(RE_OL);
  if (ol) {
    const resto = linha.slice(ol[0].length);
    const marcador = ol[0].slice(0, -1);
    return `<span class="md-marcador">${escapar(marcador)}</span> <span class="md-lista">${segmentosParaRealce(parseInline(resto))}</span>`;
  }

  return segmentosParaRealce(parseInline(linha));
}

export function segmentosParaRealce(segmentos: Segmento[]): string {
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
    case 'grifo':
      return `<span class="md-marcador">==</span><span class="md-grifo">${segmentosParaRealce(seg.filhos)}</span><span class="md-marcador">==</span>`;
    case 'link':
      return `<span class="md-marcador">[</span><span class="md-link">${escapar(seg.texto)}</span><span class="md-marcador">](</span>${escapar(seg.url)}<span class="md-marcador">)</span>`;
    case 'imagem':
      return `<span class="md-marcador">![</span><span class="md-link">${escapar(seg.alt)}</span><span class="md-marcador">]</span><span class="md-marcador">(</span>${escapar(seg.src)}<span class="md-marcador">)</span>`;
    case 'linkImagem':
      return `<span class="md-marcador">[</span><span class="md-marcador">![</span><span class="md-link">${escapar(seg.alt)}</span><span class="md-marcador">]</span><span class="md-marcador">(</span>${escapar(seg.src)}<span class="md-marcador">)</span><span class="md-marcador">](</span>${escapar(seg.url)}<span class="md-marcador">)</span>`;
    case 'linkBruto':
      return escapar(seg.bruto);
    case 'ligacao':
      return `<span class="md-marcador">[[</span><span class="md-ligacao">${escapar(seg.bruto)}</span><span class="md-marcador">]]</span>`;
  }
}
