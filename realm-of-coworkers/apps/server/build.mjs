// Bündelt den Server für die Produktion (Dockerfile, 16.6).
// Native Pakete bleiben extern und werden im Laufzeit-Image installiert.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.ts', 'src/admin.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  external: ['better-sqlite3', '@node-rs/argon2', 'fastify', '@fastify/*', 'ws', 'kysely', 'zod'],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: 'info',
});
