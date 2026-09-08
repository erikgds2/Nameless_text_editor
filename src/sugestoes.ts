/**
 * Autocompletar de `[[ligações]]`: só a lógica pura de saber o que está
 * sendo digitado numa posição do texto e como completar. Nada de DOM aqui —
 * quem liga isso a um campo de texto real fica de fora deste arquivo.
 */

import { normalize } from './search';

export type Escrevendo = { termo: string; inicio: number; fim: number };

// Mesma cerca reconhecida por links.ts e markdown.ts (linha só com ```).
const RE_CERCA = /^```$/;

/**
 * Marca, posição a posição, os trechos da linha que estão dentro de código
 * inline (entre um par de crases) — ali um `[[` é texto literal. Mesma regra
 * de links.ts, reimplementada aqui por não ser exportada de lá.
 */
function mascaraCodigoInline(linha: string): boolean[] {
  const mascara = new Array<boolean>(linha.length).fill(false);
  let i = 0;
  while (i < linha.length) {
    if (linha[i] === '`') {
      const fim = linha.indexOf('`', i + 1);
      if (fim !== -1) {
        for (let k = i; k <= fim; k++) mascara[k] = true;
        i = fim + 1;
        continue;
      }
    }
    i++;
  }
  return mascara;
}

/** Se a linha que começa em `inicioLinha` está dentro de um bloco cercado. */
function estaEmBlocoCercado(texto: string, inicioLinha: number): boolean {
  const linhasAntes = texto.slice(0, inicioLinha).split('\n');
  let dentro = false;
  for (const linha of linhasAntes) {
    if (RE_CERCA.test(linha)) dentro = !dentro;
  }
  return dentro;
}

export function ligacaoSendoEscrita(texto: string, cursor: number): Escrevendo | null {
  const inicioLinha = texto.lastIndexOf('\n', cursor - 1) + 1;
  let fimLinha = texto.indexOf('\n', cursor);
  if (fimLinha === -1) fimLinha = texto.length;
  const linha = texto.slice(inicioLinha, fimLinha);

  if (estaEmBlocoCercado(texto, inicioLinha)) return null;

  const antesDoCursor = texto.slice(inicioLinha, cursor);
  const posicaoNaLinha = antesDoCursor.lastIndexOf('[[');
  if (posicaoNaLinha === -1) return null;

  const termo = antesDoCursor.slice(posicaoNaLinha + 2);
  if (termo.includes('[') || termo.includes(']')) return null;

  const mascara = mascaraCodigoInline(linha);
  if (mascara[posicaoNaLinha] || mascara[posicaoNaLinha + 1]) return null;

  return { termo, inicio: inicioLinha + posicaoNaLinha, fim: cursor };
}

export function completarLigacao(
  texto: string,
  alvo: string,
  onde: Escrevendo
): { texto: string; cursor: number } {
  const jaFechado = texto.slice(onde.fim, onde.fim + 2) === ']]';
  const inserto = `[[${alvo}]]`;
  const depois = texto.slice(jaFechado ? onde.fim + 2 : onde.fim);
  const textoNovo = texto.slice(0, onde.inicio) + inserto + depois;
  return { texto: textoNovo, cursor: onde.inicio + inserto.length };
}

export function ordenarCandidatos(titulos: string[], termo: string): string[] {
  const alvo = normalize(termo.trim());
  if (alvo === '') return [...titulos];

  const comeca: string[] = [];
  const contem: string[] = [];
  titulos.forEach((titulo) => {
    const normalizado = normalize(titulo);
    if (normalizado.startsWith(alvo)) comeca.push(titulo);
    else if (normalizado.includes(alvo)) contem.push(titulo);
  });

  return [...comeca, ...contem];
}
