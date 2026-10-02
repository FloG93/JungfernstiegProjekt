// Hilfen für Tests des Echtzeit-Teils: manuelle Uhr, Socket-Attrappe mit Latenz, Testspieler mit Ausrüstung.
import { PROTOCOL_VERSION, Rng, createItem } from '@aethra/shared';
import type { ClassId, ClientMsg, EquipSlot, RarityId, ServerMsg, SlotId } from '@aethra/shared';
import { buildApp } from '../app';
import type { BuiltApp } from '../app';
import { loadConfig } from '../config';
import type { AppCtx } from '../context';
import { createHero, insertItem } from '../game/heroes';
import type { Client, Sock } from './client';
import type { Clock } from './clock';
import type { Hub } from './hub';
import { attachRealtime } from './realtime';

/** Wartet, bis alle anstehenden Promises (Datenbank) erledigt sind. */
export async function settle(rounds = 3): Promise<void> {
  for (let i = 0; i < rounds; i++) await new Promise<void>((r) => setImmediate(r));
}

interface Timer {
  at: number;
  ms: number;
  fn: () => void;
  dead: boolean;
}

/** Uhr, die nur auf Befehl vorläuft. Intervalle feuern in Zeitreihenfolge, danach werden Promises abgearbeitet. */
export class ManualClock implements Clock {
  t: number;
  private timers: Timer[] = [];
  private once: { at: number; fn: () => void }[] = [];

  constructor(start = Date.UTC(2026, 9, 1, 9)) {
    this.t = start;
  }

  now(): number {
    return this.t;
  }

  every(ms: number, fn: () => void): () => void {
    const tm: Timer = { at: this.t + ms, ms, fn, dead: false };
    this.timers.push(tm);
    return () => {
      tm.dead = true;
    };
  }

  /** Einmaliger Aufruf (Zustellung mit Latenz). */
  after(ms: number, fn: () => void): void {
    const at = this.t + ms;
    let i = this.once.length;
    while (i > 0 && this.once[i - 1]!.at > at) i--;
    this.once.splice(i, 0, { at, fn });
  }

  async advance(ms: number): Promise<void> {
    const end = this.t + ms;
    for (;;) {
      this.timers = this.timers.filter((x) => !x.dead);
      let tm: Timer | undefined;
      for (const x of this.timers) if (!tm || x.at < tm.at) tm = x;
      const o = this.once[0];
      if (o && o.at <= end && (!tm || o.at <= tm.at)) {
        this.once.shift();
        this.t = Math.max(this.t, o.at);
        o.fn();
        continue;
      }
      if (!tm || tm.at > end) break;
      this.t = tm.at;
      tm.at += tm.ms;
      tm.fn();
      await settle();
    }
    this.t = end;
    await settle();
  }

  /** Läuft vor, bis die Bedingung gilt (oder die Frist abläuft). */
  async until(cond: () => boolean, maxMs: number, stepMs = 50): Promise<boolean> {
    for (let t = 0; t < maxMs; t += stepMs) {
      if (cond()) return true;
      await this.advance(stepMs);
    }
    return cond();
  }
}

/** Socket-Attrappe: speichert ausgehende Nachrichten mit Ankunftszeit (Latenz Server → Client). */
export class FakeSock implements Sock {
  readonly inbox: { at: number; data: string }[] = [];
  closed: { code: number; reason: string } | null = null;
  bytes = 0;

  constructor(private readonly clock: ManualClock, private readonly delayMs: number) {}

  send(data: string): void {
    if (this.closed) return;
    this.inbox.push({ at: this.clock.now() + this.delayMs, data });
    this.bytes += data.length;
  }

  close(code: number, reason: string): void {
    this.closed = { code, reason };
  }
}

type MsgOf<T extends ServerMsg['t']> = Extract<ServerMsg, { t: T }>;

export class TestPlayer {
  cl!: Client;
  sock!: FakeSock;
  private parsed: ServerMsg[] = [];
  private readIdx = 0;
  seq = 0;

  constructor(
    readonly env: TestEnv,
    readonly accountId: number,
    readonly username: string,
    readonly heroId: number,
    readonly classId: ClassId,
    readonly latencyMs = 0,
  ) {}

  connect(): void {
    this.sock = new FakeSock(this.env.clock, this.latencyMs / 2);
    this.parsed = [];
    this.readIdx = 0;
    this.cl = this.env.hub.connect(this.sock, { accountId: this.accountId, username: this.username });
  }

  hello(heroId = this.heroId): void {
    this.send({ t: 'hello', v: PROTOCOL_VERSION, heroId });
  }

  send(msg: ClientMsg): void {
    const json = JSON.stringify(msg);
    const cl = this.cl;
    if (this.latencyMs === 0) this.env.hub.message(cl, json);
    else this.env.clock.after(this.latencyMs / 2, () => this.env.hub.message(cl, json));
  }

  input(mx: number, my: number, act?: NonNullable<Extract<ClientMsg, { t: 'run.input' }>['act']>): number {
    const seq = ++this.seq;
    this.send({ t: 'run.input', seq, mx, my, ...(act ? { act } : {}) });
    return seq;
  }

  /** Verbindung bricht ab (ohne Abmeldung). */
  drop(): void {
    this.env.hub.disconnect(this.cl);
  }

  /** Alle bis jetzt angekommenen Nachrichten (Latenz berücksichtigt). */
  messages(): ServerMsg[] {
    const now = this.env.clock.now();
    const inbox = this.sock.inbox;
    while (this.readIdx < inbox.length && inbox[this.readIdx]!.at <= now) {
      this.parsed.push(JSON.parse(inbox[this.readIdx]!.data) as ServerMsg);
      this.readIdx++;
    }
    return this.parsed;
  }

  of<T extends ServerMsg['t']>(t: T): MsgOf<T>[] {
    return this.messages().filter((m): m is MsgOf<T> => m.t === t);
  }

  last<T extends ServerMsg['t']>(t: T): MsgOf<T> | undefined {
    const all = this.of(t);
    return all[all.length - 1];
  }

  has(t: ServerMsg['t']): boolean {
    return this.messages().some((m) => m.t === t);
  }

  errors(): string[] {
    return this.of('error').map((e) => `${e.code}: ${e.message}`);
  }
}

export interface TestEnv {
  b: BuiltApp;
  ctx: AppCtx;
  hub: Hub;
  clock: ManualClock;
  close(): Promise<void>;
}

export async function makeEnv(env: Record<string, string> = {}): Promise<TestEnv> {
  const clock = new ManualClock();
  const config = loadConfig({
    SESSION_SECRET: 'test-geheimnis-mit-genug-laenge', INVITE_CODE: 'kollegen', DB_PATH: ':memory:', PUBLIC_DIR: '/nicht/da', ...env,
  });
  const b = await buildApp(config, { logger: false, now: () => clock.now() });
  const hub = attachRealtime(b.app, b.ctx, { clock });
  return {
    b, ctx: b.ctx, hub, clock,
    close: async () => {
      await b.app.close();
      b.dbh.raw.close();
    },
  };
}

const ARMOR: [SlotId, EquipSlot][] = [
  ['ruestung', 'Ruestung'], ['nebenhand', 'Nebenhand'], ['helm', 'Helm'], ['handschuhe', 'Handschuhe'],
  ['umhang', 'Umhang'], ['stiefel', 'Stiefel'],
];

/** Ausrüstung wie der Referenzheld (13.1): alle Slots, iLvl und Seltenheit wählbar. Ersetzt die Startwaffe. */
export async function gearUp(env: TestEnv, heroId: number, classId: ClassId, ilvl: number, rarity: RarityId = 'selten', element: 'feuer' | 'eis' | 'blitz' | 'erde' | 'licht' | 'schatten' | 'physisch' = 'eis'): Promise<void> {
  const c = env.ctx.content;
  const rng = new Rng(heroId);
  const now = env.clock.now();
  await env.ctx.db.deleteFrom('items').where('hero_id', '=', heroId).execute();
  await insertItem(env.ctx.db, heroId, createItem(c, rng, { classId, slot: 'waffe', ilvl, rarity, element }), now, 'Waffe_A');
  for (const [slot, eq] of ARMOR) await insertItem(env.ctx.db, heroId, createItem(c, rng, { classId, slot, ilvl, rarity }), now, eq);
}

export interface PlayerOpts {
  latencyMs?: number;
  level?: number;
  gear?: { ilvl: number; rarity?: RarityId; element?: Parameters<typeof gearUp>[5] };
  /** Abgeschlossene Stages (Freischaltung, 3.4). */
  cleared?: number[];
  hello?: boolean;
}

export async function addPlayer(env: TestEnv, username: string, classId: ClassId, o: PlayerOpts = {}): Promise<TestPlayer> {
  const now = env.clock.now();
  const acc = await env.ctx.db.insertInto('accounts').values({ username, pw_hash: 'x', created_at: now, last_login: now })
    .returning('id').executeTakeFirstOrThrow();
  // Heldenname = Benutzername mit großem Anfangsbuchstaben (anna → Anna)
  const heroName = (username[0]!.toUpperCase() + username.slice(1)).slice(0, 16);
  const hero = await createHero(env.ctx.game, acc.id, heroName, classId, { body: 0, portrait: 0, palette: 0 });
  if (o.level) await env.ctx.db.updateTable('heroes').set({ level: o.level }).where('id', '=', hero.id).execute();
  if (o.gear) await gearUp(env, hero.id, classId, o.gear.ilvl, o.gear.rarity, o.gear.element);
  for (const s of o.cleared ?? []) {
    await env.ctx.db.insertInto('stage_progress').values({ hero_id: hero.id, stage: s, clears: 1, best_time_ms: null }).execute();
  }
  const p = new TestPlayer(env, acc.id, username, hero.id, classId, o.latencyMs ?? 0);
  p.connect();
  if (o.hello !== false) {
    p.hello();
    await env.clock.until(() => p.has('welcome'), 5000);
  }
  return p;
}
