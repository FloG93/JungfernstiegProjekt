import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Im Entwicklungsmodus leitet Vite /api, /ws und /content an den Server weiter (2.3).
export default defineConfig({
  plugins: [preact()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/content': 'http://localhost:3000',
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    chunkSizeWarningLimit: 1600,
  },
});
