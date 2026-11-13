import { describe, expect, it } from 'vitest';
import { escapar, escaparAtributo, normalizarLinguagem, parseInline } from './inline';

describe('inline parser', () => {
  it('escapa caracteres especiais de HTML', () => {
    expect(escapar('<b>&"\'</b>')).toBe('&lt;b&gt;&amp;"\'&lt;/b&gt;');
    expect(escaparAtributo('val"ue')).toBe('val&quot;ue');
  });

  it('normaliza linguagens validas', () => {
    expect(normalizarLinguagem('TypeScript')).toBe('typescript');
    expect(normalizarLinguagem('c++')).toBe('c++');
    expect(normalizarLinguagem('linguagem-muito-longa-invalida-demais')).toBeNull();
  });

  it('faz parse de texto puro', () => {
    expect(parseInline('texto simples')).toEqual([{ tipo: 'texto', valor: 'texto simples' }]);
  });

  it('faz parse de negrito, enfase, codigo e riscado', () => {
    const segmentos = parseInline('**forte** *enfase* `codigo` ~~riscado~~');
    expect(segmentos).toEqual([
      { tipo: 'forte', filhos: [{ tipo: 'texto', valor: 'forte' }] },
      { tipo: 'texto', valor: ' ' },
      { tipo: 'enfase', marcador: '*', filhos: [{ tipo: 'texto', valor: 'enfase' }] },
      { tipo: 'texto', valor: ' ' },
      { tipo: 'codigo', conteudo: 'codigo' },
      { tipo: 'texto', valor: ' ' },
      { tipo: 'riscado', filhos: [{ tipo: 'texto', valor: 'riscado' }] },
    ]);
  });

  it('faz parse de grifo (marca-texto ==texto==)', () => {
    const segmentos = parseInline('veja ==este grifo== aqui');
    expect(segmentos).toEqual([
      { tipo: 'texto', valor: 'veja ' },
      { tipo: 'grifo', filhos: [{ tipo: 'texto', valor: 'este grifo' }] },
      { tipo: 'texto', valor: ' aqui' },
    ]);
  });

  it('faz parse de links e ligacoes entre notas [[Nota]]', () => {
    const segmentos = parseInline('[site](https://example.com) e [[Minha Nota]]');
    expect(segmentos).toEqual([
      { tipo: 'link', texto: 'site', url: 'https://example.com' },
      { tipo: 'texto', valor: ' e ' },
      { tipo: 'ligacao', alvo: 'Minha Nota', bruto: 'Minha Nota' },
    ]);
  });
});
