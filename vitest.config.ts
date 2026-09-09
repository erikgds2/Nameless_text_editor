import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Montar um jsdom por arquivo custava três quartos do tempo da bateria.
    // vmThreads reaproveita o ambiente mantendo o isolamento entre arquivos.
    pool: 'vmThreads',
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    // A medição por relógio fica fora da bateria, e é rodada por
    // `node .agent/check-escala.mjs`: o tempo oscila com a máquina ocupada, e
    // um portão que derruba por motivo errado é pior do que não medir. O que
    // fica aqui é a contagem de operações, que dá o mesmo número em qualquer
    // lugar.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      ...(process.env.MEDIR ? [] : ['**/*.medicao.test.ts']),
    ],
  },
});
