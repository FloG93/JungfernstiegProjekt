// Gateway (2.3, 11.1, 11.9, 15.3): Verbindungen, hello, Prüfung und Rate-Limits, Online-Liste, Takt für Runs und Lobby.
import { randomInt } from 'node:crypto';
import { ClientMsgSchema, PROTOCOL_VERSION } from '@aethra/shared';
import type { ClientMsg, OnlineEntry } from '@aethra/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { AppCtx } from '../context';
import { ownHero, setSettings } from '../game/heroes';
import { ApiError, fail } from '../http/errors';
import { CLOSE_PROTOCOL, CLOSE_REPLACED, CLOSE_SHUTDOWN, Client } from './client';
import type { Sock } from './client';
import type { Clock } from './clock';
import { loadHeroInfo } from './heroinfo';
import type { HeroInfo } from './heroinfo';
import type { HubApi } from './hubapi';
import { Lobby } from './party';
import type { Party } from './party';
import type { EndReason, RunInstance } from './run';

const MS_PER_S = 1000;
/** Seeds der Runs (mulberry32, 32 Bit). */
const SEED_RANGE = 0x1_0000_0000;
/** Höchstens so viele nachgeholte Ticks je Durchlauf; größerer Rückstand wird verworfen. */
const MAX_CATCHUP_TICKS = 4;

type RunMsg = Exclude<Extract<ClientMsg, { t: `run.${string}` }>, { t: 'run.next' }>;

export interface SessionLike {
  accountId: number;
  username: string;
}

export interface HeroSettingsChange {
  autocast?: Record<string, boolean>;
  autoPotion?: boolean;
  autoDodge?: boolean;
  autoContinue?: boolean;
}

function isRunMsg(m: ClientMsg): m is RunMsg {
  return m.t.startsWith('run.') && m.t !== 'run.next';
}

export class Hub implements HubApi {
  private readonly clients = new Map<number, Client>();
  private readonly infos = new Map<number, HeroInfo>();
  private readonly runs = new Set<RunInstance>();
  readonly lobby: Lobby;
  private nextClientId = 1;
  private stopLoop: (() => void) | null = null;
  private lastPresence = '';
  private loops = 0;
  private readonly tickMs: number;

  /**
   * @param newSeed Seed je Run; zufällig, in Tests eine feste Folge, damit Abläufe reproduzierbar sind.
   */
  constructor(
    readonly ctx: AppCtx,
    private readonly clock: Clock,
    readonly log: FastifyBaseLogger,
    readonly newSeed: () => number = () => randomInt(SEED_RANGE),
  ) {
    this.lobby = new Lobby(this);
    // TICK_RATE (2.8) bestimmt den Takt in Echtzeit; ein Tick rechnet immer tickMs Simulationszeit (OPEN-038)
    this.tickMs = MS_PER_S / (ctx.config.tickRate > 0 ? ctx.config.tickRate : ctx.content.balance.combat.tickRate);
  }

  now(): number {
    return this.clock.now();
  }

  start(): void {
    if (!this.stopLoop) this.stopLoop = this.clock.every(this.tickMs, () => this.loop());
  }

  /** Serverende (2.5, 11.10): laufende Runs brechen ab, erhaltene Beute bleibt. */
  async stop(): Promise<void> {
    this.stopLoop?.();
    this.stopLoop = null;
    await Promise.all([...this.runs].map((r) => r.end('server')));
    for (const c of this.clients.values()) c.close(CLOSE_SHUTDOWN, 'Server startet neu');
    this.clients.clear();
  }

  // ---------- HubApi ----------

  client(accountId: number): Client | undefined {
    const c = this.clients.get(accountId);
    return c && c.hello && !c.closed ? c : undefined;
  }

  info(heroId: number): HeroInfo | undefined {
    return this.infos.get(heroId);
  }

  async refreshInfo(heroId: number): Promise<HeroInfo | undefined> {
    try {
      const i = await loadHeroInfo(this.ctx.game, heroId);
      this.infos.set(heroId, i);
      return i;
    } catch {
      this.infos.delete(heroId);
      return undefined;
    }
  }

  runEnded(run: RunInstance, reason: EndReason, next: number | null): void {
    this.runs.delete(run);
    this.lobby.runEnded(run, reason, next);
    this.log.info({ runId: run.id, reason, ms: run.world.t }, 'Run beendet');
  }

  partyChanged(party: Party): void {
    this.lobby.broadcast(party);
  }

  heroChanged(heroId: number): void {
    void this.refreshInfo(heroId).then((i) => {
      const p = i ? this.lobby.partyOf(i.accountId) : undefined;
      if (p) this.lobby.broadcast(p);
    });
  }

  addRun(run: RunInstance): void {
    this.runs.add(run);
  }

  runCount(): number {
    return this.runs.size;
  }

  isHeroInRun(heroId: number): boolean {
    for (const r of this.runs) if (r.hasHero(heroId)) return true;
    return false;
  }

  // ---------- Verbindungen ----------

  /** Neue Verbindung. Eine bestehende des Kontos wird ersetzt, der Held übernommen (11.9). */
  connect(sock: Sock, s: SessionLike): Client {
    const old = this.clients.get(s.accountId);
    if (old) {
      old.close(CLOSE_REPLACED, 'Neue Verbindung');
      this.dropped(old);
    }
    const cl = new Client(this.nextClientId++, s.accountId, s.username, sock, this.now());
    this.clients.set(s.accountId, cl);
    return cl;
  }

  disconnect(cl: Client): void {
    cl.closed = true;
    if (this.clients.get(cl.accountId) !== cl) return;
    this.clients.delete(cl.accountId);
    this.dropped(cl);
  }

  private dropped(cl: Client): void {
    if (cl.hello) {
      cl.hello = false;
      this.lobby.onDisconnect(cl.accountId);
      this.presenceTick();
    }
  }

  /** Eingang einer Nachricht: Rate-Limit, JSON, Zod (11.9). Ungültiges wird verworfen und geloggt. */
  message(cl: Client, raw: string): void {
    if (cl.closed) return;
    if (!this.ctx.limiter.allow(`msg:${cl.accountId}`, 'msg')) return;
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      this.log.warn({ account: cl.accountId }, 'WS: Nachricht ist kein JSON');
      return;
    }
    const r = ClientMsgSchema.safeParse(data);
    if (!r.success) {
      this.log.warn({ account: cl.accountId, issue: r.error.issues[0]?.message }, 'WS: ungültige Nachricht');
      cl.send({ t: 'error', code: 'BAD_REQUEST', message: 'Ungültige Nachricht.' });
      return;
    }
    const msg = r.data;
    cl.lastActiveAt = this.now();
    if (isRunMsg(msg)) {
      // Run-Befehle wirken sofort im nächsten Tick, ohne auf Datenbankarbeit der Lobby zu warten
      if (!cl.hello) return;
      try {
        this.runMsg(cl, msg);
      } catch (err) {
        this.report(cl, err);
      }
      return;
    }
    cl.queue = cl.queue.then(() => this.lobbyMsg(cl, msg)).catch((err: unknown) => this.report(cl, err));
  }

  private report(cl: Client, err: unknown): void {
    if (err instanceof ApiError) {
      cl.send({ t: 'error', code: err.code, message: err.message });
      return;
    }
    this.log.error({ err, account: cl.accountId }, 'WS: Fehler bei der Verarbeitung');
    cl.send({ t: 'error', code: 'CONFLICT', message: 'Interner Fehler, bitte erneut versuchen.' });
  }

  private async hello(cl: Client, v: number, heroId: number): Promise<void> {
    if (v !== PROTOCOL_VERSION) {
      cl.send({ t: 'error', code: 'BAD_REQUEST', message: `Protokollversion ${v} passt nicht (erwartet ${PROTOCOL_VERSION}).` });
      cl.close(CLOSE_PROTOCOL, 'Protokollversion');
      this.disconnect(cl);
      return;
    }
    const party = this.lobby.partyOf(cl.accountId);
    const rp = party?.run?.players.get(cl.accountId);
    // Im Run bleibt der Held derselbe, auch wenn der Client einen anderen meldet
    const hero = rp && (rp.unitId !== null || rp.joining) ? rp.heroId : heroId;
    await ownHero(this.ctx.game, cl.accountId, hero, false);
    if (cl.closed) return;
    cl.heroId = hero;
    cl.hello = true;
    await this.refreshInfo(hero);
    cl.send({
      t: 'welcome', v: PROTOCOL_VERSION, serverTime: this.now(), contentHash: this.ctx.contentFiles.hash,
      accountId: cl.accountId, heroId: hero, reconnected: !!party,
    });
    cl.send({ t: 'presence', list: this.online() });
    this.lobby.onHello(cl);
    this.presenceTick();
  }

  private async lobbyMsg(cl: Client, msg: ClientMsg): Promise<void> {
    if (cl.closed) return;
    if (msg.t === 'hello') {
      await this.hello(cl, msg.v, msg.heroId);
      return;
    }
    if (!cl.hello) fail('UNAUTHORIZED', 'Bitte zuerst anmelden (hello).');
    const L = this.lobby;
    switch (msg.t) {
      case 'party.create':
        L.create(cl);
        break;
      case 'party.join':
        L.join(cl, msg.code);
        break;
      case 'party.invite':
        L.invite(cl, msg.targetAccountId);
        break;
      case 'party.answer':
        L.answer(cl, msg.inviteId, msg.accept);
        break;
      case 'party.leave':
        L.leave(cl.accountId, 'leave');
        break;
      case 'party.kick':
        L.kick(cl, msg.targetAccountId);
        break;
      case 'party.setStage':
        L.setStage(cl, msg.stage);
        break;
      case 'party.ready':
        L.ready(cl, msg.ready);
        break;
      case 'party.start':
        L.start(cl);
        break;
      case 'party.chat':
        L.chat(cl, msg.text);
        break;
      case 'party.autoContinue':
        await L.setAutoContinue(cl, msg.on);
        break;
      case 'run.next':
        L.next(cl, msg.stage);
        break;
      default:
        break;
    }
    this.presenceTick();
  }

  private runMsg(cl: Client, msg: RunMsg): void {
    const run = this.lobby.partyOf(cl.accountId)?.run ?? null;
    const acc = cl.accountId;
    if (msg.t === 'run.input') {
      if (!this.ctx.limiter.allow(`input:${acc}`, 'input')) return;
      run?.input(acc, msg);
      return;
    }
    if (!run) fail('CONFLICT', 'Du bist gerade nicht im Run.');
    switch (msg.t) {
      case 'run.autocast':
        run.autocast(acc, msg.skillId, msg.on);
        this.persist(cl, { autocast: { [msg.skillId]: msg.on } });
        break;
      case 'run.settings': {
        const s: HeroSettingsChange = {};
        if (msg.autoPotion !== undefined) s.autoPotion = msg.autoPotion;
        if (msg.autoDodge !== undefined) s.autoDodge = msg.autoDodge;
        run.applySettings(acc, s);
        this.persist(cl, s);
        break;
      }
      case 'run.ping':
        if (!this.ctx.limiter.allow(`ping:${acc}`, 'chat')) fail('RATE_LIMITED', 'Ein Ping pro Sekunde.');
        run.ping(acc, msg.kind, msg.x, msg.y);
        break;
      case 'run.autowalk':
        run.autowalk(acc, msg.on);
        break;
      case 'run.pause':
        run.pause(acc, msg.on);
        break;
      case 'run.ready':
        run.ready(acc);
        break;
      case 'run.leave':
        run.leave(acc);
        break;
      case 'run.rejoin':
        run.rejoin(acc, msg.on);
        break;
    }
  }

  private persist(cl: Client, s: HeroSettingsChange): void {
    if (cl.heroId === null) return;
    void setSettings(this.ctx.game, cl.accountId, cl.heroId, s)
      .catch((err: unknown) => this.log.error({ err }, 'Einstellung nicht gespeichert'));
  }

  // ---------- Online-Liste (11.1) ----------

  online(): OnlineEntry[] {
    const now = this.now();
    const away = this.ctx.content.balance.session.awayAfterS * MS_PER_S;
    const list: OnlineEntry[] = [];
    for (const c of this.clients.values()) {
      if (!c.hello || c.closed) continue;
      const info = c.heroId !== null ? this.infos.get(c.heroId) : undefined;
      const run = this.lobby.partyOf(c.accountId)?.run;
      const inRun = !!run && run.hasHero(c.heroId ?? -1);
      // In einer Stage gibt es keinen Abwesend-Status (Auto-Cast hält den Helden im Kampf)
      const status: OnlineEntry['status'] = inRun ? (run.inArena ? 'boss' : 'stage') : now - c.lastActiveAt >= away ? 'abwesend' : 'lager';
      const e: OnlineEntry = {
        accountId: c.accountId, username: c.username, heroName: info?.name ?? null, classId: info?.classId ?? null,
        level: info?.level ?? null, status,
      };
      if (inRun) e.stage = run.stage;
      list.push(e);
    }
    return list.sort((a, b) => a.username.localeCompare(b.username, 'de'));
  }

  private presenceTick(): void {
    const json = JSON.stringify({ t: 'presence', list: this.online() });
    if (json === this.lastPresence) return;
    this.lastPresence = json;
    for (const c of this.clients.values()) if (c.hello) c.sendRaw(json);
  }

  // ---------- Anbindung an HTTP ----------

  onActivity(accountId: number): void {
    const c = this.clients.get(accountId);
    if (c) c.lastActiveAt = this.now();
  }

  onHeroChanged(heroId: number): void {
    this.heroChanged(heroId);
  }

  onSettingsChanged(heroId: number, s: HeroSettingsChange): void {
    for (const r of this.runs) {
      for (const p of r.players.values()) if (p.heroId === heroId) r.applySettings(p.accountId, s);
    }
    if (s.autoContinue !== undefined) {
      const acc = this.infos.get(heroId)?.accountId;
      const p = acc !== undefined ? this.lobby.partyOf(acc) : undefined;
      if (p && p.leader === acc) {
        p.autoContinue = s.autoContinue;
        if (!s.autoContinue) p.autoContinueAt = null;
        this.lobby.broadcast(p);
      }
    }
  }

  // ---------- Takt ----------

  private loop(): void {
    const now = this.now();
    for (const run of [...this.runs]) {
      let n = 0;
      while (!run.ended && now >= run.nextTickAt && n < MAX_CATCHUP_TICKS) {
        try {
          run.tick(now);
        } catch (err) {
          this.log.error({ err, runId: run.id }, 'Tick fehlgeschlagen, Run wird beendet');
          void run.end('server');
          break;
        }
        run.nextTickAt += this.tickMs;
        n++;
      }
      if (now - run.nextTickAt > this.tickMs * MAX_CATCHUP_TICKS) run.nextTickAt = now + this.tickMs;
    }
    this.lobby.update(now);
    this.loops++;
    if (this.loops % this.ctx.content.balance.combat.tickRate === 0) {
      this.presenceTick();
      this.ctx.limiter.sweep();
    }
  }
}
