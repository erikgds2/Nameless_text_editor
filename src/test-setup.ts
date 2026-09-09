// O ambiente de teste agora é o jsdom, que já traz localStorage de verdade —
// o polyfill manual daqui virou desnecessário e podia mascarar diferenças de
// comportamento em relação ao navegador. Ficam só os matchers de DOM do
// Testing Library, a limpeza do DOM entre testes e a limpeza do localStorage,
// para que um teste nunca herde estado de armazenamento do teste anterior.
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);

beforeEach(() => localStorage.clear());

// O jsdom não implementa scrollIntoView, e sem este preenchimento qualquer
// componente que traga um elemento para a tela quebra o teste por um motivo
// que nada tem a ver com o que está sendo testado.
beforeEach(() => {
  Element.prototype.scrollIntoView = () => {};
});
