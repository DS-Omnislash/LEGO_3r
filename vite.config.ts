/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Port fix: les dades d'IndexedDB queden lligades a l'origen (http://localhost:5173).
// base relativa: permet publicar a GitHub Pages (https://usuari.github.io/repositori/).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, strictPort: true, host: 'localhost' },
  preview: { port: 5173, strictPort: true, host: 'localhost' },
  build: { chunkSizeWarningLimit: 1500 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
