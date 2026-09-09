/**
 * A medição por relógio, fora do portão.
 *
 * Roda por `node .agent/check-escala.mjs`, e não no `npm run check`: o tempo
 * oscila com a máquina ocupada, e um portão que derruba por motivo errado é
 * pior do que não medir. O que fica na bateria é a contagem de operações, em
 * `escala.test.ts`, que dá o mesmo número em qualquer lugar.
 *
 * Aqui a pergunta é outra e vale a pena: **dobrando o caderno, o trabalho
 * dobra ou quadruplica?** É como uma varredura dentro de outra aparece antes
 * de chegar ao caderno de alguém.
 */
import { describe, expect, it } from 'vitest';
import { construirIndice } from './links';
import { tagsDoCaderno } from './tags';
import { createNote, textoDaNota, type Note } from './notes';
import { criarBloco } from './canvas';
import { matchesQuery } from './search';

function caderno(quantas: number): Note[] {
  return Array.from({ length: quantas }, (_, i) => {
    const base = createNote();
    return {
      ...base,
      id: `nota-${i}`,
      blocos: [
        {
          ...criarBloco(48, 48),
          texto: `Nota ${i}\num corpo com #assunto${i % 7} e uma ligação [[Nota ${(i + 1) % quantas}]]`,
        },
      ],
    };
  });
}

/** A melhor de cinco: uma pausa do coletor de lixo não vira "algoritmo pior". */
function medir(trabalho: () => void): number {
  let melhor = Infinity;
  for (let i = 0; i < 5; i++) {
    const inicio = performance.now();
    trabalho();
    melhor = Math.min(melhor, performance.now() - inicio);
  }
  return melhor;
}

function crescimento(trabalho: (notas: Note[]) => void, base = 400) {
  const pequeno = caderno(base);
  const grande = caderno(base * 2);
  const tempoPequeno = Math.max(medir(() => trabalho(pequeno)), 0.5);
  return medir(() => trabalho(grande)) / tempoPequeno;
}

describe('quanto custa o caderno dobrar de tamanho', () => {
  it('o índice de citações cresce com o caderno, e não com o quadrado dele', () => {
    expect(crescimento((notas) => construirIndice(notas))).toBeLessThan(3);
  });

  it('achar as notas órfãs não reconstrói o índice por nota', () => {
    expect(
      crescimento((notas) => {
        const indice = construirIndice(notas);
        notas.filter((nota) => indice.apontadaPor(nota.id).length === 0);
      }),
    ).toBeLessThan(3);
  });

  it('a lista de tags do caderno inteiro também', () => {
    expect(crescimento((notas) => tagsDoCaderno(notas))).toBeLessThan(3);
  });

  it('filtrar pela busca lê cada nota uma vez', () => {
    expect(
      crescimento((notas) =>
        notas.filter((nota) => matchesQuery(textoDaNota(nota.blocos), 'assunto3')),
      ),
    ).toBeLessThan(3);
  });
});
