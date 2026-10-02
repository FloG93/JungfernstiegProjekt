// Bündelt den Server für die Produktion (Dockerfile, 16.6, Raspberry-Pi-Paket).
// Native Pakete bleiben extern und werden im Laufzeit-Image bzw. auf dem Pi installiert.
// Ziel Node 22: Für 32-Bit-ARM (Raspberry Pi 2) gibt es Node 24 nicht mehr (OPEN-048).
import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.ts', 'src/admin.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  external: ['better-sqlite3', '@node-rs/argon2', 'fastify', '@fastify/*', 'ws', 'kysely', 'zod'],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: 'info',
});
