#!/usr/bin/env node
// Traduz o DESIGN.md em verificacoes automaticas. Sem isto, "nao use gradiente"
// e so uma sugestao no prompt; com isto, e uma condicao de aceite que o modelo
// local precisa satisfazer sozinho.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const CSS = resolve(ROOT, 'src/styles.css');

const PALETA = new Set(
  [
    '#F7F4ED', '#F1EDE3', '#1A1714', '#6B645C', '#DDD6C7', '#A4551A', '#F0E2C0', '#8C2F1D',
    '#14120F', '#191612', '#E8E2D6', '#948C80', '#2C2822', '#D08A3E', '#3A2F1A', '#C25B44',
    '#F0E5D6', '#F0DFD9', '#2A2118', '#2A1A16',
    '#171512', '#EDEAE4', '#A39C92', '#E08672',
  ].map((c) => c.toLowerCase()),
);

const ESCALA = new Set([10, 12, 14, 16, 19, 24]);
const TRANSICOES_OK = new Set(['color', 'background', 'background-color', 'opacity', 'border-color', 'none']);

const css = readFileSync(CSS, 'utf8');
const linhas = css.split(/\r?\n/);
const erros = [];

const erro = (i, msg) => erros.push(`styles.css:${i + 1}  ${msg}`);

linhas.forEach((linha, i) => {
  const l = linha.trim();
  if (l.startsWith('/*') || l.startsWith('*')) return;

  const baixa = l.toLowerCase();
  const ehToken = l.startsWith('--');

  if (baixa.includes('gradient(')) erro(i, 'gradiente proibido pelo DESIGN.md');
  if (baixa.includes('backdrop-filter') || /filter:\s*blur/.test(baixa)) erro(i, 'blur/glassmorphism proibido');
  if (/box-shadow\s*:/.test(baixa) && !/box-shadow\s*:\s*none/.test(baixa)) erro(i, 'sombra proibida: hierarquia vem de regua e espaco');
  if (/\binter\b/.test(baixa) && baixa.includes('font')) erro(i, 'fonte Inter proibida');

  // literais de cor so podem existir na definicao dos tokens
  if (!ehToken) {
    const cor = baixa.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/);
    if (cor) erro(i, `cor literal "${cor[0]}" fora dos tokens: use var(--...)`);
  } else {
    for (const hex of baixa.match(/#[0-9a-f]{6}\b/g) ?? []) {
      if (!PALETA.has(hex)) erro(i, `cor ${hex} nao pertence a paleta do DESIGN.md`);
    }
  }

  const raio = baixa.match(/border-radius\s*:\s*(\d+)px/);
  if (raio && Number(raio[1]) > 2) erro(i, `border-radius ${raio[1]}px: o maximo e 2px`);
  if (/border-radius\s*:\s*(50%|999)/.test(baixa)) erro(i, 'cantos arredondados proibidos');

  const tamanho = baixa.match(/font-size\s*:\s*(\d+)px/);
  if (tamanho && !ESCALA.has(Number(tamanho[1]))) {
    erro(i, `font-size ${tamanho[1]}px fora da escala 10/12/14/16/19/24`);
  }

  const transicao = baixa.match(/transition\s*:\s*([^;]+)/);
  if (transicao) {
    for (const parte of transicao[1].split(',')) {
      const prop = parte.trim().split(/\s+/)[0];
      if (prop && !TRANSICOES_OK.has(prop)) erro(i, `transicao de "${prop}" proibida: so cor e opacidade`);
    }
  }
});

if (!/--serif|Literata/.test(css)) erros.push('styles.css  a familia serifada do DESIGN.md nao foi declarada');
for (const tema of ['acrilico', 'papel', 'tinta']) {
  if (!new RegExp(`data-theme="${tema}"`).test(css)) {
    erros.push(`styles.css  o tema "${tema}" do DESIGN.md nao foi definido`);
  }
}
if (!/--paper-solid/.test(css)) erros.push('styles.css  falta --paper-solid: o navegador nao tem acrilico');
if (!/--mono|Plex Mono/.test(css)) erros.push('styles.css  a familia monoespacada do DESIGN.md nao foi declarada');

if (erros.length > 0) {
  console.error(`DESIGN.md violado (${erros.length}):`);
  for (const e of erros.slice(0, 25)) console.error(`  ${e}`);
  process.exit(1);
}

console.log('design ok');
