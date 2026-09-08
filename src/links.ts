/**
 * Ligações `[[entre notas]]`: extração no texto, índice de citações e
 * backlinks, e renomeação em massa quando o título de uma nota muda.
 */

import { deriveTitle, textoDaNota, type Note } from './notes';
import { normalize } from './search';

export type Ligacao = { alvo: string; inicio: number; fim: number };

export type Indice = {
  apontaPara(id: string): string[];
  apontadaPor(id: string): string[];
  resolver(alvo: string): string | null;
  orfas(): string[];
  quebradas(): { origem: string; alvo: string }[];
};

// Mesma cerca reconhecida por markdown.ts (linha só com ```).
const RE_CERCA = /^```$/;

/**
 * Marca, posição a posição, os trechos da linha que estão dentro de código
 * inline (entre um par de crases) — ali um `[[` é texto literal.
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

export function extrairLigacoes(texto: string): Ligacao[] {
  const ligacoes: Ligacao[] = [];
  if (!texto) return ligacoes;

  const linhas = texto.split('\n');
  let dentroCodigo = false;
  let offset = 0;

  for (const linha of linhas) {
    if (RE_CERCA.test(linha)) {
      dentroCodigo = !dentroCodigo;
      offset += linha.length + 1;
      continue;
    }

    if (!dentroCodigo) {
      const mascara = mascaraCodigoInline(linha);
      let i = 0;
      while (i < linha.length) {
        if (mascara[i]) {
          i++;
          continue;
        }
        if (linha[i] === '[' && linha[i + 1] === '[' && !mascara[i + 1]) {
          const fimIdx = linha.indexOf(']]', i + 2);
          if (fimIdx === -1) {
            i++;
            continue;
          }
          const alvo = linha.slice(i + 2, fimIdx).trim();
          if (alvo !== '') {
            ligacoes.push({ alvo, inicio: offset + i, fim: offset + fimIdx + 2 });
          }
          i = fimIdx + 2;
          continue;
        }
        i++;
      }
    }

    offset += linha.length + 1;
  }

  return ligacoes;
}

export function construirIndice(notas: Note[]): Indice {
  // título normalizado -> nota vencedora (a de updatedAt mais recente).
  const porTitulo = new Map<string, Note>();
  for (const nota of notas) {
    const chave = normalize(deriveTitle(textoDaNota(nota.blocos)));
    const atual = porTitulo.get(chave);
    if (!atual || nota.updatedAt > atual.updatedAt) {
      porTitulo.set(chave, nota);
    }
  }

  function resolver(alvo: string): string | null {
    const nota = porTitulo.get(normalize(alvo.trim()));
    return nota ? nota.id : null;
  }

  const apontaParaMap = new Map<string, string[]>();
  const apontadaPorMap = new Map<string, string[]>();
  for (const nota of notas) apontadaPorMap.set(nota.id, []);

  const quebradasList: { origem: string; alvo: string }[] = [];

  for (const nota of notas) {
    const ligacoes = extrairLigacoes(textoDaNota(nota.blocos));
    const vistos = new Set<string>();
    const destinos: string[] = [];

    for (const ligacao of ligacoes) {
      const destinoId = resolver(ligacao.alvo);
      if (destinoId === null) {
        quebradasList.push({ origem: nota.id, alvo: ligacao.alvo });
        continue;
      }
      if (!vistos.has(destinoId)) {
        vistos.add(destinoId);
        destinos.push(destinoId);
      }
    }

    apontaParaMap.set(nota.id, destinos);
    for (const destinoId of destinos) {
      if (destinoId === nota.id) continue; // citar a si mesma não é backlink de si mesma
      apontadaPorMap.get(destinoId)?.push(nota.id);
    }
  }

  return {
    apontaPara: (id) => apontaParaMap.get(id) ?? [],
    apontadaPor: (id) => apontadaPorMap.get(id) ?? [],
    resolver,
    orfas: () => notas.map((nota) => nota.id).filter((id) => (apontadaPorMap.get(id) ?? []).length === 0),
    quebradas: () => quebradasList,
  };
}

export function renomearLigacoes(texto: string, de: string, para: string): string {
  const alvoNormalizado = normalize(de.trim());
  const ligacoes = extrairLigacoes(texto);

  let resultado = '';
  let cursor = 0;
  for (const ligacao of ligacoes) {
    if (normalize(ligacao.alvo) !== alvoNormalizado) continue;
    resultado += texto.slice(cursor, ligacao.inicio);
    resultado += `[[${para}]]`;
    cursor = ligacao.fim;
  }
  resultado += texto.slice(cursor);
  return resultado;
}
