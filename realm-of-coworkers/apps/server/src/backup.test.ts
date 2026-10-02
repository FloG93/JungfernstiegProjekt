// Sicherung (16.6): Datei entsteht, ist lesbar, alte Sicherungen verschwinden nach 14 Tagen.
import { existsSync, mkdtempSync, readdirSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, expect, it } from 'vitest';
import { Backups } from './backup';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

it('sichert die laufende Datenbank und hält 14 Tage vor', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aethra-sicherung-'));
  dirs.push(dir);
  const db = new Database(join(dir, 'live.db'));
  db.exec('create table t (x integer); insert into t values (42);');
  const log = { info: () => undefined, error: () => undefined };
  const b = new Backups(db, join(dir, 'sicherung'), 14, 3, log);
  const file = await b.run('start');
  expect(existsSync(file)).toBe(true);
  const copy = new Database(file, { readonly: true });
  expect(copy.prepare('select x from t').get()).toEqual({ x: 42 });
  copy.close();
  // Eine 20 Tage alte Sicherung wird beim nächsten Lauf entfernt
  const old = await b.run('alt');
  const past = (Date.now() - 20 * 86_400_000) / 1000;
  utimesSync(old, past, past);
  await b.run('nacht');
  const files = readdirSync(join(dir, 'sicherung'));
  expect(files.some((f) => f.includes('-alt'))).toBe(false);
  expect(files.length).toBe(2);
  db.close();
});
