import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Montar um jsdom por arquivo custava três quartos do tempo da bateria.
    // vmThreads reaproveita o ambiente mantendo o isolamento entre arquivos.
    pool: 'vmThreads',
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
