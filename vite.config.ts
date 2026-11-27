import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// BASE_PATH lets the same build be served from a sub-path (e.g. GitHub Pages: /appartment_analyzer/).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // three and xlsx are large but lazy-loaded; the initial budget is enforced by `npm run size`.
    chunkSizeWarningLimit: 600,
  },
  preview: { port: 4173, strictPort: true },
});
