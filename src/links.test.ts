import { describe, expect, it } from 'vitest';
import { construirIndice, extrairLigacoes, renomearLigacoes } from './links';
import { createNote, type Note } from './notes';
import { criarBloco } from './canvas';

function nota(texto: string, extras: Partial<Note> = {}): Note {
  const base = createNote();
  return {
    ...base,
    id: extras.id ?? base.id,
    blocos: [{ ...criarBloco(48, 48), texto }],
    ...extras,
  };
}

describe('extrairLigacoes', () => {
  it('acha o alvo e as posições exatas no texto', () => {
    const texto = 'ver [[Kant]] depois';
    const [ligacao] = extrairLigacoes(texto);
    expect(ligacao.alvo).toBe('Kant');
    expect(texto.slice(ligacao.inicio, ligacao.fim)).toBe('[[Kant]]');
  });

  it('apara os espaços das pontas do alvo', () => {
    expect(extrairLigacoes('[[  Kant  ]]')[0].alvo).toBe('Kant');
  });

  it('duas na mesma linha saem na ordem em que aparecem', () => {
    expect(extrairLigacoes('[[a]] e [[b]]').map((l) => l.alvo)).toEqual(['a', 'b']);
  });

  it('ligação vazia não é ligação', () => {
    expect(extrairLigacoes('[[]] e [[   ]]')).toEqual([]);
  });

  it('colchete sem fechamento não vira ligação nem trava o parser', () => {
    expect(extrairLigacoes('[[sem fim e mais texto')).toEqual([]);
  });

  it('dentro de bloco de código é texto literal', () => {
    expect(extrairLigacoes('```\n[[Kant]]\n```')).toEqual([]);
  });

  it('dentro de código inline também é texto literal', () => {
    expect(extrairLigacoes('use `[[Kant]]` para citar')).toEqual([]);
  });

  it('depois que a cerca fecha, volta a valer', () => {
    expect(extrairLigacoes('```\n[[dentro]]\n```\n[[fora]]').map((l) => l.alvo)).toEqual(['fora']);
  });

  it('aceita acento, espaço e pontuação no alvo', () => {
    expect(extrairLigacoes('[[Revisão de Cálculo I]]')[0].alvo).toBe('Revisão de Cálculo I');
  });

  it('texto vazio ou sem ligação devolve lista vazia', () => {
    expect(extrairLigacoes('')).toEqual([]);
    expect(extrairLigacoes('nenhuma citação aqui')).toEqual([]);
  });

  it('as posições continuam certas depois de várias linhas', () => {
    const texto = 'primeira linha\nsegunda\nver [[Kant]] aqui';
    const [ligacao] = extrairLigacoes(texto);
    expect(texto.slice(ligacao.inicio, ligacao.fim)).toBe('[[Kant]]');
  });
});

describe('construirIndice', () => {
  it('resolve o alvo pelo título, ignorando acento e caixa', () => {
    const kant = nota('Imperativo Categórico\ncorpo', { id: 'kant' });
    const indice = construirIndice([kant, nota('cita [[imperativo categorico]]', { id: 'outra' })]);
    expect(indice.resolver('IMPERATIVO CATEGORICO')).toBe('kant');
    expect(indice.apontaPara('outra')).toEqual(['kant']);
  });

  it('backlink: quem cita aparece do outro lado', () => {
    const alvo = nota('Kant', { id: 'alvo' });
    const origem = nota('ler [[Kant]] hoje', { id: 'origem' });
    const indice = construirIndice([alvo, origem]);
    expect(indice.apontadaPor('alvo')).toEqual(['origem']);
  });

  it('citar três vezes conta uma vez só', () => {
    const alvo = nota('Kant', { id: 'alvo' });
    const origem = nota('[[Kant]] e [[Kant]] e de novo [[Kant]]', { id: 'origem' });
    const indice = construirIndice([alvo, origem]);
    expect(indice.apontaPara('origem')).toEqual(['alvo']);
    expect(indice.apontadaPor('alvo')).toEqual(['origem']);
  });

  it('nota que cita a si mesma não vira backlink de si mesma', () => {
    const sozinha = nota('Kant\nfalo de [[Kant]]', { id: 'kant' });
    const indice = construirIndice([sozinha]);
    expect(indice.apontadaPor('kant')).toEqual([]);
    expect(indice.orfas()).toContain('kant');
  });

  it('títulos repetidos: vence a nota editada mais recentemente', () => {
    const velha = nota('Kant\nversão antiga', { id: 'velha', updatedAt: 1000 });
    const nova = nota('Kant\nversão nova', { id: 'nova', updatedAt: 2000 });
    const indice = construirIndice([velha, nova, nota('[[Kant]]', { id: 'origem' })]);
    expect(indice.resolver('Kant')).toBe('nova');
  });

  it('ligação para nota inexistente entra em quebradas', () => {
    const indice = construirIndice([nota('cita [[Fantasma]]', { id: 'origem' })]);
    expect(indice.quebradas()).toEqual([{ origem: 'origem', alvo: 'Fantasma' }]);
    expect(indice.apontaPara('origem')).toEqual([]);
  });

  it('órfã é a nota que ninguém cita', () => {
    const citada = nota('Kant', { id: 'citada' });
    const origem = nota('Hume\nver [[Kant]]', { id: 'origem' });
    const indice = construirIndice([citada, origem]);
    expect(indice.orfas()).toEqual(['origem']);
  });

  it('id desconhecido devolve lista vazia, não quebra', () => {
    const indice = construirIndice([]);
    expect(indice.apontaPara('nao-existe')).toEqual([]);
    expect(indice.apontadaPor('nao-existe')).toEqual([]);
    expect(indice.resolver('nada')).toBeNull();
  });

  it('nota sem título nenhum ainda é resolvível pelo rótulo padrão', () => {
    const vazia = nota('', { id: 'vazia' });
    expect(construirIndice([vazia]).resolver('Nota sem título')).toBe('vazia');
  });

  it('aguenta mil notas sem ficar lento', () => {
    const notas = Array.from({ length: 1000 }, (_, i) =>
      nota(`Nota ${i}\nver [[Nota ${(i + 1) % 1000}]]`, { id: `n${i}` }),
    );
    const comeco = performance.now();
    const indice = construirIndice(notas);
    for (const n of notas) indice.apontadaPor(n.id);
    expect(performance.now() - comeco).toBeLessThan(1000);
    expect(indice.apontadaPor('n500')).toEqual(['n499']);
  });
});

describe('renomearLigacoes', () => {
  it('troca a ligação e não encosta no resto do texto', () => {
    expect(renomearLigacoes('antes [[Kant]] depois', 'Kant', 'Immanuel Kant')).toBe(
      'antes [[Immanuel Kant]] depois',
    );
  });

  it('casa ignorando acento e caixa', () => {
    expect(renomearLigacoes('[[imperativo categorico]]', 'Imperativo Categórico', 'IC')).toBe(
      '[[IC]]',
    );
  });

  it('não troca ligação que só contém o nome como parte', () => {
    expect(renomearLigacoes('[[de outro jeito]]', 'de', 'para')).toBe('[[de outro jeito]]');
  });

  it('troca todas as ocorrências', () => {
    expect(renomearLigacoes('[[a]] x [[a]]', 'a', 'b')).toBe('[[b]] x [[b]]');
  });

  it('não mexe dentro de bloco de código', () => {
    const texto = '```\n[[Kant]]\n```\n[[Kant]]';
    expect(renomearLigacoes(texto, 'Kant', 'Hume')).toBe('```\n[[Kant]]\n```\n[[Hume]]');
  });

  it('texto sem a ligação sai intacto', () => {
    expect(renomearLigacoes('nada aqui', 'Kant', 'Hume')).toBe('nada aqui');
    expect(renomearLigacoes('', 'Kant', 'Hume')).toBe('');
  });

  it('preserva acentuação e emoji ao redor', () => {
    expect(renomearLigacoes('ação 🎯 [[Kant]] ímã', 'Kant', 'Hume')).toBe('ação 🎯 [[Hume]] ímã');
  });
});
