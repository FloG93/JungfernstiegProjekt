// Eine laufende Stage (2.3, 11.4 bis 11.7): Simulation mit 20 Ticks/s, Delta-Snapshots mit 10 Hz, Ereignisse sofort.
// Belohnungen werden je Spieler nacheinander in Transaktionen gespeichert (2.5). Solo ist ein Run mit einem Spieler.
import { gzipSync } from 'node:zlib';
import {
  Rng, STAGE_COUNT, SnapshotTracker, addHero, bossReward, createRun, deriveSeed, encounterReward, placeInFormation,
  removeHeroUnit, rollBossLoot, rollEliteItem, rollStageChest, stepWorld, unitById, updateHeroSetup,
} from '@aethra/shared';
import type {
  BossId, ClassId, ClientMsg, GameEvent, GemDrop, HeroAction, HeroInput, HeroSetup, ItemDTO, RosterEntry, Run,
  RunEndMsg, RunExtra, RunStartMsg, StageDef, Unit,
} from '@aethra/shared';
import { heroSetup } from '../game/heroes';
import { grantRewards, recordBossKill, recordStageClear } from '../game/rewards';
import type { RewardInput, RewardResult } from '../game/rewards';
import { fail } from '../http/errors';
import type { HubApi } from './hubapi';
import type { Party } from './party';

const MS_PER_S = 1000;
/** Höchstens so viele Eingaben je Spieler und Tick; ältere fallen weg (2.6). */
const MAX_PENDING_INPUTS = 8;
/** Obergrenze des Eingabeprotokolls für die Nachrechnung (run_log). */
const LOG_LIMIT = 200_000;
const DISPLAY_ROUND = 10;

export type EndReason = 'win' | 'camp' | 'empty' | 'pause' | 'server' | 'left';
type RunInputMsg = Extract<ClientMsg, { t: 'run.input' }>;
type ProtoAction = NonNullable<RunInputMsg['act']>[number];

export interface RunPlayerInit {
  accountId: number;
  setup: HeroSetup;
  /** Helfer-Modus am Boss (10.9): Timer läuft, keine Boss-Belohnung. */
  helper: boolean;
  /** Erster Sieg über den Boss dieser Stage. */
  first: boolean;
  /** Eigene Beutestufe K für den Boss (8.2). */
  kampfstufe: number;
  /** Stage schon abgeschlossen: Wiederholung mit 40 % XP (12.2). */
  repeat: boolean;
  /** Nicht bereit beim Start: Autopilot, bis der Spieler eingreift (11.3). */
  autopilot: boolean;
}

interface Totals {
  xp: number;
  weaponXp: number;
  gold: number;
  items: ItemDTO[];
  gems: GemDrop[];
  splinters: number;
  levelUps: number[];
  weaponLevelUps: number[];
  autoSold: { name: string; gold: number }[];
  artifactUnlocked: string | null;
}

export class RunPlayer {
  readonly accountId: number;
  readonly heroId: number;
  readonly classId: ClassId;
  readonly name: string;
  level: number;
  setup: HeroSetup;
  unitId: number | null = null;
  /** Wiedereinstieg läuft (Werte werden geladen). */
  joining = false;
  readonly helper: boolean;
  readonly first: boolean;
  readonly kampfstufe: number;
  readonly repeat: boolean;
  connected = true;
  disconnectedAt = 0;
  autopilot: boolean;
  /** Möchte am nächsten Checkpoint bzw. Boss-Tor wieder einsteigen (11.5). */
  wantsRejoin = false;
  endSent = false;
  gateReady = false;
  readonly tracker = new SnapshotTracker();
  needFull = true;
  pending: HeroInput[] = [];
  lastSeq = -1;
  ackedSeq = -1;
  potXp = 0;
  potGold = 0;
  private: GameEvent[] = [];
  readonly totals: Totals = {
    xp: 0, weaponXp: 0, gold: 0, items: [], gems: [], splinters: 0, levelUps: [], weaponLevelUps: [], autoSold: [],
    artifactUnlocked: null,
  };
  /** Datenbankarbeit dieses Spielers läuft nacheinander. */
  chain: Promise<void> = Promise.resolve();
  readonly lootRng: Rng;

  constructor(init: RunPlayerInit, seed: number) {
    this.accountId = init.accountId;
    this.heroId = init.setup.dbId;
    this.classId = init.setup.classId;
    this.name = init.setup.name;
    this.level = init.setup.level;
    this.setup = init.setup;
    this.helper = init.helper;
    this.first = init.first;
    this.kampfstufe = init.kampfstufe;
    this.repeat = init.repeat;
    this.autopilot = init.autopilot;
    // Beute würfelt jeder Spieler mit eigenem Zähler, damit die Welt davon unberührt bleibt (10.8, 12)
    this.lootRng = new Rng(deriveSeed(seed, init.setup.dbId));
  }

  add(r: RewardResult): void {
    const t = this.totals;
    t.xp += r.xpGained;
    t.weaponXp += r.weaponXp;
    t.gold += r.gold;
    t.items.push(...r.items);
    t.gems.push(...r.gems);
    t.splinters += r.splinters;
    t.levelUps.push(...r.levelUps);
    t.weaponLevelUps.push(...r.weaponLevelUps);
    t.autoSold.push(...r.autoSold);
    if (r.artifactUnlocked) t.artifactUnlocked = r.artifactUnlocked;
  }
}

export interface RunOptions {
  id: string;
  stage: number;
  seed: number;
  players: RunPlayerInit[];
  kampfstufe: number;
}

function toAction(a: ProtoAction): HeroAction {
  if (a.k !== 'skill') return a;
  const o: Extract<HeroAction, { k: 'skill' }> = { k: 'skill', id: a.id };
  if (a.target !== undefined) o.target = a.target;
  if (a.x !== undefined) o.x = a.x;
  if (a.y !== undefined) o.y = a.y;
  return o;
}

function toInput(m: RunInputMsg): HeroInput {
  const inp: HeroInput = { mx: m.mx, my: m.my };
  if (m.tx !== undefined) inp.tx = m.tx;
  if (m.ty !== undefined) inp.ty = m.ty;
  if (m.act && m.act.length > 0) inp.act = m.act.map(toAction);
  return inp;
}

/** Ereignisse nur für den Server (Topf, Elite-Beute) bzw. nur für einen Spieler (Beute). */
const PRIVATE_EVENTS = new Set<GameEvent['e']>(['reward', 'eliteLoot', 'loot']);

const round1 = (x: number) => Math.round(x * DISPLAY_ROUND) / DISPLAY_ROUND;

export class RunInstance {
  readonly id: string;
  readonly stage: number;
  readonly seed: number;
  readonly def: StageDef;
  readonly run: Run;
  readonly players = new Map<number, RunPlayer>();
  readonly startedAt: number;
  nextTickAt: number;
  ended = false;
  private finishing = false;
  private serverTicks = 0;
  private publicQueue: GameEvent[] = [];
  private readonly log: unknown[] = [];
  private logId: number | null = null;
  private lastConnectedAt: number;
  private pausedAt: number | null = null;
  private autoPaused = false;
  private gateSince: number | null = null;
  private readonly solo: boolean;
  private readonly ticksPerSecond: number;

  constructor(private readonly hub: HubApi, readonly party: Party, o: RunOptions) {
    const c = hub.ctx.content;
    this.id = o.id;
    this.stage = o.stage;
    this.seed = o.seed;
    this.run = createRun(c, { stage: o.stage, seed: o.seed, kampfstufe: o.kampfstufe, heroes: o.players.map((p) => p.setup) });
    this.def = this.run.scenario.def;
    this.solo = o.players.length === 1;
    this.ticksPerSecond = c.balance.combat.tickRate;
    o.players.forEach((init, i) => {
      const p = new RunPlayer(init, o.seed);
      const u = this.run.heroes[i]!;
      p.unitId = u.id;
      u.hero!.connected = !p.autopilot;
      this.players.set(p.accountId, p);
    });
    const now = hub.now();
    this.startedAt = now;
    this.nextTickAt = now + this.run.world.tickMs;
    this.lastConnectedAt = now;
    this.updateN();
  }

  get world() {
    return this.run.world;
  }

  get scenario() {
    return this.run.scenario;
  }

  get inArena(): boolean {
    return this.scenario.kind === 'arena';
  }

  /** Held steckt im Run (Ausrüstung gesperrt, 15.2). */
  hasHero(heroId: number): boolean {
    for (const p of this.players.values()) if (p.heroId === heroId && (p.unitId !== null || p.joining)) return true;
    return false;
  }

  joined(): RunPlayer[] {
    return [...this.players.values()].filter((p) => p.unitId !== null);
  }

  private unitOf(p: RunPlayer): Unit | undefined {
    return unitById(this.world, p.unitId);
  }

  private record(entry: unknown[]): void {
    if (this.log.length < LOG_LIMIT) this.log.push([this.world.tick, ...entry]);
  }

  // ---------- Start und Ende ----------

  /** Eintrag im Run-Protokoll (15.1) und run.start an alle Teilnehmer. */
  async open(): Promise<void> {
    const r = await this.hub.ctx.db.insertInto('run_log').values({
      seed: this.seed, stage: this.stage, started_at: this.startedAt,
      party: JSON.stringify([...this.players.values()].map((p) => ({ account: p.accountId, hero: p.heroId, cls: p.classId, level: p.level }))),
    }).returning('id').executeTakeFirstOrThrow();
    this.logId = r.id;
    for (const p of this.players.values()) this.sendStart(p);
  }

  private roster(): RosterEntry[] {
    return this.joined().map((p) => ({
      unitId: p.unitId!, accountId: p.accountId, heroId: p.heroId, name: p.name, classId: p.classId, level: p.level, helper: p.helper,
    }));
  }

  private sendStart(p: RunPlayer): void {
    const cl = this.hub.client(p.accountId);
    if (!cl || p.unitId === null) return;
    const net = this.hub.ctx.content.balance.net;
    const msg: RunStartMsg = {
      t: 'run.start', runId: this.id, seed: this.seed, stage: this.stage, roster: this.roster(), n: this.world.n,
      config: { tickMs: this.world.tickMs, snapshotEveryTicks: net.snapshotEveryTicks, introId: this.def.introId, bossId: this.scenario.bossId },
    };
    cl.send(msg);
    p.tracker.reset();
    p.needFull = true;
  }

  private nextStage(): number {
    return Math.min(STAGE_COUNT, this.stage + 1);
  }

  private endMsg(p: RunPlayer, result: 'win' | 'abort', next: number | null): RunEndMsg {
    const t = p.totals;
    const auto = result === 'win' && next !== null && this.party.autoContinue
      ? this.hub.ctx.content.engine.idle.autoContinueDelayS * MS_PER_S : null;
    return {
      t: 'run.end', result, stage: this.stage, xp: t.xp, weaponXp: t.weaponXp, gold: t.gold, loot: t.items, gems: t.gems,
      splinters: t.splinters, levelUps: t.levelUps, weaponLevelUps: t.weaponLevelUps, autoSold: t.autoSold,
      artifactUnlocked: t.artifactUnlocked, helper: p.helper, firstClear: !p.repeat, timeMs: this.world.t,
      next: result === 'win' ? next : null, autoContinueIn: auto,
    };
  }

  /** Beendet den Run: Belohnungen sichern, Ergebnis senden, Protokoll schreiben (2.5, 11.10). */
  async end(reason: EndReason): Promise<void> {
    if (this.ended) return;
    this.ended = true;
    const ps = [...this.players.values()];
    await Promise.all(ps.map((p) => this.flush(p, {}, true)));
    await Promise.all(ps.map((p) => this.persistActiveSet(p)));
    // Frische Stände (Stufe, Freischaltung, Boss-Timer), bevor die Party die nächste Stage wählt
    await Promise.all(ps.map((p) => this.hub.refreshInfo(p.heroId)));
    const next = reason === 'win' ? this.nextStage() : null;
    const winners = new Set(reason === 'win' ? this.joined().map((p) => p.accountId) : []);
    for (const p of ps) p.unitId = null;
    this.hub.runEnded(this, reason, next);
    for (const p of ps) {
      const cl = this.hub.client(p.accountId);
      if (!cl) continue;
      if (winners.has(p.accountId)) cl.send(this.endMsg(p, 'win', next));
      else if (!p.endSent) cl.send(this.endMsg(p, 'abort', null));
      if (reason !== 'win') cl.send({ t: 'run.closed', reason });
      p.endSent = true;
    }
    await this.writeLog(reason);
  }

  private async writeLog(reason: EndReason): Promise<void> {
    if (this.logId === null) return;
    try {
      await this.hub.ctx.db.updateTable('run_log').set({
        ended_at: this.hub.now(), result: reason, events: gzipSync(JSON.stringify(this.log)),
      }).where('id', '=', this.logId).execute();
    } catch (err) {
      this.hub.log.error({ err, runId: this.id }, 'Run-Protokoll nicht gespeichert');
    }
  }

  /** Sieg (9.1, 10.8): Truhe bzw. Boss-Beute je Spieler, Abschluss, Timer, dann Ergebnis. */
  private async finish(): Promise<void> {
    if (this.finishing) return;
    this.finishing = true;
    const c = this.hub.ctx.content;
    const g = this.hub.ctx.game;
    const bossId: BossId | null = this.scenario.bossId;
    const timeMs = this.world.t;
    const jobs = this.joined().map(async (p) => {
      const extra: RewardInput = {};
      if (bossId) {
        if (!p.helper) {
          const l = rollBossLoot(c, p.lootRng, { classId: p.classId, bossId, first: p.first, beutestufe: p.kampfstufe });
          const r = bossReward(c, this.stage, p.first, false);
          Object.assign(extra, { xp: r.xp, gold: r.gold, items: l.items, gems: l.gems, splinters: l.splinters, artifactUnlock: l.artifactUnlock });
        }
      } else {
        const l = rollStageChest(c, p.lootRng, p.classId, this.stage);
        Object.assign(extra, { items: l.items, gems: l.gems, splinters: l.splinters });
      }
      await this.flush(p, extra, true);
      p.chain = p.chain.then(async () => {
        await recordStageClear(g, p.heroId, this.stage, timeMs);
        if (bossId && !p.helper) await recordBossKill(g, p.heroId, bossId, p.first);
      }).catch((err: unknown) => this.hub.log.error({ err, runId: this.id }, 'Abschluss nicht gespeichert'));
      await p.chain;
    });
    await Promise.all(jobs);
    await this.end('win');
  }

  // ---------- Belohnungen ----------

  /**
   * Speichert offene XP und Gold (ganze Zahlen, Rest bleibt stehen) plus Beute. Bei Stufenaufstieg werden die Werte
   * im Run aktualisiert und der Held um 30 % geheilt (12.1).
   */
  private flush(p: RunPlayer, extra: RewardInput, final = false, onDone?: (r: RewardResult) => void): Promise<void> {
    const xpAll = p.potXp + (extra.xp ?? 0);
    const goldAll = p.potGold + (extra.gold ?? 0);
    const xp = final ? Math.round(xpAll) : Math.floor(xpAll);
    const gold = final ? Math.round(goldAll) : Math.floor(goldAll);
    p.potXp = final ? 0 : xpAll - xp;
    p.potGold = final ? 0 : goldAll - gold;
    const r: RewardInput = { ...extra, xp, gold };
    const empty = xp <= 0 && gold <= 0 && !extra.items?.length && !extra.gems?.length && !extra.splinters && !extra.artifactUnlock;
    if (empty) return p.chain;
    const set = this.unitOf(p)?.hero?.activeSet;
    p.chain = p.chain.then(async () => {
      const res = await grantRewards(this.hub.ctx.game, p.heroId, r, set);
      p.add(res);
      onDone?.(res);
      if (res.levelUps.length > 0 || res.weaponLevelUps.length > 0) await this.refreshHero(p, res.levelUps.length > 0);
    }).catch((err: unknown) => this.hub.log.error({ err, runId: this.id, heroId: p.heroId }, 'Belohnung nicht gespeichert'));
    return p.chain;
  }

  private async refreshHero(p: RunPlayer, levelUp: boolean): Promise<void> {
    const setup = await heroSetup(this.hub.ctx.game, p.heroId, String(p.accountId));
    p.setup = setup;
    p.level = setup.level;
    const u = this.unitOf(p);
    if (u && !this.ended) {
      updateHeroSetup(this.world, u, setup, levelUp ? this.hub.ctx.content.balance.stats.levelUpHealPct : 0);
    }
    if (levelUp) this.publicQueue.push({ e: 'levelup', heroId: p.heroId, level: setup.level });
    this.hub.heroChanged(p.heroId);
  }

  private onReward(encounter: number, frac: number): void {
    const c = this.hub.ctx.content;
    for (const p of this.joined()) {
      const r = encounterReward(c, this.def, encounter, frac, p.repeat);
      p.potXp += r.xp;
      p.potGold += r.gold;
      p.private.push({ e: 'loot', kind: 'gold', ref: { xp: round1(r.xp), gold: round1(r.gold) }, heroId: p.heroId });
    }
  }

  /** Elite besiegt: jeder Spieler würfelt für sich (9.7, 12.8), Beute wird sofort gespeichert (2.5). */
  private onEliteLoot(): void {
    const c = this.hub.ctx.content;
    for (const p of this.joined()) {
      const item = rollEliteItem(c, p.lootRng, p.classId, this.stage);
      if (!item) continue;
      void this.flush(p, { items: [item] }, false, (res) => {
        this.hub.client(p.accountId)?.send({
          t: 'run.loot', source: 'elite', loot: { items: res.items, gems: [], splinters: 0, autoSold: res.autoSold },
        });
      });
    }
  }

  private async persistActiveSet(p: RunPlayer): Promise<void> {
    const set = this.unitOf(p)?.hero?.activeSet;
    if (!set) return;
    try {
      await this.hub.ctx.db.updateTable('heroes').set({ active_set: set }).where('id', '=', p.heroId).execute();
    } catch (err) {
      this.hub.log.error({ err, heroId: p.heroId }, 'Waffensatz nicht gespeichert');
    }
  }

  // ---------- Tick ----------

  /** Ein Tick (11.7): Eingaben, Simulation, Ereignisse, Snapshots, Fristen. */
  tick(now: number): void {
    if (this.ended || this.finishing) return;
    const w = this.world;
    const inputs = new Map<number, HeroInput[]>();
    for (const p of this.players.values()) {
      if (p.unitId !== null && p.pending.length > 0) {
        inputs.set(p.unitId, p.pending);
        this.record(['in', p.accountId, p.pending]);
      }
      p.pending = [];
    }
    stepWorld(w, inputs);
    this.serverTicks++;
    this.handleEvents(w.events, now);
    this.sendEvents(w.events);
    for (const p of this.players.values()) {
      if (p.lastSeq > p.ackedSeq && p.unitId !== null) {
        p.ackedSeq = p.lastSeq;
        this.hub.client(p.accountId)?.send({ t: 'run.ack', seq: p.lastSeq });
      }
    }
    const net = this.hub.ctx.content.balance.net;
    const snapEvery = w.paused ? this.ticksPerSecond : net.snapshotEveryTicks;
    if (this.serverTicks % snapEvery === 0) this.sendSnapshots(this.serverTicks % (net.fullSnapshotS * this.ticksPerSecond) === 0);
    if (this.serverTicks % this.ticksPerSecond === 0) this.housekeeping(now);
  }

  private handleEvents(evs: GameEvent[], now: number): void {
    for (const ev of evs) {
      switch (ev.e) {
        case 'reward':
          this.onReward(ev.encounter, ev.frac);
          break;
        case 'eliteLoot':
          this.onEliteLoot();
          break;
        case 'encounter':
          if (ev.state === 'end') for (const p of this.joined()) void this.flush(p, {});
          break;
        case 'checkpoint':
        case 'wipe':
          this.rejoinWaiting();
          break;
        case 'stage':
          if (ev.phase === 'gate') {
            this.gateSince = now;
            for (const p of this.players.values()) p.gateReady = false;
            this.rejoinWaiting();
          }
          break;
        case 'stageEnd':
          if (ev.result === 'win') void this.finish();
          break;
        default:
          break;
      }
    }
  }

  private sendEvents(evs: GameEvent[]): void {
    const pub = [...this.publicQueue, ...evs.filter((e) => !PRIVATE_EVENTS.has(e.e))];
    this.publicQueue = [];
    const tick = this.world.tick;
    const shared = pub.length > 0 ? JSON.stringify({ t: 'run.events', tick, list: pub }) : null;
    for (const p of this.players.values()) {
      const cl = p.unitId !== null ? this.hub.client(p.accountId) : undefined;
      if (!cl) {
        p.private = [];
        continue;
      }
      if (p.private.length > 0) {
        cl.send({ t: 'run.events', tick, list: [...pub, ...p.private] });
        p.private = [];
      } else if (shared) cl.sendRaw(shared);
    }
  }

  private extra(p: RunPlayer): RunExtra {
    const gate = this.scenario.phase === 'gate';
    const delay = this.hub.ctx.content.engine.idle.autoContinueDelayS * MS_PER_S;
    return {
      helper: p.helper,
      ready: gate ? this.joined().filter((x) => x.gateReady).map((x) => x.accountId) : [],
      autoReadyIn: gate && this.party.autoContinue && this.gateSince !== null
        ? Math.max(0, this.gateSince + delay - this.hub.now()) : null,
    };
  }

  private sendSnapshots(full: boolean): void {
    const max = this.hub.ctx.content.balance.net.maxSnapshotBytes;
    for (const p of this.players.values()) {
      if (p.unitId === null) continue;
      const cl = this.hub.client(p.accountId);
      if (!cl) continue;
      const msg = p.tracker.build(this.world, this.scenario, p.unitId, full || p.needFull, this.extra(p), p.needFull);
      p.needFull = false;
      const json = JSON.stringify(msg);
      if (json.length > max) this.hub.log.warn({ runId: this.id, bytes: json.length, full: msg.full }, 'Snapshot über der Grenze (11.7)');
      cl.sendRaw(json);
    }
  }

  /** Fristen einmal pro Sekunde: Autopilot, leerer Run, Solo-Pause, Auto-Weiter am Boss-Tor. */
  private housekeeping(now: number): void {
    const c = this.hub.ctx.content;
    const grace = c.balance.net.disconnectGraceS * MS_PER_S;
    for (const p of this.joined()) {
      if (!p.connected && !this.world.paused && now - p.disconnectedAt >= grace) {
        p.wantsRejoin = true;
        this.removeUnit(p, 'timeout');
      }
    }
    const anyConnected = [...this.players.values()].some((p) => p.connected && (p.unitId !== null || p.wantsRejoin));
    // Solo hält bei Verbindungsverlust an; dann gilt die Pausenfrist (11.6) statt der Frist für leere Runs
    if (anyConnected || (this.solo && this.world.paused)) this.lastConnectedAt = now;
    else if (now - this.lastConnectedAt >= c.balance.net.emptyRunTimeoutS * MS_PER_S) {
      void this.end('empty');
      return;
    }
    if (this.world.paused && this.pausedAt !== null && now - this.pausedAt >= c.balance.session.soloPauseMaxS * MS_PER_S) {
      void this.end('pause');
      return;
    }
    if (this.scenario.phase === 'gate' && this.party.autoContinue && this.gateSince !== null
      && now - this.gateSince >= c.engine.idle.autoContinueDelayS * MS_PER_S) {
      for (const p of this.joined()) p.gateReady = true;
      this.checkGate();
    }
  }

  // ---------- Mitglieder ----------

  /** n = verbundene Spieler im Run (11.4); mindestens 1. */
  private updateN(): void {
    const n = this.joined().filter((p) => p.connected).length;
    this.world.n = Math.max(1, n);
  }

  /** Verbindung weg (2.4): Autopilot; Solo hält an (E-022, kein Fortschritt ohne Spieler). */
  disconnect(accountId: number): void {
    const p = this.players.get(accountId);
    if (!p) return;
    p.connected = false;
    p.disconnectedAt = this.hub.now();
    const u = this.unitOf(p);
    if (u?.hero) {
      u.hero.connected = false;
      u.hero.input.mx = 0;
      u.hero.input.my = 0;
      u.hero.input.moveTo = null;
    }
    this.record(['dc', accountId]);
    if (this.solo && p.unitId !== null && !this.world.paused) {
      this.world.paused = true;
      this.pausedAt = this.hub.now();
      this.autoPaused = true;
    }
    this.updateN();
    this.checkGate();
  }

  /** Spieler ist wieder da (11.9): Held übernehmen bzw. Wiedereinstieg vormerken. */
  connect(accountId: number): void {
    const p = this.players.get(accountId);
    if (!p) return;
    p.connected = true;
    this.lastConnectedAt = this.hub.now();
    this.record(['rc', accountId]);
    if (p.unitId !== null) {
      const u = this.unitOf(p);
      if (u?.hero) u.hero.connected = !p.autopilot;
      this.sendStart(p);
      if (this.autoPaused) {
        this.world.paused = false;
        this.pausedAt = null;
        this.autoPaused = false;
      }
    } else if (p.wantsRejoin && this.joined().length === 0 && !this.ended) {
      this.restartAtCheckpoint();
    }
    this.updateN();
  }

  /** Niemand mehr im Run, aber jemand will wieder rein: Neustart am letzten Checkpoint bzw. Boss-Tor (11.5). */
  private restartAtCheckpoint(): void {
    if (this.ended || this.finishing) return;
    this.world.paused = false;
    this.pausedAt = null;
    this.scenario.wipe(this.world);
    this.rejoinWaiting();
  }

  /** Wiedereinstieg an Checkpoints und am Boss-Tor (11.5): volles Leben, Position der Party. */
  private rejoinWaiting(): void {
    for (const p of this.players.values()) {
      if (p.unitId !== null || p.joining || !p.wantsRejoin || !p.connected || this.ended) continue;
      if (!this.party.members.some((m) => m.accountId === p.accountId)) continue;
      p.joining = true;
      void heroSetup(this.hub.ctx.game, p.heroId, String(p.accountId)).then((setup) => {
        p.joining = false;
        if (this.ended || this.finishing || !p.wantsRejoin || !p.connected) return;
        this.addUnit(p, setup);
      }).catch((err: unknown) => {
        p.joining = false;
        this.hub.log.error({ err, runId: this.id }, 'Wiedereinstieg fehlgeschlagen');
      });
    }
  }

  private addUnit(p: RunPlayer, setup: HeroSetup): void {
    const w = this.world;
    const same = this.joined().filter((x) => x.classId === p.classId).length;
    const u = addHero(w, setup, { x: 0, sameClassIndex: same, solo: this.solo });
    placeInFormation(u, this.scenario.anchor(w));
    p.setup = setup;
    p.level = setup.level;
    p.unitId = u.id;
    p.wantsRejoin = false;
    p.autopilot = false;
    p.endSent = false;
    p.gateReady = false;
    this.record(['join', p.accountId, u.id]);
    if (w.paused && !this.solo) w.paused = false;
    this.updateN();
    this.sendStart(p);
    this.hub.partyChanged(this.party);
  }

  /** Held verlässt die Welt (Verlassen, Frist abgelaufen, entfernt). Beute bleibt erhalten (2.5, 11.5). */
  private removeUnit(p: RunPlayer, why: 'left' | 'timeout' | 'kick'): void {
    if (p.unitId === null) return;
    const set = this.unitOf(p)?.hero?.activeSet;
    removeHeroUnit(this.world, p.unitId);
    p.unitId = null;
    p.pending = [];
    p.tracker.reset();
    p.needFull = true;
    p.gateReady = false;
    this.record(['rm', p.accountId, why]);
    this.updateN();
    void this.flush(p, {}, true).then(async () => {
      if (set) {
        await this.hub.ctx.db.updateTable('heroes').set({ active_set: set }).where('id', '=', p.heroId).execute()
          .catch((err: unknown) => this.hub.log.error({ err }, 'Waffensatz nicht gespeichert'));
      }
      if (why !== 'timeout' && !p.endSent && !this.ended) {
        p.endSent = true;
        this.hub.client(p.accountId)?.send(this.endMsg(p, 'abort', null));
      }
      this.hub.heroChanged(p.heroId);
    });
    this.hub.partyChanged(this.party);
    this.afterLeave();
  }

  /** Nach dem Verlassen: leerer Run endet bzw. wartet auf Rückkehrer (2.4). */
  private afterLeave(): void {
    if (this.ended || this.finishing) return;
    if (this.joined().length > 0) {
      this.checkGate();
      return;
    }
    const waiting = [...this.players.values()].some((p) => p.wantsRejoin);
    const waitingConnected = [...this.players.values()].some((p) => p.wantsRejoin && p.connected);
    if (waitingConnected) {
      this.restartAtCheckpoint();
      return;
    }
    if (!waiting) {
      void this.end('left');
      return;
    }
    // Alle getrennt: anhalten, bis jemand zurückkommt oder die Frist abläuft
    this.scenario.wipe(this.world);
    this.world.paused = true;
  }

  // ---------- Befehle der Spieler ----------

  private player(accountId: number): RunPlayer {
    const p = this.players.get(accountId);
    if (!p || p.unitId === null) fail('CONFLICT', 'Du bist gerade nicht im Run.');
    return p;
  }

  /** Erste Eingabe beendet den Autopilot eines nicht bereiten Spielers (11.3). */
  private takeOver(p: RunPlayer): void {
    if (!p.autopilot) return;
    p.autopilot = false;
    const u = this.unitOf(p);
    if (u?.hero && p.connected) u.hero.connected = true;
  }

  input(accountId: number, m: RunInputMsg): void {
    const p = this.players.get(accountId);
    if (!p || p.unitId === null) return;
    this.takeOver(p);
    if (p.pending.length >= MAX_PENDING_INPUTS) p.pending.shift();
    p.pending.push(toInput(m));
    p.lastSeq = Math.max(p.lastSeq, m.seq);
  }

  autocast(accountId: number, skillId: string, on: boolean): void {
    const p = this.player(accountId);
    const sk = this.unitOf(p)?.hero?.skills.find((s) => s.def.id === skillId);
    if (!sk || sk.slot === 'passive' || sk.slot === 'auto') fail('BAD_REQUEST', 'Diese Fähigkeit hat keinen Auto-Cast.');
    sk.autocast = on;
    this.takeOver(p);
    this.record(['ac', accountId, skillId, on]);
  }

  /** Einstellungen aus dem Run oder per HTTP (E-023). */
  applySettings(accountId: number, s: { autocast?: Record<string, boolean>; autoPotion?: boolean; autoDodge?: boolean }): void {
    const p = this.players.get(accountId);
    const h = p ? this.unitOf(p)?.hero : undefined;
    if (!p || !h) return;
    for (const [id, on] of Object.entries(s.autocast ?? {})) {
      const sk = h.skills.find((x) => x.def.id === id);
      if (sk && sk.slot !== 'passive' && sk.slot !== 'auto') sk.autocast = on;
    }
    if (s.autoPotion !== undefined) h.autoPotion = s.autoPotion;
    if (s.autoDodge !== undefined) h.autoDodge = s.autoDodge;
    this.record(['set', accountId, s]);
  }

  ping(accountId: number, kind: 'hint' | 'danger' | 'help', x: number, y: number): void {
    const p = this.player(accountId);
    this.publicQueue.push({ e: 'ping', from: p.unitId!, kind, x: Math.round(x), y: Math.round(y) });
  }

  /** Autowalk umschalten: nur der Anführer (9.2, 11.2). */
  autowalk(accountId: number, on: boolean): void {
    this.player(accountId);
    if (this.party.leader !== accountId) fail('FORBIDDEN', 'Nur der Anführer schaltet den Autowalk.');
    this.scenario.setAutowalk(on);
    this.record(['aw', on]);
  }

  /** Pause nur im Solo-Modus (11.6). */
  pause(accountId: number, on: boolean): void {
    this.player(accountId);
    if (!this.solo) fail('FORBIDDEN', 'Pause gibt es nur im Solo-Modus.');
    this.world.paused = on;
    this.pausedAt = on ? this.hub.now() : null;
    this.autoPaused = false;
    this.record(['pause', on]);
  }

  /** Bereitschaft am Boss-Tor (10.1): Countdown, sobald alle verbundenen Spieler bereit sind. */
  ready(accountId: number): void {
    const p = this.player(accountId);
    if (this.scenario.phase !== 'gate') return;
    p.gateReady = true;
    this.takeOver(p);
    this.record(['ready', accountId]);
    this.checkGate();
  }

  private checkGate(): void {
    if (this.scenario.phase !== 'gate') return;
    const js = this.joined();
    if (js.length > 0 && js.every((p) => p.gateReady || !p.connected)) this.scenario.confirmBossReady();
  }

  /** Run verlassen (11.5): Beute bleibt, Wiedereinstieg nur an Checkpoints. */
  leave(accountId: number, why: 'left' | 'kick' = 'left'): void {
    const p = this.players.get(accountId);
    if (!p) return;
    p.wantsRejoin = false;
    if (p.unitId !== null) this.removeUnit(p, why);
    else this.afterLeave();
  }

  /** Wiedereinstieg an- oder abmelden. */
  rejoin(accountId: number, on: boolean): void {
    const p = this.players.get(accountId);
    if (!p) fail('CONFLICT', 'Du warst in diesem Run nicht dabei.');
    if (p.unitId !== null) return;
    p.wantsRejoin = on;
    if (on && this.joined().length === 0) this.restartAtCheckpoint();
    this.hub.partyChanged(this.party);
  }
}
