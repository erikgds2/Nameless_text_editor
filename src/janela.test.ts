/**
 * O acrílico do Windows é desenhado só enquanto a janela está ativa. Fotografei
 * as duas situações antes de escrever isto: em foco, a janela mostra o fundo
 * borrado; fora de foco, o sistema troca tudo por um cinza chapado. Um corpo
 * translúcido por cima desse cinza é o que fazia o app "ficar escuro".
 *
 * O CSS resolve pintando o nosso próprio fundo enquanto o foco está fora — mas
 * só sabe quando isso acontece se alguém marcar. É o que estes testes guardam.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { acompanharFoco } from './janela';

describe('foco da janela', () => {
  const raiz = document.documentElement;
  let parar: (() => void) | null = null;

  afterEach(() => {
    parar?.();
    parar = null;
    delete raiz.dataset.foco;
  });

  it('marca o documento assim que começa a acompanhar', () => {
    parar = acompanharFoco();
    expect(raiz.dataset.foco).toBeDefined();
  });

  it('perder o foco fica registrado', () => {
    parar = acompanharFoco();
    window.dispatchEvent(new Event('blur'));
    expect(raiz.dataset.foco).toBe('nao');
  });

  it('recuperar o foco desfaz a marca', () => {
    parar = acompanharFoco();
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));
    expect(raiz.dataset.foco).toBe('sim');
  });

  it('parar de acompanhar solta os ouvintes', () => {
    parar = acompanharFoco();
    window.dispatchEvent(new Event('focus'));
    parar();
    parar = null;

    window.dispatchEvent(new Event('blur'));
    expect(raiz.dataset.foco).toBe('sim');
  });

  it('aceita outra raiz, para não depender do documento inteiro', () => {
    const outra = document.createElement('div');
    parar = acompanharFoco(outra);
    window.dispatchEvent(new Event('blur'));
    expect(outra.dataset.foco).toBe('nao');
    expect(raiz.dataset.foco).toBeUndefined();
  });
});
