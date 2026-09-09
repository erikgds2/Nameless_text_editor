import { describe, expect, it } from 'vitest';
// @ts-expect-error — módulo CommonJS sem tipos, de propósito: é código do main
import { boundsVisiveis, cortarLog, linhaDeErro } from './geometria.cjs';

const MONITOR = { workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
const SEGUNDO = { workArea: { x: 1920, y: 0, width: 1920, height: 1040 } };

describe('boundsVisiveis', () => {
  it('janela dentro da tela é aceita como está', () => {
    const bounds = { x: 100, y: 80, width: 1100, height: 720 };
    expect(boundsVisiveis(bounds, [MONITOR])).toEqual(bounds);
  });

  it('janela no monitor que foi desligado não volta', () => {
    const bounds = { x: 2200, y: 100, width: 1100, height: 720 };
    expect(boundsVisiveis(bounds, [MONITOR])).toBeNull();
    expect(boundsVisiveis(bounds, [MONITOR, SEGUNDO])).toEqual(bounds);
  });

  it('janela quase toda fora da tela não volta: sem barra não há como trazê-la', () => {
    expect(boundsVisiveis({ x: -1080, y: 100, width: 1100, height: 720 }, [MONITOR])).toBeNull();
    expect(boundsVisiveis({ x: 100, y: 1030, width: 1100, height: 720 }, [MONITOR])).toBeNull();
  });

  it('tamanho menor que o mínimo da janela é descartado', () => {
    expect(boundsVisiveis({ x: 0, y: 0, width: 300, height: 200 }, [MONITOR])).toBeNull();
  });

  it('config estragada não derruba a abertura', () => {
    expect(boundsVisiveis(null, [MONITOR])).toBeNull();
    expect(boundsVisiveis({ x: 'a', y: 0, width: 1100, height: 720 }, [MONITOR])).toBeNull();
    expect(boundsVisiveis({ x: 0, y: 0, width: Number.NaN, height: 720 }, [MONITOR])).toBeNull();
  });

  it('sem monitor nenhum, não há posição que sirva', () => {
    expect(boundsVisiveis({ x: 0, y: 0, width: 1100, height: 720 }, [])).toBeNull();
  });
});

describe('cortarLog', () => {
  it('guarda só o fim do arquivo', () => {
    const cheio = Array.from({ length: 600 }, (_, i) => `linha ${i}`).join('\n');
    const cortado = cortarLog(cheio, 500).split('\n').filter(Boolean);

    expect(cortado).toHaveLength(500);
    expect(cortado[0]).toBe('linha 100');
    expect(cortado.at(-1)).toBe('linha 599');
  });

  it('arquivo pequeno passa inteiro', () => {
    expect(cortarLog('um\ndois\n', 500)).toBe('um\ndois\n');
  });

  it('arquivo vazio continua vazio, sem linha fantasma', () => {
    expect(cortarLog('', 500)).toBe('');
  });
});

describe('linhaDeErro', () => {
  it('quando, de onde e o quê, em uma linha só', () => {
    const linha = linhaDeErro(new Date('2026-09-09T12:00:00Z'), 'janela', 'deu ruim');
    expect(linha).toBe('2026-09-09T12:00:00.000Z [janela] deu ruim');
  });

  it('erro com várias linhas não quebra o registro em várias entradas', () => {
    const linha = linhaDeErro(new Date(), 'main', 'Error: falhou\n  at algumaCoisa\n  at outra');
    expect(linha.split('\n')).toHaveLength(1);
  });

  it('mensagem gigante é cortada: log não é despejo de memória', () => {
    expect(linhaDeErro(new Date(), 'main', 'x'.repeat(5000)).length).toBeLessThan(600);
  });
});
