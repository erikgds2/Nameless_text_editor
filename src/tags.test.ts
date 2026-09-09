import { describe, expect, it } from 'vitest';
import { extrairTags, notasComTag, tagsDoCaderno } from './tags';
import { createNote, type Note } from './notes';
import { criarBloco } from './canvas';

function nota(id: string, ...textos: string[]): Note {
  const base = createNote();
  return {
    ...base,
    id,
    blocos: textos.map((texto, i) => ({ ...criarBloco(48, i * 200), texto })),
  };
}

describe('extrairTags', () => {
  it('acha a tag no meio da frase', () => {
    expect(extrairTags('revisar isto #anatomia amanhã')).toEqual(['anatomia']);
  });

  it('cabeçalho de Markdown não é tag', () => {
    expect(extrairTags('# Anatomia')).toEqual([]);
    expect(extrairTags('### Colo cirúrgico')).toEqual([]);
    expect(extrairTags('   ## Indentado')).toEqual([]);
  });

  it('cabeçalho na primeira linha e tag na segunda convivem', () => {
    expect(extrairTags('# Aula de hoje\nrever #femur')).toEqual(['femur']);
  });

  it('a tag guarda o acento de quem escreveu', () => {
    expect(extrairTags('#revisão pendente')).toEqual(['revisão']);
  });

  it('não repete a mesma tag, nem por acento ou caixa', () => {
    expect(extrairTags('#Anatomia e #anatomia e #ANATOMIA')).toEqual(['Anatomia']);
    expect(extrairTags('#revisao e #revisão')).toEqual(['revisao']);
  });

  it('dentro de código não há tag nenhuma', () => {
    expect(extrairTags('```\n#include <stdio.h>\n```')).toEqual([]);
    expect(extrairTags('use `#define` aqui')).toEqual([]);
  });

  it('`#` colado no fim de uma palavra não abre tag', () => {
    expect(extrairTags('nota#2 e cor#fff')).toEqual([]);
  });

  it('`#` sozinho não é tag', () => {
    expect(extrairTags('só um # solto')).toEqual([]);
    expect(extrairTags('##')).toEqual([]);
  });

  it('várias tags na mesma linha, na ordem em que aparecem', () => {
    expect(extrairTags('estudar #anatomia #femur #prova')).toEqual(['anatomia', 'femur', 'prova']);
  });
});

describe('notasComTag', () => {
  const notas = [
    nota('a', '# Aula\nrever #anatomia'),
    nota('b', '# Outra\nsem marca nenhuma'),
    nota('c', 'nada aqui', 'no segundo bloco: #Anatomia'),
  ];

  it('acha em qualquer bloco da página, e sem ligar para a caixa', () => {
    expect(notasComTag(notas, 'anatomia').map((n) => n.id)).toEqual(['a', 'c']);
  });

  it('tag que ninguém usa não devolve nada', () => {
    expect(notasComTag(notas, 'kant')).toEqual([]);
  });
});

describe('tagsDoCaderno', () => {
  it('da mais usada para a menos usada', () => {
    const notas = [nota('a', 'x #prova #anatomia'), nota('b', 'y #prova'), nota('c', 'z #prova')];
    expect(tagsDoCaderno(notas)).toEqual([
      { tag: 'prova', quantas: 3 },
      { tag: 'anatomia', quantas: 1 },
    ]);
  });

  it('empate resolve em ordem alfabética: a lista não pode dançar a cada tecla', () => {
    const notas = [nota('a', 'x #zebra #acido')];
    expect(tagsDoCaderno(notas).map((t) => t.tag)).toEqual(['acido', 'zebra']);
  });

  it('caderno sem tags devolve lista vazia', () => {
    expect(tagsDoCaderno([nota('a', '# Só um título')])).toEqual([]);
  });

  it('a mesma tag duas vezes na mesma nota conta uma vez', () => {
    expect(tagsDoCaderno([nota('a', '#prova e de novo #prova')])).toEqual([
      { tag: 'prova', quantas: 1 },
    ]);
  });
});
