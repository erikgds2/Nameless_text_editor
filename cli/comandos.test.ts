/**
 * A CLI é testada como se fosse chamada por quem vai chamá-la: um processo
 * separado, numa pasta temporária, olhando a saída e o código de saída. É o
 * contrato que um agente enxerga — e nenhum teste de unidade prova que o
 * `process.exit(1)` de fato aconteceu.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const ARDOSIA = path.resolve('cli/ardosia.mjs');
let pasta = '';

/** Roda o comando e devolve o que saiu; erro vira objeto, não exceção. */
function rodar(argumentos: string[], entrada = '') {
  try {
    const saida = execFileSync(process.execPath, [ARDOSIA, ...argumentos], {
      encoding: 'utf8',
      input: entrada,
      env: { ...process.env, ARDOSIA_PASTA: pasta },
    });
    return { codigo: 0, saida: saida.trim(), erro: '' };
  } catch (falha: any) {
    return {
      codigo: falha.status as number,
      saida: String(falha.stdout ?? '').trim(),
      erro: String(falha.stderr ?? '').trim(),
    };
  }
}

const json = (argumentos: string[], entrada = '') => JSON.parse(rodar([...argumentos, '--json'], entrada).saida);

beforeEach(() => {
  pasta = mkdtempSync(path.join(tmpdir(), 'ardosia-cli-'));
});

describe('pasta', () => {
  it('ARDOSIA_PASTA manda em tudo', () => {
    expect(rodar(['pasta']).saida).toBe(pasta);
  });

  it('a pasta é criada se ainda não existir', () => {
    pasta = path.join(pasta, 'caderno-novo');
    expect(rodar(['pasta']).codigo).toBe(0);
    expect(existsSync(pasta)).toBe(true);
  });
});

describe('criar', () => {
  it('o id sai do título, sem acento nem espaço', () => {
    expect(rodar(['criar', 'Aula de Anatomia']).saida).toBe('criada: aula-de-anatomia');
    expect(existsSync(path.join(pasta, 'aula-de-anatomia.md'))).toBe(true);
  });

  it('o mesmo título duas vezes não sobrescreve a primeira nota', () => {
    rodar(['criar', 'Aula']);
    expect(json(['criar', 'Aula']).id).toBe('aula-2');
    expect(readdirSync(pasta).filter((n) => n.endsWith('.md'))).toHaveLength(2);
  });

  it('a nota nasce com o título como primeira linha', () => {
    rodar(['criar', 'Kant e o dever']);
    expect(rodar(['ler', 'kant-e-o-dever']).saida).toBe('Kant e o dever');
  });

  it('sem título, recusa e explica', () => {
    const { codigo, erro } = rodar(['criar']);
    expect(codigo).toBe(1);
    expect(erro).toContain('título');
  });
});

describe('escrever', () => {
  beforeEach(() => rodar(['criar', 'Aula de Anatomia']));

  it('acrescenta o texto ao fim da nota', () => {
    rodar(['escrever', 'aula-de-anatomia', 'colo cirúrgico']);
    expect(rodar(['ler', 'aula-de-anatomia']).saida).toBe('Aula de Anatomia\ncolo cirúrgico');
  });

  it('a nota pode ser dita pelo título, com acento e maiúscula', () => {
    expect(rodar(['escrever', 'Aula de Anatomia', 'mais uma linha']).codigo).toBe(0);
    expect(rodar(['ler', 'aula-de-anatomia']).saida).toContain('mais uma linha');
  });

  it('sem texto no argumento, lê a entrada padrão', () => {
    rodar(['escrever', 'aula-de-anatomia'], 'um parágrafo inteiro\ncom duas linhas');
    expect(rodar(['ler', 'aula-de-anatomia']).saida).toContain('com duas linhas');
  });

  it('cada escrita vira um bloco novo, abaixo do anterior', () => {
    rodar(['escrever', 'aula-de-anatomia', 'primeira']);
    rodar(['escrever', 'aula-de-anatomia', 'segunda']);

    const arquivo = readFileSync(path.join(pasta, 'aula-de-anatomia.md'), 'utf8');
    const marcadores = [...arquivo.matchAll(/ardosia:bloco y?=?/g)];
    expect(marcadores).toHaveLength(3);
    expect(arquivo.indexOf('primeira')).toBeLessThan(arquivo.indexOf('segunda'));
  });

  it('--criar abre a nota quando ela ainda não existe', () => {
    const feito = json(['escrever', 'Notas do dia', 'primeira ideia', '--criar']);
    expect(feito.id).toBe('notas-do-dia');
    expect(rodar(['ler', 'notas-do-dia']).saida).toContain('primeira ideia');
  });

  it('sem --criar, nota inexistente é erro e não cria arquivo nenhum', () => {
    const { codigo, erro } = rodar(['escrever', 'Nota que não existe', 'texto']);
    expect(codigo).toBe(1);
    expect(erro).toContain('não encontrada');
    expect(readdirSync(pasta).filter((n) => n.endsWith('.md'))).toHaveLength(1);
  });

  it('nada para escrever é erro, e não grava um bloco vazio', () => {
    expect(rodar(['escrever', 'aula-de-anatomia']).codigo).toBe(1);
    expect(rodar(['ler', 'aula-de-anatomia']).saida).toBe('Aula de Anatomia');
  });

  it('id que tenta sair da pasta é recusado', () => {
    const { codigo } = rodar(['escrever', '../fora', 'texto']);
    expect(codigo).toBe(1);
    expect(existsSync(path.join(pasta, '..', 'fora.md'))).toBe(false);
  });
});

describe('ler e listar', () => {
  it('ler devolve o Markdown limpo, sem os marcadores de posição', () => {
    rodar(['criar', 'Aula']);
    rodar(['escrever', 'aula', 'segunda linha']);
    const saida = rodar(['ler', 'aula']).saida;

    expect(saida).toBe('Aula\nsegunda linha');
    expect(saida).not.toContain('ardosia:bloco');
  });

  it('listar traz id, título e quando mudou', () => {
    rodar(['criar', 'Aula de Anatomia']);
    const [nota] = json(['listar']);

    expect(nota.id).toBe('aula-de-anatomia');
    expect(nota.titulo).toBe('Aula de Anatomia');
    expect(nota.atualizadaEm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('pasta vazia lista nada, sem falhar', () => {
    const { codigo, saida } = rodar(['listar']);
    expect(codigo).toBe(0);
    expect(saida).toContain('nenhuma nota');
    expect(json(['listar'])).toEqual([]);
  });

  it('um .md solto na pasta também é uma nota', () => {
    writeFileSync(path.join(pasta, 'do-obsidian.md'), '# Vindo de fora\n\ncorpo\n', 'utf8');
    expect(json(['listar'])[0].titulo).toBe('Vindo de fora');
  });
});

describe('buscar', () => {
  beforeEach(() => {
    rodar(['criar', 'Aula de Anatomia']);
    rodar(['escrever', 'aula-de-anatomia', 'o colo cirúrgico do fêmur']);
    rodar(['criar', 'Outra nota']);
  });

  it('acha sem acento o que foi escrito com acento', () => {
    const achados = json(['buscar', 'femur']);
    expect(achados).toHaveLength(1);
    expect(achados[0].id).toBe('aula-de-anatomia');
    expect(achados[0].trecho).toContain('fêmur');
  });

  it('termo que não existe devolve lista vazia, sem erro', () => {
    expect(rodar(['buscar', 'hegel']).codigo).toBe(0);
    expect(json(['buscar', 'hegel'])).toEqual([]);
  });
});

describe('anexar', () => {
  // o menor PNG válido que existe: 1x1 transparente
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );

  beforeEach(() => rodar(['criar', 'Aula']));

  it('a imagem vai para anexos/ e a nota ganha a figura', () => {
    const origem = path.join(pasta, 'grafico.png');
    writeFileSync(origem, PNG);

    const feito = json(['anexar', 'aula', origem]);
    expect(existsSync(path.join(pasta, 'anexos', feito.nome))).toBe(true);
    expect(rodar(['ler', 'aula']).saida).toContain(`![](anexos/${feito.nome})`);
  });

  it('--fonte guarda de onde a imagem veio', () => {
    const origem = path.join(pasta, 'grafico.png');
    writeFileSync(origem, PNG);

    const feito = json(['anexar', 'aula', origem, '--fonte', 'https://exemplo.org/femur']);
    expect(rodar(['ler', 'aula']).saida).toContain(
      `[![](anexos/${feito.nome})](https://exemplo.org/femur)`,
    );
  });

  it('a mesma imagem duas vezes não vira dois arquivos', () => {
    const origem = path.join(pasta, 'grafico.png');
    writeFileSync(origem, PNG);

    json(['anexar', 'aula', origem]);
    json(['anexar', 'aula', origem]);
    expect(readdirSync(path.join(pasta, 'anexos'))).toHaveLength(1);
  });

  it('o que não é imagem é recusado', () => {
    const origem = path.join(pasta, 'programa.exe');
    writeFileSync(origem, PNG);
    expect(rodar(['anexar', 'aula', origem]).codigo).toBe(1);
  });
});

describe('o contrato com quem chama', () => {
  it('comando desconhecido sai com código 1 e mostra a ajuda', () => {
    const { codigo, erro } = rodar(['inventado']);
    expect(codigo).toBe(1);
    expect(erro).toContain('ardosia listar');
  });

  it('sem argumento nenhum, mostra a ajuda e sai bem', () => {
    const { codigo, saida } = rodar([]);
    expect(codigo).toBe(0);
    expect(saida).toContain('ardosia escrever');
  });

  it('--json devolve JSON válido em todo comando que responde algo', () => {
    rodar(['criar', 'Aula']);
    expect(() => json(['listar'])).not.toThrow();
    expect(() => json(['ler', 'aula'])).not.toThrow();
    expect(() => json(['buscar', 'aula'])).not.toThrow();
    expect(() => json(['pasta'])).not.toThrow();
  });
});

describe('gravação segura', () => {
  it('o arquivo temporário não sobra na pasta que o app vigia', () => {
    rodar(['criar', 'Aula']);
    rodar(['escrever', 'aula', 'mais uma linha']);

    expect(readdirSync(pasta).filter((nome) => nome.includes('.escrevendo'))).toEqual([]);
  });

  it('escrever nunca reescreve o que já estava lá', () => {
    rodar(['criar', 'Aula']);
    rodar(['escrever', 'aula', 'primeira']);
    const antes = readFileSync(path.join(pasta, 'aula.md'), 'utf8');

    rodar(['escrever', 'aula', 'segunda']);
    const depois = readFileSync(path.join(pasta, 'aula.md'), 'utf8');

    // tudo o que existia continua existindo, na mesma ordem
    for (const linha of antes.split('\n').filter((l) => l && !l.startsWith('atualizada:'))) {
      expect(depois).toContain(linha);
    }
  });
});
