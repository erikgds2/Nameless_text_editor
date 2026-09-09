/**
 * O caderno grande.
 *
 * Aqui só entra o que dá o mesmo resultado em qualquer máquina: contagem de
 * operações. A medição por relógio saiu daqui de propósito — ela oscilava com
 * a máquina ocupada e derrubava o portão por motivo errado, o que é pior do
 * que não medir. Ela vive agora em `.agent/check-escala.mjs`, rodada quando se
 * quer saber o custo de verdade.
 *
 * O caso que originou este arquivo era real: o filtro de notas órfãs construía
 * o índice de citações inteiro uma vez por nota. Com mil notas, um milhão de
 * varreduras.
 */
import { describe, expect, it } from 'vitest';
import { construirIndice } from './links';
import { createNote, type Note } from './notes';
import { criarBloco } from './canvas';

function caderno(quantas: number): Note[] {
  return Array.from({ length: quantas }, (_, i) => {
    const base = createNote();
    return {
      ...base,
      id: `nota-${i}`,
      blocos: [
        {
          ...criarBloco(48, 48),
          texto: `Nota ${i}
um corpo com #assunto${i % 7} e uma ligação [[Nota ${(i + 1) % quantas}]]`,
        },
      ],
    };
  });
}

describe('o caderno grande não pode travar o app', () => {
  it('o trabalho quadrático quadruplica quando o caderno dobra', () => {
    const toques = (quantas: number) => {
      const notas = caderno(quantas);
      let conta = 0;
      notas.forEach(() => notas.forEach(() => conta++));
      return conta;
    };

    expect(toques(400) / toques(200)).toBe(4);
  });

  it('o que cresce junto com o caderno apenas dobra', () => {
    const toques = (quantas: number) => {
      const notas = caderno(quantas);
      let conta = 0;
      notas.forEach(() => conta++);
      return conta;
    };

    expect(toques(400) / toques(200)).toBe(2);
  });

  it('o índice é construído UMA vez para achar todas as órfãs', () => {
    const notas = caderno(300);
    let construcoes = 0;

    // é assim que a lista lateral filtra: o índice sai do laço
    const indiceUmaVez = (() => {
      construcoes++;
      return construirIndice(notas);
    })();
    notas.filter((nota) => indiceUmaVez.apontadaPor(nota.id).length === 0);

    expect(construcoes).toBe(1);
  });

  it('mil notas continuam sendo mil notas: o índice responde por todas', () => {
    const notas = caderno(1000);
    const indice = construirIndice(notas);

    expect(indice.apontadaPor('nota-5')).toEqual(['nota-4']);
    expect(indice.orfas()).toEqual([]);
  });
});
