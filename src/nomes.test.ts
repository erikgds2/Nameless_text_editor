import { describe, expect, it } from 'vitest';
import { nomeDisponivel, slugDeTitulo } from './nomes';

describe('slugDeTitulo', () => {
  it('tira acentos e cedilha para o nome funcionar em qualquer sistema', () => {
    expect(slugDeTitulo('Revisão de Cálculo I — funções')).toBe('revisao-de-calculo-i-funcoes');
  });

  it('descarta o que o Windows nao aceita em nome de arquivo', () => {
    expect(slugDeTitulo(String.raw`a/b\c:d*e?f"g<h>i|j`)).toBe('a-b-c-d-e-f-g-h-i-j');
  });

  it('colapsa separadores e nao deixa hifen sobrando nas pontas', () => {
    expect(slugDeTitulo('  ...trecho   solto!!!  ')).toBe('trecho-solto');
  });

  it('cai num nome generico quando nao sobra nada aproveitavel', () => {
    expect(slugDeTitulo('   ')).toBe('nota');
    expect(slugDeTitulo('¿¡§')).toBe('nota');
  });

  it('corta titulos longos sem terminar em hifen', () => {
    const nome = slugDeTitulo('palavra '.repeat(40));
    expect(nome.length).toBeLessThanOrEqual(60);
    expect(nome.endsWith('-')).toBe(false);
  });

  it('desvia dos nomes que o Windows reserva para dispositivos', () => {
    for (const reservado of ['CON', 'prn', 'aux', 'NUL', 'com1', 'lpt9']) {
      expect(slugDeTitulo(reservado)).not.toBe(reservado.toLowerCase());
    }
  });
});

describe('nomeDisponivel', () => {
  it('usa o nome pedido quando ninguem o ocupa', () => {
    expect(nomeDisponivel('kant', ['hume', 'hegel'])).toBe('kant');
  });

  it('numera a partir do segundo quando ja existe', () => {
    expect(nomeDisponivel('kant', ['kant'])).toBe('kant-2');
    expect(nomeDisponivel('kant', ['kant', 'kant-2'])).toBe('kant-3');
  });

  it('deixa a nota ficar com o nome que ja e dela', () => {
    expect(nomeDisponivel('kant', ['kant', 'hume'], 'kant')).toBe('kant');
  });

  it('trata maiusculas como o Windows trata: kant e KANT sao o mesmo arquivo', () => {
    expect(nomeDisponivel('kant', ['KANT'])).toBe('kant-2');
  });
});
