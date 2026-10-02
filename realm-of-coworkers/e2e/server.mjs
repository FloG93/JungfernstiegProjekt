// Startet den gebauten Server für die Browser-Tests: frische Datenbank, 4-fache Geschwindigkeit (TICK_RATE, OPEN-038).
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const E2E_DB = resolve(root, 'e2e-data/e2e.db');
rmSync(dirname(E2E_DB), { recursive: true, force: true });
mkdirSync(dirname(E2E_DB), { recursive: true });
Object.assign(process.env, {
  PORT: '3459', DB_PATH: E2E_DB, SESSION_SECRET: 'e2e-geheimnis-mit-genug-laenge', INVITE_CODE: 'e2e-kollegen',
  PUBLIC_DIR: resolve(root, 'apps/client/dist'), TICK_RATE: '80', LOG_LEVEL: 'warn', BOSS_TIMER_SCALE: '0',
});
process.chdir(resolve(root, 'apps/server'));
await import(resolve(root, 'apps/server/dist/main.js'));
