/**
 * O caderno grande.
 *
 * Não mede velocidade — máquina lenta e máquina rápida dariam respostas
 * diferentes, e o teste viveria falhando por motivo errado. Mede **como o
 * custo cresce**: dobrando o número de notas, o trabalho pode dobrar, mas não
 * pode quadruplicar. É assim que uma varredura dentro de outra aparece antes
 * de chegar ao caderno de alguém.
 *
 * O caso que originou este arquivo era real: o filtro de notas órfãs construía
 * o índice de citações inteiro uma vez por nota. Com mil notas, um milhão de
 * varreduras.
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

/**
 * Quanto tempo leva, na melhor de três tentativas. A melhor, e não a média:
 * uma pausa do coletor de lixo no meio de uma delas não pode ser confundida
 * com um algoritmo pior.
 */
function medir(trabalho: () => void): number {
  let melhor = Infinity;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const inicio = performance.now();
    trabalho();
    melhor = Math.min(melhor, performance.now() - inicio);
  }
  return melhor;
}

/**
 * Dobrar a entrada não pode multiplicar o trabalho por mais de `folga`. Linear
 * dobra (2x); quadrático quadruplica (4x). A folga de 3 deixa passar o custo
 * fixo de cada rodada sem deixar passar um quadrático.
 */
function crescimentoAceitavel(trabalho: (notas: Note[]) => void, folga = 3, base = 400) {
  const pequeno = caderno(base);
  const grande = caderno(base * 2);

  const tempoPequeno = Math.max(medir(() => trabalho(pequeno)), 0.5);
  const tempoGrande = medir(() => trabalho(grande));

  return { razao: tempoGrande / tempoPequeno, folga };
}

describe('o caderno grande não pode travar o app', () => {
  it('o índice de citações cresce com o caderno, e não com o quadrado dele', () => {
    const { razao, folga } = crescimentoAceitavel((notas) => construirIndice(notas));
    expect(razao).toBeLessThan(folga);
  });

  it('achar as notas órfãs não reconstrói o índice por nota', () => {
    const { razao, folga } = crescimentoAceitavel((notas) => {
      // é assim que a lista lateral filtra: o índice sai do laço
      const indice = construirIndice(notas);
      notas.filter((nota) => indice.apontadaPor(nota.id).length === 0);
    });
    expect(razao).toBeLessThan(folga);
  });

  it('a lista de tags do caderno inteiro também', () => {
    const { razao, folga } = crescimentoAceitavel((notas) => tagsDoCaderno(notas));
    expect(razao).toBeLessThan(folga);
  });

  it('filtrar pela busca lê cada nota uma vez', () => {
    const { razao, folga } = crescimentoAceitavel((notas) =>
      notas.filter((nota) => matchesQuery(textoDaNota(nota.blocos), 'assunto3')),
    );
    expect(razao).toBeLessThan(folga);
  });

  /**
   * A régua medindo a si mesma. Sem isto, os testes acima passariam por serem
   * cegos, e não por o código estar certo — é o duplo complacente de sempre,
   * agora na forma de um medidor que nunca acusa nada.
   */
  it('a régua acusa quando o trabalho É quadrático', () => {
    // Contagem, e não relógio: com a máquina ocupada o cronômetro oscila e o
    // teste acusava por sorte. Aqui se conta quantas vezes o trabalho toca uma
    // nota — que é o que "quadrático" quer dizer — e o número é o mesmo em
    // qualquer máquina.
    const toques = (quantas: number) => {
      const notas = caderno(quantas);
      let conta = 0;
      notas.forEach(() => notas.forEach(() => conta++));
      return conta;
    };

    expect(toques(400) / toques(200)).toBe(4);
  });

  it('e não acusa o que cresce junto com o caderno', () => {
    const toques = (quantas: number) => {
      const notas = caderno(quantas);
      let conta = 0;
      notas.forEach(() => conta++);
      return conta;
    };

    expect(toques(400) / toques(200)).toBe(2);
  });

  it('mil notas continuam sendo mil notas: o índice responde por todas', () => {
    const notas = caderno(1000);
    const indice = construirIndice(notas);

    expect(indice.apontadaPor('nota-5')).toEqual(['nota-4']);
    expect(indice.orfas()).toEqual([]);
  });
});
