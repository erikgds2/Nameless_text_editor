import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // caminhos relativos para o build carregar via file:// dentro do Electron
  base: './',
  server: { port: 5173, strictPort: true },
});
