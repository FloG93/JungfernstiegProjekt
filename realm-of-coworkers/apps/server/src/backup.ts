// Sicherung der Datenbank (16.6): beim Start (vor jedem Deployment) und nächtlich, 14 Tage aufbewahrt. // OPEN-044
// Nutzt die Online-Sicherung von SQLite, der Server läuft dabei weiter.
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';

const MS_PER_DAY = 86_400_000;
const PREFIX = 'aethra-';

export interface BackupLog {
  info(o: object, msg?: string): void;
  error(o: object, msg?: string): void;
}

export class Backups {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly raw: Database.Database,
    private readonly dir: string,
    private readonly keepDays: number,
    private readonly hour: number,
    private readonly log: BackupLog,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Erstellt eine Sicherung und löscht alte. Gibt den Dateipfad zurück. */
  async run(reason: string): Promise<string> {
    mkdirSync(this.dir, { recursive: true });
    const stamp = new Date(this.now()).toISOString().replace(/[:.]/g, '-');
    const file = join(this.dir, `${PREFIX}${stamp}-${reason}.db`);
    await this.raw.backup(file);
    const removed = this.prune();
    this.log.info({ file, removed }, 'Datenbank gesichert');
    return file;
  }

  /** Entfernt Sicherungen, die älter als keepDays sind. */
  prune(): number {
    let removed = 0;
    const limit = this.now() - this.keepDays * MS_PER_DAY;
    for (const f of readdirSync(this.dir)) {
      if (!f.startsWith(PREFIX) || !f.endsWith('.db')) continue;
      const p = join(this.dir, f);
      if (statSync(p).mtimeMs < limit) {
        unlinkSync(p);
        removed++;
      }
    }
    return removed;
  }

  /** Nächste Sicherung zur Stunde `hour` (Ortszeit des Servers), danach täglich. */
  schedule(): void {
    const d = new Date(this.now());
    const next = new Date(d);
    next.setHours(this.hour, 0, 0, 0);
    if (next.getTime() <= d.getTime()) next.setDate(next.getDate() + 1);
    this.timer = setTimeout(() => {
      this.run('nacht').catch((err: unknown) => this.log.error({ err }, 'Sicherung fehlgeschlagen'));
      this.schedule();
    }, next.getTime() - d.getTime());
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
