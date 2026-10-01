// Umgebungsvariablen (2.8). Pflicht: SESSION_SECRET und INVITE_CODE.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Config {
  port: number;
  dbPath: string;
  sessionSecret: string;
  inviteCode: string;
  tickRate: number;
  bossTimerScale: number;
  logLevel: string;
  contentDir: string;
  publicDir: string;
  backupDir: string;
  cookieSecure: boolean;
}

const here = dirname(fileURLToPath(import.meta.url));
const MIN_SECRET_LENGTH = 16;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const sessionSecret = env['SESSION_SECRET'] ?? '';
  const inviteCode = env['INVITE_CODE'] ?? '';
  if (sessionSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET fehlt oder ist kürzer als ${MIN_SECRET_LENGTH} Zeichen (2.8)`);
  }
  if (!inviteCode) throw new Error('INVITE_CODE fehlt (2.8)');
  // OPEN-005: DB_PATH gilt, DATABASE_PATH ist ein Alias
  const dbPath = env['DB_PATH'] ?? env['DATABASE_PATH'] ?? './data/aethra.db';
  return {
    port: Number(env['PORT'] ?? 3000),
    dbPath,
    sessionSecret,
    inviteCode,
    tickRate: Number(env['TICK_RATE'] ?? 20),
    bossTimerScale: Number(env['BOSS_TIMER_SCALE'] ?? 1),
    logLevel: env['LOG_LEVEL'] ?? 'info',
    contentDir: env['CONTENT_DIR'] ?? resolve(here, '../../../packages/content'),
    publicDir: env['PUBLIC_DIR'] ?? resolve(here, '../../client/dist'),
    backupDir: env['BACKUP_DIR'] ?? resolve(dirname(dbPath), 'backups'),
    cookieSecure: env['COOKIE_SECURE'] === '1' || env['COOKIE_SECURE'] === 'true',
  };
}
