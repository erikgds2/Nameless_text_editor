import { describe, expect, it, beforeEach } from 'vitest';
import { TEMAS, carregarTema, salvarTema } from './theme';

beforeEach(() => localStorage.clear());

describe('temas', () => {
  it('oferece exatamente os três temas do DESIGN.md', () => {
    expect(TEMAS.map((t) => t.id)).toEqual(['acrilico', 'papel', 'tinta']);
  });

  it('cada tema tem um rótulo legível', () => {
    for (const tema of TEMAS) expect(tema.rotulo.length).toBeGreaterThan(2);
  });

  it('começa no acrílico quando nada foi escolhido', () => {
    expect(carregarTema()).toBe('acrilico');
  });

  it('lembra a escolha', () => {
    salvarTema('tinta');
    expect(carregarTema()).toBe('tinta');
  });

  it('ignora valor inválido guardado no storage', () => {
    localStorage.setItem('editor-sem-nome:tema', 'neon-roxo');
    expect(carregarTema()).toBe('acrilico');
  });
});
