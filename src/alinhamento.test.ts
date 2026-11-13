import { describe, expect, it } from 'vitest';
import { calcularAlinhamento, type Caixa } from './alinhamento';

describe('calcularAlinhamento', () => {
  const vizinho: Caixa = { id: 'v1', x: 100, y: 100, largura: 200, altura: 100 };

  it('alinha borda esquerda com borda esquerda vizinha dentro da tolerancia', () => {
    const alvo: Caixa = { id: 'a1', x: 103, y: 300, largura: 150, altura: 80 };
    const resultado = calcularAlinhamento(alvo, [vizinho]);
    expect(resultado.x).toBe(100);
    expect(resultado.guias).toContainEqual({ orientacao: 'vertical', posicao: 100 });
  });

  it('alinha borda direita com borda direita vizinha dentro da tolerancia', () => {
    // vizinho x2 = 300. Alvo x = 148, largura = 150 -> alvo x2 = 298 (diff = 2)
    const alvo: Caixa = { id: 'a1', x: 148, y: 300, largura: 150, altura: 80 };
    const resultado = calcularAlinhamento(alvo, [vizinho]);
    expect(resultado.x).toBe(150); // 300 - 150
    expect(resultado.guias).toContainEqual({ orientacao: 'vertical', posicao: 300 });
  });

  it('alinha topo com topo vizinho dentro da tolerancia', () => {
    const alvo: Caixa = { id: 'a1', x: 400, y: 104, largura: 150, altura: 80 };
    const resultado = calcularAlinhamento(alvo, [vizinho]);
    expect(resultado.y).toBe(100);
    expect(resultado.guias).toContainEqual({ orientacao: 'horizontal', posicao: 100 });
  });

  it('alinha base com base vizinha dentro da tolerancia', () => {
    // vizinho y2 = 200. Alvo y = 118, altura = 80 -> alvo y2 = 198 (diff = 2)
    const alvo: Caixa = { id: 'a1', x: 400, y: 118, largura: 150, altura: 80 };
    const resultado = calcularAlinhamento(alvo, [vizinho]);
    expect(resultado.y).toBe(120); // 200 - 80
    expect(resultado.guias).toContainEqual({ orientacao: 'horizontal', posicao: 200 });
  });

  it('ignora o proprio bloco alvo na lista de vizinhos', () => {
    const alvo: Caixa = { id: 'v1', x: 103, y: 103, largura: 200, altura: 100 };
    const resultado = calcularAlinhamento(alvo, [vizinho]);
    expect(resultado.x).toBe(103);
    expect(resultado.y).toBe(103);
    expect(resultado.guias).toHaveLength(0);
  });

  it('nao altera posicao se estiver fora da tolerancia', () => {
    const alvo: Caixa = { id: 'a1', x: 160, y: 250, largura: 120, altura: 80 };
    const resultado = calcularAlinhamento(alvo, [vizinho]);
    expect(resultado.x).toBe(160);
    expect(resultado.y).toBe(250);
    expect(resultado.guias).toHaveLength(0);
  });
});
