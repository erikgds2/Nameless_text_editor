import { describe, expect, it } from 'vitest';
import {
  ajustarGrifos,
  alternarGrifo,
  grifosDeTexto,
  grifosParaTexto,
  normalizar,
} from './grifo';

describe('alternarGrifo', () => {
  it('grifa o trecho selecionado', () => {
    expect(alternarGrifo([], 4, 9)).toEqual([{ inicio: 4, fim: 9 }]);
  });

  it('selecionar de novo o mesmo trecho tira o grifo', () => {
    expect(alternarGrifo([{ inicio: 4, fim: 9 }], 4, 9)).toEqual([]);
  });

  it('tirar o grifo do meio parte o que sobra em dois', () => {
    expect(alternarGrifo([{ inicio: 0, fim: 20 }], 5, 10)).toEqual([
      { inicio: 0, fim: 5 },
      { inicio: 10, fim: 20 },
    ]);
  });

  it('grifar por cima de um grifo vizinho funde os dois', () => {
    expect(alternarGrifo([{ inicio: 0, fim: 10 }], 8, 20)).toEqual([{ inicio: 0, fim: 20 }]);
  });

  it('trecho que só encosta em outro grifo ainda é grifo novo, e não desgrifo', () => {
    expect(alternarGrifo([{ inicio: 0, fim: 5 }], 3, 12)).toEqual([{ inicio: 0, fim: 12 }]);
  });

  it('sem seleção não há o que grifar', () => {
    const grifos = [{ inicio: 1, fim: 2 }];
    expect(alternarGrifo(grifos, 5, 5)).toBe(grifos);
  });
});

describe('ajustarGrifos: o grifo acompanha o texto', () => {
  it('digitar antes do grifo empurra o grifo para a frente', () => {
    const grifos = [{ inicio: 6, fim: 11 }]; // "mundo" em "Olá, mundo"
    expect(ajustarGrifos(grifos, 'Olá, mundo', 'Olá, belo mundo')).toEqual([
      { inicio: 11, fim: 16 },
    ]);
  });

  it('apagar antes do grifo puxa o grifo para trás', () => {
    expect(ajustarGrifos([{ inicio: 6, fim: 11 }], 'Olá, mundo', 'Olá mundo')).toEqual([
      { inicio: 5, fim: 10 },
    ]);
  });

  it('digitar depois do grifo não mexe nele', () => {
    expect(ajustarGrifos([{ inicio: 0, fim: 3 }], 'Olá', 'Olá, mundo')).toEqual([
      { inicio: 0, fim: 3 },
    ]);
  });

  it('apagar o trecho grifado leva o grifo junto', () => {
    expect(ajustarGrifos([{ inicio: 5, fim: 10 }], 'Olá, mundo', 'Olá, ')).toEqual([]);
  });

  it('texto sem mudança nenhuma devolve os mesmos grifos', () => {
    const grifos = [{ inicio: 0, fim: 3 }];
    expect(ajustarGrifos(grifos, 'Olá', 'Olá')).toBe(grifos);
  });

  it('nota sem grifo não paga nada por isto', () => {
    const vazio: never[] = [];
    expect(ajustarGrifos(vazio, 'a', 'b')).toBe(vazio);
  });
});

describe('ida e volta pelo marcador', () => {
  it('escreve e lê a mesma coisa', () => {
    const grifos = [
      { inicio: 0, fim: 4 },
      { inicio: 10, fim: 15 },
    ];
    expect(grifosParaTexto(grifos)).toBe('0-4,10-15');
    expect(grifosDeTexto('0-4,10-15')).toEqual(grifos);
  });

  it('lixo no arquivo não vira grifo', () => {
    expect(grifosDeTexto('abc,4-2,-,7-9')).toEqual([{ inicio: 7, fim: 9 }]);
  });

  it('normalizar junta o que se sobrepõe e joga fora o vazio', () => {
    expect(
      normalizar([
        { inicio: 10, fim: 20 },
        { inicio: 0, fim: 12 },
        { inicio: 30, fim: 30 },
      ]),
    ).toEqual([{ inicio: 0, fim: 20 }]);
  });
});
