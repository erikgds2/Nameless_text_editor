import { describe, expect, it } from 'vitest';
import { desserializar, serializar } from './formato';
import { criarBloco } from './canvas';
import type { Note } from './notes';

function nota(parcial: Partial<Note> = {}): Note {
  return {
    id: 'nota-de-teste',
    blocos: [{ ...criarBloco(48, 48), texto: 'Primeira linha' }],
    tipo: 'markdown',
    createdAt: Date.UTC(2026, 8, 7, 22, 3, 11),
    updatedAt: Date.UTC(2026, 8, 7, 22, 40, 0),
    pinned: false,
    ...parcial,
  };
}

describe('serializar', () => {
  it('escreve frontmatter com versao, datas em ISO e o estado de fixada', () => {
    const texto = serializar(nota({ pinned: true }));
    expect(texto).toMatch(/^---\n/);
    expect(texto).toContain('ardosia: 1');
    expect(texto).toContain('criada: 2026-09-07T22:03:11.000Z');
    expect(texto).toContain('atualizada: 2026-09-07T22:40:00.000Z');
    expect(texto).toContain('fixada: true');
  });

  it('precede cada bloco de um marcador com a geometria', () => {
    const texto = serializar(
      nota({ blocos: [{ ...criarBloco(48, 48), largura: 320, altura: 120, texto: 'Corpo' }] }),
    );
    expect(texto).toContain('<!-- ardosia:bloco x=48 y=48 w=320 h=120 -->');
  });

  it('ordena os blocos como se le a pagina: de cima para baixo, da esquerda para a direita', () => {
    const texto = serializar(
      nota({
        blocos: [
          { ...criarBloco(400, 300), texto: 'terceiro' },
          { ...criarBloco(400, 40), texto: 'segundo' },
          { ...criarBloco(40, 40), texto: 'primeiro' },
        ],
      }),
    );
    const corpo = texto.slice(texto.lastIndexOf('---\n') + 4);
    expect(corpo.indexOf('primeiro')).toBeLessThan(corpo.indexOf('segundo'));
    expect(corpo.indexOf('segundo')).toBeLessThan(corpo.indexOf('terceiro'));
  });

  it('termina o arquivo com uma unica quebra de linha', () => {
    expect(serializar(nota())).toMatch(/[^\n]\n$/);
  });
});

describe('desserializar', () => {
  it('devolve o id que recebeu, sem procurar no arquivo', () => {
    expect(desserializar('qualquer coisa', 'aula-de-kant').id).toBe('aula-de-kant');
  });

  it('le a geometria do marcador', () => {
    const nota = desserializar(
      '<!-- ardosia:bloco x=420 y=48 w=300 h=200 -->\nCorpo do bloco\n',
      'x',
    );
    expect(nota.blocos).toHaveLength(1);
    expect(nota.blocos[0]).toMatchObject({ x: 420, y: 48, largura: 300, altura: 200, texto: 'Corpo do bloco' });
  });

  it('preserva as quebras de linha internas do bloco e apara as das pontas', () => {
    const nota = desserializar(
      '<!-- ardosia:bloco x=0 y=0 w=320 h=120 -->\n\nlinha um\n\nlinha dois\n\n',
      'x',
    );
    expect(nota.blocos[0].texto).toBe('linha um\n\nlinha dois');
  });

  it('trata um .md escrito a mao, sem marcador nenhum, como um unico bloco', () => {
    const nota = desserializar('# Anotacao no Bloco de Notas\n\nsem marcador algum\n', 'x');
    expect(nota.blocos).toHaveLength(1);
    expect(nota.blocos[0].texto).toBe('# Anotacao no Bloco de Notas\n\nsem marcador algum');
    expect(nota.blocos[0].x).toBeGreaterThanOrEqual(0);
    expect(nota.blocos[0].y).toBeGreaterThanOrEqual(0);
  });

  it('recolhe o texto solto antes do primeiro marcador em seu proprio bloco', () => {
    const nota = desserializar(
      'escrito fora do app\n\n<!-- ardosia:bloco x=48 y=200 w=320 h=120 -->\ndentro\n',
      'x',
    );
    expect(nota.blocos.map((b) => b.texto)).toEqual(['escrito fora do app', 'dentro']);
  });

  it('ignora o frontmatter no corpo e le suas datas', () => {
    const nota = desserializar(
      '---\nardosia: 1\ncriada: 2026-09-07T22:03:11.000Z\natualizada: 2026-09-07T22:40:00.000Z\nfixada: true\n---\n\ncorpo\n',
      'x',
    );
    expect(nota.createdAt).toBe(Date.UTC(2026, 8, 7, 22, 3, 11));
    expect(nota.updatedAt).toBe(Date.UTC(2026, 8, 7, 22, 40, 0));
    expect(nota.pinned).toBe(true);
    expect(nota.blocos[0].texto).toBe('corpo');
  });

  it('le o arquivo como o Bloco de Notas do Windows o salva: CRLF e BOM', () => {
    const comoOWindowsSalva =
      '\ufeff' +
      ['---', 'ardosia: 1', 'fixada: true', '---', '', '<!-- ardosia:bloco x=48 y=48 w=320 h=120 -->', 'primeira linha', '', 'segunda linha', '']
        .join('\r\n');
    const nota = desserializar(comoOWindowsSalva, 'x');
    expect(nota.pinned).toBe(true);
    expect(nota.blocos).toHaveLength(1);
    expect(nota.blocos[0].texto).toBe('primeira linha\n\nsegunda linha');
  });

  it('nunca devolve uma nota sem bloco: arquivo vazio ainda da onde escrever', () => {
    expect(desserializar('', 'x').blocos).toHaveLength(1);
    expect(desserializar('---\nardosia: 1\n---\n', 'x').blocos).toHaveLength(1);
  });

  it('conserta geometria ausente, negativa ou ilegivel em vez de propagar NaN', () => {
    const nota = desserializar('<!-- ardosia:bloco x=-40 y=abc w=10 -->\ncorpo\n', 'x');
    const [bloco] = nota.blocos;
    expect(bloco.x).toBeGreaterThanOrEqual(0);
    expect(bloco.y).toBeGreaterThanOrEqual(0);
    expect(bloco.largura).toBeGreaterThanOrEqual(120);
    expect(bloco.altura).toBeGreaterThanOrEqual(60);
    expect(Object.values(bloco).some((v) => typeof v === 'number' && Number.isNaN(v))).toBe(false);
  });

  it('cai em datas validas quando o frontmatter esta corrompido ou ausente', () => {
    const nota = desserializar('---\ncriada: nao é uma data\n---\ncorpo\n', 'x');
    expect(Number.isFinite(nota.createdAt)).toBe(true);
    expect(Number.isFinite(nota.updatedAt)).toBe(true);
  });

  it('da um id proprio a cada bloco lido', () => {
    const nota = desserializar(
      '<!-- ardosia:bloco x=0 y=0 w=320 h=120 -->\na\n\n<!-- ardosia:bloco x=0 y=200 w=320 h=120 -->\nb\n',
      'x',
    );
    expect(nota.blocos[0].id).not.toBe(nota.blocos[1].id);
  });
});

describe('tipo do documento', () => {
  it('grava o tipo no frontmatter', () => {
    expect(serializar(nota({ tipo: 'texto' }))).toContain('tipo: texto');
    expect(serializar(nota({ tipo: 'markdown' }))).toContain('tipo: markdown');
  });

  it('le o tipo de volta', () => {
    expect(desserializar('---\ntipo: texto\n---\ncorpo\n', 'x').tipo).toBe('texto');
    expect(desserializar('---\ntipo: markdown\n---\ncorpo\n', 'x').tipo).toBe('markdown');
  });

  it('um .md sem tipo declarado e tratado como Markdown', () => {
    expect(desserializar('# so o corpo\n', 'x').tipo).toBe('markdown');
    expect(desserializar('---\nardosia: 1\n---\ncorpo\n', 'x').tipo).toBe('markdown');
  });

  it('tipo desconhecido no arquivo nao vira um tipo invalido', () => {
    expect(desserializar('---\ntipo: planilha\n---\ncorpo\n', 'x').tipo).toBe('markdown');
  });
});

describe('ida e volta', () => {
  it('preserva a nota inteira', () => {
    const original = nota({
      pinned: true,
      blocos: [
        { ...criarBloco(48, 48), largura: 320, altura: 140, texto: '# Título\n\nCorpo com acentuação: ação, ímã.' },
        { ...criarBloco(420, 48), largura: 280, altura: 200, texto: 'Segundo bloco' },
      ],
    });
    const voltou = desserializar(serializar(original), original.id);
    expect(voltou.createdAt).toBe(original.createdAt);
    expect(voltou.updatedAt).toBe(original.updatedAt);
    expect(voltou.pinned).toBe(original.pinned);
    expect(voltou.tipo).toBe(original.tipo);
    expect(voltou.blocos.map(({ id, ...resto }) => resto)).toEqual(
      original.blocos.map(({ id, ...resto }) => resto),
    );
  });

  it('sobrevive a um bloco vazio, que continua existindo depois de reabrir', () => {
    const original = nota({ blocos: [{ ...criarBloco(48, 48), texto: '' }] });
    expect(desserializar(serializar(original), original.id).blocos).toHaveLength(1);
  });
});

describe('a figura é da seção, e não do texto', () => {
  it('a imagem do bloco vai para o marcador e volta de lá', () => {
    const comFoto = nota({
      tipo: 'texto',
      blocos: [{ ...criarBloco(48, 48), texto: 'Anatomia', imagem: { src: 'anexos/abc.png' } }],
    });

    const arquivo = serializar(comFoto);
    expect(arquivo).toContain('img=anexos/abc.png');

    const devolta = desserializar(arquivo, 'x');
    expect(devolta.blocos[0].imagem).toEqual({ src: 'anexos/abc.png' });
    expect(devolta.blocos[0].texto).toBe('Anatomia');
  });

  it('a origem do print viaja junto', () => {
    const comFonte = nota({
      blocos: [
        {
          ...criarBloco(48, 48),
          texto: 'Anatomia',
          imagem: { src: 'anexos/abc.png', fonte: 'https://exemplo.org/femur' },
        },
      ],
    });

    const devolta = desserializar(serializar(comFonte), 'x');
    expect(devolta.blocos[0].imagem).toEqual({
      src: 'anexos/abc.png',
      fonte: 'https://exemplo.org/femur',
    });
  });

  it('funciona em nota de texto puro: é aí que a versão anterior falhava', () => {
    const comFoto = nota({
      tipo: 'texto',
      blocos: [{ ...criarBloco(48, 48), texto: 'só texto', imagem: { src: 'anexos/abc.png' } }],
    });

    const devolta = desserializar(serializar(comFoto), 'x');
    expect(devolta.tipo).toBe('texto');
    expect(devolta.blocos[0].imagem?.src).toBe('anexos/abc.png');
  });

  it('caminho de imagem inválido no arquivo é ignorado, e não vira figura', () => {
    const arquivo = [
      '---',
      'ardosia: 1',
      'tipo: markdown',
      'criada: 2026-09-09T12:00:00.000Z',
      'atualizada: 2026-09-09T12:00:00.000Z',
      'fixada: false',
      '---',
      '',
      '<!-- ardosia:bloco x=0 y=0 w=320 h=120 img=../../segredo.txt -->',
      'texto',
      '',
    ].join('\n');

    expect(desserializar(arquivo, 'x').blocos[0].imagem).toBeUndefined();
  });

  it('nota antiga, com a imagem escrita no texto, migra ao abrir', () => {
    const antiga = [
      '---',
      'ardosia: 1',
      'tipo: markdown',
      'criada: 2026-09-09T12:00:00.000Z',
      'atualizada: 2026-09-09T12:00:00.000Z',
      'fixada: false',
      '---',
      '',
      '<!-- ardosia:bloco x=6 y=252 w=253 h=60 -->',
      'Anatomia',
      '![](anexos/5f9a2ee16114.png)',
      '',
    ].join('\n');

    const bloco = desserializar(antiga, 'x').blocos[0];
    expect(bloco.imagem).toEqual({ src: 'anexos/5f9a2ee16114.png' });
    expect(bloco.texto).toBe('Anatomia');
  });

  it('nota antiga com a imagem e a origem também migra', () => {
    const antiga = [
      '---',
      'ardosia: 1',
      'tipo: markdown',
      'criada: 2026-09-09T12:00:00.000Z',
      'atualizada: 2026-09-09T12:00:00.000Z',
      'fixada: false',
      '---',
      '',
      '<!-- ardosia:bloco x=0 y=0 w=320 h=120 -->',
      '[![](anexos/abc.png)](https://exemplo.org/femur)',
      '',
    ].join('\n');

    expect(desserializar(antiga, 'x').blocos[0].imagem).toEqual({
      src: 'anexos/abc.png',
      fonte: 'https://exemplo.org/femur',
    });
  });
});
