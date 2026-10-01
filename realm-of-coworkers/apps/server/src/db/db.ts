// SQLite über better-sqlite3 mit Kysely (2.1). WAL für gleichzeitiges Lesen, Fremdschlüssel an.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { Migrator } from 'kysely/migration';
import { migrationProvider } from './migrations';
import type { DB } from './schema';

export type Db = Kysely<DB>;

export interface OpenedDb {
  db: Db;
  raw: Database.Database;
}

export function openDb(path: string): OpenedDb {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const raw = new Database(path);
  raw.pragma('journal_mode = WAL');
  raw.pragma('foreign_keys = ON');
  raw.pragma('busy_timeout = 5000');
  const db = new Kysely<DB>({ dialect: new SqliteDialect({ database: raw }) });
  return { db, raw };
}

export async function migrate(db: Db): Promise<void> {
  const migrator = new Migrator({ db, provider: migrationProvider });
  const { error, results } = await migrator.migrateToLatest();
  for (const r of results ?? []) if (r.status === 'Error') throw new Error(`Migration ${r.migrationName} fehlgeschlagen`);
  if (error) throw error instanceof Error ? error : new Error(String(error));
}
