/**
 * A CLI e o aplicativo leem e escrevem o mesmo arquivo por implementações
 * diferentes — TypeScript de um lado, Node puro do outro. Este teste existe
 * para que elas não possam divergir em silêncio: toda nota de exemplo passa
 * pelas duas, e o que sai tem de ser igual.
 */
import { describe, expect, it } from 'vitest';
import { desserializar, serializar } from '../src/formato';
import { textoDaNota } from '../src/canvas';
import { deriveTitle } from '../src/notes';
import {
  blocoNoFim,
  escreverNota,
  lerNota,
  textoDaNota as textoDaNotaCli,
  tituloDaNota,
} from './formato.mjs';

const EXEMPLOS: Record<string, string> = {
  'nota do app, com posições': [
    '---',
    'ardosia: 1',
    'tipo: markdown',
    'criada: 2026-09-01T10:00:00.000Z',
    'atualizada: 2026-09-08T18:30:00.000Z',
    'fixada: false',
    '---',
    '',
    '<!-- ardosia:bloco x=48 y=48 w=320 h=120 -->',
    '# Anatomia do fêmur',
    '',
    '<!-- ardosia:bloco x=400 y=200 w=280 h=160 -->',
    'colo cirúrgico é onde fratura em idoso',
    '',
  ].join('\n'),

  'nota fixada, com ordem': [
    '---',
    'ardosia: 1',
    'tipo: texto',
    'criada: 2026-01-02T03:04:05.000Z',
    'atualizada: 2026-01-02T03:04:05.000Z',
    'fixada: true',
    'ordem: 2',
    '---',
    '',
    '<!-- ardosia:bloco x=10 y=20 w=200 h=90 -->',
    'lista de compras',
    '',
  ].join('\n'),

  'blocos fora de ordem no arquivo': [
    '---',
    'ardosia: 1',
    'tipo: markdown',
    'criada: 2026-05-05T00:00:00.000Z',
    'atualizada: 2026-05-05T00:00:00.000Z',
    'fixada: false',
    '---',
    '',
    '<!-- ardosia:bloco x=48 y=600 w=320 h=120 -->',
    'último na página',
    '',
    '<!-- ardosia:bloco x=48 y=48 w=320 h=120 -->',
    'primeiro na página',
    '',
  ].join('\n'),

  'md solto na pasta, sem frontmatter': '# Vindo do Obsidian\n\num parágrafo qualquer\n',

  'nota com imagem colada': [
    '---',
    'ardosia: 1',
    'tipo: markdown',
    'criada: 2026-09-09T12:00:00.000Z',
    'atualizada: 2026-09-09T12:00:00.000Z',
    'fixada: false',
    '---',
    '',
    '<!-- ardosia:bloco x=48 y=48 w=480 h=270 -->',
    '[![](anexos/abc123.png)](https://exemplo.org/femur)',
    '',
  ].join('\n'),
};

describe('a CLI lê o que o app escreveu', () => {
  for (const [nome, arquivo] of Object.entries(EXEMPLOS)) {
    it(`concorda no conteúdo dos blocos: ${nome}`, () => {
      const doApp = desserializar(arquivo, 'x');
      const daCli = lerNota(arquivo);

      expect(daCli.blocos.map((b: { texto: string }) => b.texto)).toEqual(
        doApp.blocos.map((b) => b.texto),
      );
      expect(daCli.blocos.map((b: { x: number; y: number }) => [b.x, b.y])).toEqual(
        doApp.blocos.map((b) => [b.x, b.y]),
      );
      expect(daCli.blocos.map((b: { largura: number; altura: number }) => [b.largura, b.altura])).toEqual(
        doApp.blocos.map((b) => [b.largura, b.altura]),
      );
    });

    it(`concorda no frontmatter: ${nome}`, () => {
      const doApp = desserializar(arquivo, 'x');
      const daCli = lerNota(arquivo);

      expect(daCli.tipo).toBe(doApp.tipo);
      expect(daCli.fixada).toBe(doApp.pinned);
      expect(daCli.ordem).toBe(doApp.ordem);
      // sem frontmatter as duas usam "agora", que não dá para comparar no relógio
      if (arquivo.startsWith('---')) {
        expect(daCli.criada).toBe(doApp.createdAt);
        expect(daCli.atualizada).toBe(doApp.updatedAt);
      }
    });

    it(`grava o mesmo arquivo que o app gravaria: ${nome}`, () => {
      const doApp = desserializar(arquivo, 'x');
      const daCli = lerNota(arquivo);

      expect(escreverNota(daCli)).toBe(serializar(doApp));
    });

    it(`costura o texto na mesma ordem: ${nome}`, () => {
      const doApp = desserializar(arquivo, 'x');
      expect(textoDaNotaCli(lerNota(arquivo).blocos)).toBe(textoDaNota(doApp.blocos));
    });

    it(`deriva o mesmo título: ${nome}`, () => {
      const texto = textoDaNotaCli(lerNota(arquivo).blocos);
      expect(tituloDaNota(texto)).toBe(deriveTitle(texto));
    });
  }

  it('o arquivo que a CLI escreve continua legível pelo app', () => {
    const daCli = lerNota(EXEMPLOS['nota do app, com posições']);
    daCli.blocos.push(blocoNoFim(daCli.blocos, 'escrito pela linha de comando'));

    const devolta = desserializar(escreverNota(daCli), 'x');
    expect(devolta.blocos.map((b) => b.texto)).toContain('escrito pela linha de comando');
    expect(devolta.blocos).toHaveLength(3);
  });

  it('CRLF e BOM do Windows não viram texto da nota', () => {
    const comLixo = '﻿' + EXEMPLOS['nota do app, com posições'].replace(/\n/g, '\r\n');
    expect(lerNota(comLixo).blocos.map((b: { texto: string }) => b.texto)).toEqual([
      '# Anatomia do fêmur',
      'colo cirúrgico é onde fratura em idoso',
    ]);
  });
});

describe('blocoNoFim', () => {
  it('a página vazia começa onde o app começa', () => {
    expect(blocoNoFim([], 'primeiro')).toMatchObject({ x: 48, y: 48, texto: 'primeiro' });
  });

  it('o bloco novo entra abaixo do mais baixo, alinhado com ele', () => {
    const blocos = [
      { x: 48, y: 48, largura: 320, altura: 120, texto: 'de cima' },
      { x: 400, y: 300, largura: 280, altura: 100, texto: 'o mais baixo' },
    ];
    const novo = blocoNoFim(blocos, 'depois');
    expect(novo.x).toBe(400);
    expect(novo.y).toBeGreaterThan(400);
    expect(novo.largura).toBe(280);
  });
});
