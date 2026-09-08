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
