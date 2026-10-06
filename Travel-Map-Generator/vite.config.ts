import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

/**
 * Die App wird unter GitHub Pages in einem Unterordner ausgeliefert:
 * https://flog93.github.io/JungfernstiegProjekt/Travel-Map-Generator/
 * Ohne passende `base` zeigen alle Asset-Pfade ins Leere.
 */
export const BASE_PATH = '/JungfernstiegProjekt/Travel-Map-Generator/'

export default defineConfig({
  base: BASE_PATH,
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
