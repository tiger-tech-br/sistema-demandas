import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: Object.fromEntries(['/auth', '/demandas', '/planos', '/cobranca', '/admin', '/privacidade'].map(route => [route, {
      target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:4000', changeOrigin: false
    }]))
  }
});
