import { describe, expect, it } from 'vitest';
import { aoTeclarEnter, aoTeclarTab, alternarMarca, inserirLink } from './edicao';
import type { Estado } from './edicao';

/**
 * Lê um modelo com `|` marcando o cursor (ou dois `|` marcando uma seleção)
 * e devolve o Estado correspondente. Ex.: `montar('- item|')`,
 * `montar('- |item|s')`.
 */
function montar(modelo: string): Estado {
  const primeiro = modelo.indexOf('|');
  if (primeiro === -1) {
    return { texto: modelo, inicio: 0, fim: 0 };
  }

  const segundo = modelo.indexOf('|', primeiro + 1);
  if (segundo === -1) {
    const texto = modelo.slice(0, primeiro) + modelo.slice(primeiro + 1);
    return { texto, inicio: primeiro, fim: primeiro };
  }

  const texto = modelo.slice(0, primeiro) + modelo.slice(primeiro + 1, segundo) + modelo.slice(segundo + 1);
  return { texto, inicio: primeiro, fim: segundo - 1 };
}

/** Inverso de `montar`: devolve o texto com `|` no lugar do cursor/seleção. */
function marcar(estado: Estado): string {
  const { texto, inicio, fim } = estado;
  if (inicio === fim) {
    return `${texto.slice(0, inicio)}|${texto.slice(inicio)}`;
  }
  return `${texto.slice(0, inicio)}|${texto.slice(inicio, fim)}|${texto.slice(fim)}`;
}

describe('montar/marcar (helper dos testes)', () => {
  it('reconhece cursor único', () => {
    const estado = montar('- item|');
    expect(estado).toEqual({ texto: '- item', inicio: 6, fim: 6 });
    expect(marcar(estado)).toBe('- item|');
  });

  it('reconhece seleção com dois marcadores', () => {
    const estado = montar('- |item|s');
    expect(estado).toEqual({ texto: '- items', inicio: 2, fim: 6 });
    expect(marcar(estado)).toBe('- |item|s');
  });
});

describe('aoTeclarEnter', () => {
  it('continua lista com marcador -', () => {
    const resultado = aoTeclarEnter(montar('- item|'));
    expect(marcar(resultado!)).toBe('- item\n- |');
  });

  it('continua lista com marcador *', () => {
    const resultado = aoTeclarEnter(montar('* item|'));
    expect(marcar(resultado!)).toBe('* item\n* |');
  });

  it('continua lista com marcador +', () => {
    const resultado = aoTeclarEnter(montar('+ item|'));
    expect(marcar(resultado!)).toBe('+ item\n+ |');
  });

  it('incrementa lista numerada', () => {
    const resultado = aoTeclarEnter(montar('1. item|'));
    expect(marcar(resultado!)).toBe('1. item\n2. |');
  });

  it('incrementa lista numerada partindo de outro número', () => {
    const resultado = aoTeclarEnter(montar('7. item|'));
    expect(marcar(resultado!)).toBe('7. item\n8. |');
  });

  it('incrementa lista numerada de dois dígitos', () => {
    const resultado = aoTeclarEnter(montar('10. item|'));
    expect(marcar(resultado!)).toBe('10. item\n11. |');
  });

  it('continua citação', () => {
    const resultado = aoTeclarEnter(montar('> citação|'));
    expect(marcar(resultado!)).toBe('> citação\n> |');
  });

  it('tarefa nova nasce sempre desmarcada, vindo de tarefa desmarcada', () => {
    const resultado = aoTeclarEnter(montar('- [ ] tarefa|'));
    expect(marcar(resultado!)).toBe('- [ ] tarefa\n- [ ] |');
  });

  it('tarefa nova nasce sempre desmarcada, mesmo vindo de tarefa marcada', () => {
    const resultado = aoTeclarEnter(montar('- [x] tarefa|'));
    expect(marcar(resultado!)).toBe('- [x] tarefa\n- [ ] |');
  });

  it('preserva a indentação do item', () => {
    const resultado = aoTeclarEnter(montar('  - item|'));
    expect(marcar(resultado!)).toBe('  - item\n  - |');
  });

  it('item vazio encerra a lista', () => {
    const resultado = aoTeclarEnter(montar('- |'));
    expect(marcar(resultado!)).toBe('|');
  });

  it('item vazio indentado encerra a lista preservando as demais linhas', () => {
    const resultado = aoTeclarEnter(montar('primeiro\n  - |\nterceiro'));
    expect(marcar(resultado!)).toBe('primeiro\n|\nterceiro');
  });

  it('lista numerada vazia encerra a lista', () => {
    const resultado = aoTeclarEnter(montar('1. |'));
    expect(marcar(resultado!)).toBe('|');
  });

  it('citação vazia encerra a citação', () => {
    const resultado = aoTeclarEnter(montar('> |'));
    expect(marcar(resultado!)).toBe('|');
  });

  it('devolve null quando há texto selecionado', () => {
    expect(aoTeclarEnter(montar('- |ite|m'))).toBeNull();
  });

  it('devolve null em texto vazio', () => {
    expect(aoTeclarEnter(montar('|'))).toBeNull();
  });

  it('devolve null com o cursor na posição 0 de uma linha comum', () => {
    expect(aoTeclarEnter(montar('|abc'))).toBeNull();
  });

  it('devolve null com o cursor no meio da linha', () => {
    expect(aoTeclarEnter(montar('- it|em'))).toBeNull();
  });

  it('devolve null quando a linha é um "-" sem espaço (não é lista)', () => {
    expect(aoTeclarEnter(montar('-|'))).toBeNull();
  });
});

describe('aoTeclarTab', () => {
  it('indenta o cursor numa linha de lista', () => {
    const resultado = aoTeclarTab(montar('- item|'), false);
    expect(marcar(resultado!)).toBe('  - item|');
  });

  it('recua o cursor numa linha de lista indentada', () => {
    const resultado = aoTeclarTab(montar('  - item|'), true);
    expect(marcar(resultado!)).toBe('- item|');
  });

  it('recuar nunca remove mais espaços do que existem', () => {
    const resultado = aoTeclarTab(montar(' - item|'), true);
    expect(marcar(resultado!)).toBe('- item|');
  });

  it('indenta todas as linhas tocadas por uma seleção multi-linha', () => {
    const resultado = aoTeclarTab(montar('- |um\n- do|is'), false);
    expect(marcar(resultado!)).toBe('  - |um\n  - do|is');
  });

  it('recua todas as linhas tocadas por uma seleção multi-linha', () => {
    const resultado = aoTeclarTab(montar('  - |um\n  - do|is'), true);
    expect(marcar(resultado!)).toBe('- |um\n- do|is');
  });

  it('indenta com seleção que começa no meio de uma linha', () => {
    const resultado = aoTeclarTab(montar('ab|cd\nef|gh'), false);
    expect(marcar(resultado!)).toBe('  ab|cd\n  ef|gh');
  });

  it('devolve null com o cursor numa linha que não é lista e sem seleção', () => {
    expect(aoTeclarTab(montar('texto normal|'), false)).toBeNull();
  });
});

describe('alternarMarca', () => {
  it('envolve a seleção em negrito', () => {
    const resultado = alternarMarca(montar('- |item|'), '**');
    expect(resultado.texto).toBe('- **item**');
    expect(marcar(resultado)).toBe('- **|item|**');
  });

  it('remove negrito quando a seleção já está envolvida por ele', () => {
    const resultado = alternarMarca(montar('- **|item|**'), '**');
    expect(marcar(resultado)).toBe('- |item|');
  });

  it('envolve a seleção em ênfase', () => {
    const resultado = alternarMarca(montar('|item|'), '*');
    expect(resultado.texto).toBe('*item*');
    expect(marcar(resultado)).toBe('*|item|*');
  });

  it('remove ênfase quando a seleção já está envolvida por ela', () => {
    const resultado = alternarMarca(montar('*|item|*'), '*');
    expect(marcar(resultado)).toBe('|item|');
  });

  it('envolve a seleção em código', () => {
    const resultado = alternarMarca(montar('|item|'), '`');
    expect(resultado.texto).toBe('`item`');
    expect(marcar(resultado)).toBe('`|item|`');
  });

  it('envolve a seleção em riscado e remove ao alternar de novo', () => {
    const envolvido = alternarMarca(montar('|item|'), '~~');
    expect(envolvido.texto).toBe('~~item~~');
    const removido = alternarMarca(montar(marcar(envolvido)), '~~');
    expect(marcar(removido)).toBe('|item|');
  });

  it('sem seleção, insere as marcas e põe o cursor no meio', () => {
    const resultado = alternarMarca(montar('abc|'), '**');
    expect(marcar(resultado)).toBe('abc**|**');
  });

  it('sem seleção no fim do texto (seleção de tamanho zero)', () => {
    const resultado = alternarMarca(montar('|'), '`');
    expect(resultado.texto).toBe('``');
    expect(marcar(resultado)).toBe('`|`');
  });

  it('não corrompe o texto fora da seleção', () => {
    const resultado = alternarMarca(montar('antes |meio| depois'), '**');
    expect(resultado.texto).toBe('antes **meio** depois');
  });

  it('preserva acentuação e emoji ao envolver a seleção', () => {
    const resultado = alternarMarca(montar('café |atenção 🎉| fim'), '**');
    expect(resultado.texto).toBe('café **atenção 🎉** fim');
    expect(marcar(resultado)).toBe('café **|atenção 🎉|** fim');
  });
});

describe('inserirLink', () => {
  it('com seleção, envolve o texto selecionado e põe o cursor no fim', () => {
    const resultado = inserirLink(montar('veja |isto|'), 'https://exemplo.com');
    expect(resultado.texto).toBe('veja [isto](https://exemplo.com)');
    expect(marcar(resultado)).toBe('veja [isto](https://exemplo.com)|');
  });

  it('sem seleção, insere colchetes vazios e põe o cursor entre eles', () => {
    const resultado = inserirLink(montar('veja |'), 'https://exemplo.com');
    expect(resultado.texto).toBe('veja [](https://exemplo.com)');
    expect(marcar(resultado)).toBe('veja [|](https://exemplo.com)');
  });
});
