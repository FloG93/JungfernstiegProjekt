// Eine laufende Stage im Rundenkampf (ENTWURF-rundenkampf.md 1.4 und 4): gleichzeitiges Planen,
// danach rechnet der Server die ganze Runde und schickt ein Rundenprotokoll. Keine Schnappschüsse.
import { gzipSync } from 'node:zlib';
import {
  STAGE_COUNT, begegnungNeuStarten, bossBeginnen, bossReward, encounterReward, heldEntfernen, heldHinzufuegen,
  laufAnlegen, laufAufgeben, laufRunde, rollBossLoot, rollEliteItem, rollStageChest, staerkeSetzen,
} from '@aethra/shared';
import type {
  Aktion, BossId, Ereignis, Figur, HeldAufstellung, HeroSetup, Lauf, LaufEreignis, RosterEntry, RunEndMsg,
  RundenFigurDTO, RundenMichDTO, RundenPhase, RundenStartMsg, RundenZustandDTO, StageDef,
} from '@aethra/shared';
import { heroSetup } from '../game/heroes';
import { grantRewards, recordBossKill, recordStageClear } from '../game/rewards';
import type { RewardInput, RewardResult } from '../game/rewards';
import { fail } from '../http/errors';
import type { HubApi } from './hubapi';
import type { Party } from './party';
import { RunPlayer } from './spieler';
import type { RunPlayerInit } from './spieler';
import type { EndReason, LaufMsg, LaufendeStage } from './stageapi';

const MS_PER_S = 1000;
const PROZENT = 100;
/** Obergrenze des Protokolls für die Nachrechnung (run_log). */
const LOG_LIMIT = 200_000;

export interface RundenLaufOptionen {
  id: string;
  stage: number;
  seed: number;
  players: RunPlayerInit[];
  kampfstufe: number;
}

function aufstellung(p: RunPlayer, setup: HeroSetup): HeldAufstellung {
  const satz = setup.sets[setup.activeSet];
  return {
    dbId: setup.dbId, spielerId: String(p.accountId), name: setup.name, klasse: setup.classId, stufe: setup.level,
    werte: satz.stats, element: satz.element, autocast: { ...setup.autocast }, autoTrank: setup.autoPotion,
  };
}

export class RundenLauf implements LaufendeStage {
  readonly id: string;
  readonly stage: number;
  readonly seed: number;
  readonly def: StageDef;
  readonly lauf: Lauf;
  readonly players = new Map<number, RunPlayer>();
  readonly startedAt: number;
  nextTickAt: number;
  ended = false;
  private finishing = false;
  /** Ende des laufenden Planungsfensters (Serverzeit), null außerhalb der Planung. */
  private planungBis: number | null = null;
  private readonly wahlen = new Map<number, Aktion>();
  private readonly log: unknown[] = [];
  private logId: number | null = null;
  private lastConnectedAt: number;
  private pausedAt: number | null = null;
  private torSeit: number | null = null;
  private readonly solo: boolean;
  private readonly kampfstufe: number;
  private readonly taktProSekunde: number;
  private takte = 0;

  constructor(private readonly hub: HubApi, readonly party: Party, o: RundenLaufOptionen) {
    const c = hub.ctx.content;
    this.id = o.id;
    this.stage = o.stage;
    this.seed = o.seed;
    this.kampfstufe = o.kampfstufe;
    this.solo = o.players.length === 1;
    const spieler = o.players.map((init) => new RunPlayer(init, o.seed));
    for (const p of spieler) this.players.set(p.accountId, p);
    this.lauf = laufAnlegen({
      content: c, seed: o.seed, stage: o.stage, kampfstufe: o.kampfstufe,
      helden: spieler.map((p) => aufstellung(p, p.setup)),
    });
    this.def = this.lauf.def;
    for (const p of spieler) {
      // Im Rundenkampf wechseln die Figuren-IDs mit jeder Begegnung. `unitId` heißt hier darum nur
      // „steckt im Lauf" und trägt die Helden-ID; die Figur der laufenden Begegnung liefert figurVon (OPEN-066).
      p.unitId = p.heroId;
      // Wer beim Start nicht bereit war, spielt im Auto-Kampf weiter, bis er eingreift (11.3)
      p.auto = p.autopilot;
    }
    const now = hub.now();
    this.startedAt = now;
    this.lastConnectedAt = now;
    this.taktProSekunde = c.balance.combat.tickRate;
    this.nextTickAt = now + MS_PER_S / this.taktProSekunde;
    this.staerke();
  }

  // ---------- Zugriff ----------

  get inArena(): boolean {
    return this.lauf.phase === 'boss' || this.lauf.phase === 'tor';
  }

  get zeitMs(): number {
    return this.lauf.kampf.runde * this.hub.ctx.content.runden.rundeSekunden * MS_PER_S;
  }

  private figurVon(p: RunPlayer): Figur | undefined {
    return this.lauf.kampf.figuren.find((f) => f.dbId === p.heroId);
  }

  hasHero(heroId: number): boolean {
    for (const p of this.players.values()) if (p.heroId === heroId && (p.unitId !== null || p.joining)) return true;
    return false;
  }

  /** Spieler, die mit einem Helden im Lauf stehen. */
  joined(): RunPlayer[] {
    return [...this.players.values()].filter((p) => p.unitId !== null);
  }

  private record(entry: unknown[]): void {
    if (this.log.length < LOG_LIMIT) this.log.push([this.lauf.kampf.runde, ...entry]);
  }

  private staerke(): void {
    staerkeSetzen(this.lauf, this.joined().filter((p) => p.connected).length);
  }

  // ---------- Zustand für die Oberfläche ----------

  private figurDto(f: Figur): RundenFigurDTO {
    const p = f.dbId !== undefined ? [...this.players.values()].find((x) => x.heroId === f.dbId) : undefined;
    const schild = f.schilde.reduce((n, s) => n + s.menge, 0);
    const d: RundenFigurDTO = {
      id: f.id, seite: f.seite, art: f.art, reihe: f.reihe, name: f.name, stufe: f.stufe, lp: Math.round(f.lp),
      maxLp: f.maxLp, energie: Math.round(f.energie), element: f.element, tot: f.tot, verteidigt: f.verteidigt,
      schild: Math.round(schild),
      status: f.status.map((s) => ({ id: s.anzeige ?? s.id, runden: s.runden, stapel: s.stapel })),
    };
    if (f.klasse) d.klasse = f.klasse;
    if (f.typ) d.typ = f.typ;
    if (f.elite) d.elite = true;
    if (p) {
      d.accountId = p.accountId;
      d.heroId = p.heroId;
    }
    if (f.zielId !== null) d.ziel = f.zielId;
    if (f.boss) {
      d.bossPhase = f.boss.phase;
      if (f.boss.ansage) d.ansage = { ...f.boss.ansage };
    }
    return d;
  }

  private phase(): RundenPhase {
    const ph = this.lauf.phase;
    if (ph === 'gewonnen' || ph === 'verloren' || ph === 'tor') return ph;
    return 'planung';
  }

  private michDto(p: RunPlayer): RundenMichDTO {
    const f = this.figurVon(p);
    return {
      figurId: this.figurVon(p)?.id ?? null, heroId: p.heroId, traenke: f?.traenke ?? 0, trankAbkling: f?.trankAbkling ?? 0,
      abkling: { ...(f?.abkling ?? {}) }, autocast: { ...(f?.autocast ?? {}) }, autoTrank: f?.autoTrank ?? false,
      auto: p.auto, helper: p.helper, gewaehlt: this.wahlen.has(p.accountId), bereit: p.gateReady,
    };
  }

  private zustand(p?: RunPlayer): RundenZustandDTO {
    const k = this.lauf.kampf;
    const now = this.hub.now();
    const c = this.hub.ctx.content;
    const z: RundenZustandDTO = {
      // Gefallene Gegner fallen aus dem Zustand: Ihren Tod hat das Protokoll schon gemeldet, und über
      // einen langen Kampf mit Adds würde die Liste sonst immer weiter wachsen (OPEN-064)
      phase: this.phase(), runde: k.runde,
      figuren: k.figuren.filter((f) => !f.tot || f.seite === 'held').map((f) => this.figurDto(f)),
      reihenfolge: [...k.reihenfolge], index: this.lauf.index, begegnungen: this.def.encounters.length,
      checkpoint: this.lauf.checkpoint, wipes: this.lauf.wipes, kampfstufe: this.kampfstufe,
      gegenBoss: k.gegenBoss, reserve: k.reserve.length,
      planungIn: this.planungBis === null ? null : Math.max(0, this.planungBis - now),
      gewaehlt: [...this.wahlen.keys()],
      bereit: this.joined().filter((x) => x.gateReady).map((x) => x.accountId),
      autoBereitIn: this.lauf.phase === 'tor' && this.party.autoContinue && this.torSeit !== null
        ? Math.max(0, this.torSeit + c.engine.idle.autoContinueDelayS * MS_PER_S - now) : null,
    };
    if (p) z.mich = this.michDto(p);
    return z;
  }

  private roster(): RosterEntry[] {
    return this.joined().map((p) => ({
      unitId: this.figurVon(p)?.id ?? p.heroId, accountId: p.accountId, heroId: p.heroId, name: p.name,
      classId: p.classId, level: p.level, helper: p.helper,
    }));
  }

  private sendStart(p: RunPlayer): void {
    const cl = this.hub.client(p.accountId);
    if (!cl || p.unitId === null) return;
    const c = this.hub.ctx.content;
    const msg: RundenStartMsg = {
      t: 'runde.start', runId: this.id, seed: this.seed, stage: this.stage, roster: this.roster(), n: this.lauf.n,
      config: {
        rundeSekunden: c.runden.rundeSekunden, planungS: c.runden.planung.standardS, maxRunden: c.runden.maxRunden,
        bossId: this.def.boss ?? null, introId: this.def.introId,
      },
      zustand: this.zustand(p),
    };
    cl.send(msg);
  }

  /** Jeder Spieler bekommt denselben Verlauf, aber seinen eigenen „mich"-Teil. */
  private sendeProtokoll(runde: number, ereignisse: (Ereignis | LaufEreignis)[]): void {
    for (const p of this.players.values()) {
      if (p.unitId === null) continue;
      this.hub.client(p.accountId)?.send({
        t: 'runde.protokoll', runde, ereignisse, zustand: this.zustand(p),
      });
    }
  }

  private sendePlan(): void {
    for (const p of this.players.values()) {
      if (p.unitId === null) continue;
      this.hub.client(p.accountId)?.send({ t: 'runde.plan', runde: this.lauf.kampf.runde + 1, zustand: this.zustand(p) });
    }
  }

  // ---------- Start und Ende ----------

  async open(): Promise<void> {
    const r = await this.hub.ctx.db.insertInto('run_log').values({
      seed: this.seed, stage: this.stage, started_at: this.startedAt,
      party: JSON.stringify([...this.players.values()].map((p) => ({ account: p.accountId, hero: p.heroId, cls: p.classId, level: p.level }))),
    }).returning('id').executeTakeFirstOrThrow();
    this.logId = r.id;
    this.planungOeffnen(false);
    for (const p of this.players.values()) this.sendStart(p);
  }

  private nextStage(): number {
    return Math.min(STAGE_COUNT, this.stage + 1);
  }

  private endMsg(p: RunPlayer, result: 'win' | 'abort', next: number | null): RunEndMsg {
    const t = p.totals;
    const auto = result === 'win' && next !== null && this.party.autoContinue
      ? this.hub.ctx.content.engine.idle.autoContinueDelayS * MS_PER_S : null;
    return {
      t: 'run.end', result, stage: this.stage, xp: t.xp, weaponXp: t.weaponXp, gold: t.gold, loot: t.items,
      gems: t.gems, splinters: t.splinters, levelUps: t.levelUps, weaponLevelUps: t.weaponLevelUps,
      autoSold: t.autoSold, artifactUnlocked: t.artifactUnlocked, helper: p.helper, firstClear: !p.repeat,
      timeMs: this.zeitMs, next: result === 'win' ? next : null, autoContinueIn: auto,
    };
  }

  async end(reason: EndReason): Promise<void> {
    if (this.ended) return;
    this.ended = true;
    this.planungBis = null;
    const ps = [...this.players.values()];
    await Promise.all(ps.map((p) => this.flush(p, {}, true)));
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
    this.planungBis = null;
    const c = this.hub.ctx.content;
    const g = this.hub.ctx.game;
    const bossId: BossId | null = this.def.boss ?? null;
    const gegenBoss = bossId !== null && this.lauf.kampf.gegenBoss;
    const zeit = this.zeitMs;
    const jobs = this.joined().map(async (p) => {
      const extra: RewardInput = {};
      if (gegenBoss) {
        if (!p.helper) {
          const l = rollBossLoot(c, p.lootRng, { classId: p.classId, bossId: bossId!, first: p.first, beutestufe: p.kampfstufe });
          const r = bossReward(c, this.stage, p.first, false);
          Object.assign(extra, { xp: r.xp, gold: r.gold, items: l.items, gems: l.gems, splinters: l.splinters, artifactUnlock: l.artifactUnlock });
        }
      } else {
        const l = rollStageChest(c, p.lootRng, p.classId, this.stage);
        Object.assign(extra, { items: l.items, gems: l.gems, splinters: l.splinters });
      }
      await this.flush(p, extra, true);
      p.chain = p.chain.then(async () => {
        await recordStageClear(g, p.heroId, this.stage, zeit);
        if (gegenBoss && !p.helper) await recordBossKill(g, p.heroId, bossId!, p.first);
      }).catch((err: unknown) => this.hub.log.error({ err, runId: this.id }, 'Abschluss nicht gespeichert'));
      await p.chain;
    });
    await Promise.all(jobs);
    await this.end('win');
  }

  // ---------- Belohnungen ----------

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
    p.chain = p.chain.then(async () => {
      const res = await grantRewards(this.hub.ctx.game, p.heroId, r, p.setup.activeSet);
      p.add(res);
      onDone?.(res);
      if (res.levelUps.length > 0 || res.weaponLevelUps.length > 0) await this.refreshHero(p, res.levelUps.length > 0);
    }).catch((err: unknown) => this.hub.log.error({ err, runId: this.id, heroId: p.heroId }, 'Belohnung nicht gespeichert'));
    return p.chain;
  }

  /**
   * Nach einem Stufenaufstieg (12.1) neue Werte übernehmen. Die laufende Figur behält ihren
   * Lebensanteil; die höheren Werte zählen ab der nächsten Begegnung (OPEN-066).
   */
  private async refreshHero(p: RunPlayer, levelUp: boolean): Promise<void> {
    const setup = await heroSetup(this.hub.ctx.game, p.heroId, String(p.accountId));
    p.setup = setup;
    p.level = setup.level;
    if (this.ended) return;
    const i = this.lauf.helden.findIndex((h) => h.dbId === p.heroId);
    if (i >= 0) this.lauf.helden[i] = aufstellung(p, setup);
    if (levelUp) {
      const b = this.hub.ctx.content.balance.stats.levelUpHealPct;
      const anteil = this.lauf.anteile.get(p.heroId) ?? PROZENT;
      this.lauf.anteile.set(p.heroId, Math.min(PROZENT, anteil + b));
    }
    this.hub.heroChanged(p.heroId);
  }

  private onReward(index: number, frac: number): void {
    const c = this.hub.ctx.content;
    for (const p of this.joined()) {
      const r = encounterReward(c, this.def, index, frac, p.repeat);
      p.potXp += r.xp;
      p.potGold += r.gold;
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

  // ---------- Runden ----------

  /** Neues Planungsfenster (ENTWURF 1.4): alle wählen gleichzeitig. */
  private planungOeffnen(melden = true): void {
    if (this.ended || this.finishing || this.lauf.phase !== 'kampf' && this.lauf.phase !== 'boss') {
      this.planungBis = null;
      return;
    }
    this.wahlen.clear();
    const pl = this.hub.ctx.content.runden.planung;
    // Wählt niemand selbst (Auto-Kampf, alle getrennt), läuft die Runde nach einer kurzen Pause,
    // damit der Client sie abspielen kann (OPEN-067). Aufgelöst wird immer im Takt, nie sofort:
    // sonst würde ein Auto-Kampf die ganze Stage in einem Aufruf durchrechnen.
    const selbst = this.joined().some((p) => p.connected && !p.auto);
    this.planungBis = this.hub.now() + (selbst ? pl.standardS : pl.autoS) * MS_PER_S;
    if (melden) this.sendePlan();
  }

  /** Haben alle, die selbst wählen wollen, gewählt? Dann läuft die Runde sofort. */
  private pruefeVollstaendig(): void {
    if (this.planungBis === null || this.pausedAt !== null) return;
    const offen = this.joined().filter((p) => p.connected && !p.auto && !this.wahlen.has(p.accountId));
    if (offen.length === 0) this.rundeAbhandeln();
  }

  private rundeAbhandeln(): void {
    if (this.ended || this.finishing || this.pausedAt !== null) return;
    this.planungBis = null;
    const wahlen = new Map<number, Aktion>();
    for (const [accountId, a] of this.wahlen) {
      const p = this.players.get(accountId);
      if (p?.unitId !== null && p?.unitId !== undefined) wahlen.set(p.unitId, a);
    }
    if (wahlen.size > 0) this.record(['wahl', [...wahlen.entries()]]);
    const runde = this.lauf.kampf.runde + 1;
    const ereignisse = laufRunde(this.lauf, wahlen);
    this.wahlen.clear();
    this.verarbeite(ereignisse);
    this.planungOeffnen(false);
    this.sendeProtokoll(runde, ereignisse);
  }

  /** Ereignisse der Runde in Belohnungen, Tor und Abschluss übersetzen (12.3, 10.1). */
  private verarbeite(evs: (Ereignis | LaufEreignis)[]): void {
    for (const ev of evs) {
      if (!('e' in ev)) continue;
      switch (ev.e) {
        case 'tod': {
          const f = this.lauf.kampf.figuren.find((x) => x.id === ev.id);
          if (f?.seite === 'gegner' && f.elite) this.onEliteLoot();
          break;
        }
        case 'begegnungEnde':
          this.onReward(ev.index ?? 0, ev.anteil ?? 1);
          for (const p of this.joined()) void this.flush(p, {});
          break;
        case 'checkpoint':
        case 'wipe':
          this.rejoinWaiting();
          break;
        case 'tor':
          this.torSeit = this.hub.now();
          for (const p of this.players.values()) p.gateReady = false;
          this.rejoinWaiting();
          break;
        case 'stageEnde':
          if (ev.ergebnis === 'sieg') void this.finish();
          break;
        default:
          break;
      }
    }
  }

  // ---------- Takt ----------

  tick(now: number): void {
    if (this.ended || this.finishing) return;
    if (this.planungBis !== null && now >= this.planungBis && this.pausedAt === null) this.rundeAbhandeln();
    this.takte++;
    if (this.takte % this.taktProSekunde === 0) this.housekeeping(now);
  }

  /** Fristen einmal pro Sekunde: Autopilot, leerer Run, Solo-Pause, Auto-Weiter am Boss-Tor. */
  private housekeeping(now: number): void {
    const c = this.hub.ctx.content;
    const grace = c.balance.net.disconnectGraceS * MS_PER_S;
    for (const p of this.joined()) {
      if (!p.connected && this.pausedAt === null && now - p.disconnectedAt >= grace) {
        p.wantsRejoin = true;
        this.heldWeg(p, 'timeout');
      }
    }
    const anyConnected = [...this.players.values()].some((p) => p.connected && (p.unitId !== null || p.wantsRejoin));
    if (anyConnected || (this.solo && this.pausedAt !== null)) this.lastConnectedAt = now;
    else if (now - this.lastConnectedAt >= c.balance.net.emptyRunTimeoutS * MS_PER_S) {
      void this.end('empty');
      return;
    }
    if (this.pausedAt !== null && now - this.pausedAt >= c.balance.session.soloPauseMaxS * MS_PER_S) {
      void this.end('pause');
      return;
    }
    if (this.lauf.phase === 'tor' && this.party.autoContinue && this.torSeit !== null
      && now - this.torSeit >= c.engine.idle.autoContinueDelayS * MS_PER_S) {
      for (const p of this.joined()) p.gateReady = true;
      this.pruefeTor();
    }
  }

  // ---------- Mitglieder ----------

  disconnect(accountId: number): void {
    const p = this.players.get(accountId);
    if (!p) return;
    p.connected = false;
    p.disconnectedAt = this.hub.now();
    this.record(['dc', accountId]);
    // Solo hält an: kein Fortschritt ohne Spieler (E-022, OPEN-029)
    if (this.solo && p.unitId !== null && this.pausedAt === null) this.pausedAt = this.hub.now();
    this.staerke();
    this.pruefeVollstaendig();
    this.pruefeTor();
  }

  connect(accountId: number): void {
    const p = this.players.get(accountId);
    if (!p) return;
    p.connected = true;
    this.lastConnectedAt = this.hub.now();
    this.record(['rc', accountId]);
    if (p.unitId !== null) {
      this.sendStart(p);
      if (this.solo && this.pausedAt !== null) {
        this.pausedAt = null;
        this.planungOeffnen();
      }
    } else if (p.wantsRejoin && this.wiedereinstiegMoeglich() && !this.ended) {
      this.rejoinWaiting();
    }
    this.staerke();
  }

  /**
   * Geht der Wiedereinstieg sofort? Am Boss-Tor wartet die Party ohnehin, und ohne Helden im Feld
   * beginnt der Lauf am Checkpoint neu. Sonst kommt der Rückkehrer am nächsten Checkpoint (11.5).
   */
  private wiedereinstiegMoeglich(): boolean {
    return this.lauf.phase === 'tor' || this.joined().length === 0;
  }

  /** Wiedereinstieg an Checkpoints, nach einem Wipe und am Boss-Tor (11.5). */
  private rejoinWaiting(): void {
    for (const p of this.players.values()) {
      if (p.unitId !== null || p.joining || !p.wantsRejoin || !p.connected || this.ended) continue;
      if (!this.party.members.some((m) => m.accountId === p.accountId)) continue;
      p.joining = true;
      void heroSetup(this.hub.ctx.game, p.heroId, String(p.accountId)).then((setup) => {
        p.joining = false;
        if (this.ended || this.finishing || !p.wantsRejoin || !p.connected) return;
        p.setup = setup;
        p.level = setup.level;
        heldHinzufuegen(this.lauf, aufstellung(p, setup));
        p.unitId = p.heroId;
        // Die laufende Begegnung wird neu aufgestellt, damit der Rückkehrer gleich mitkämpft (OPEN-066)
        begegnungNeuStarten(this.lauf);
        p.wantsRejoin = false;
        p.autopilot = false;
        p.auto = false;
        p.endSent = false;
        p.gateReady = false;
        this.record(['join', p.accountId]);
        this.staerke();
        this.sendStart(p);
        this.hub.partyChanged(this.party);
      }).catch((err: unknown) => {
        p.joining = false;
        this.hub.log.error({ err, runId: this.id }, 'Wiedereinstieg fehlgeschlagen');
      });
    }
  }

  /** Held verlässt den Lauf (Verlassen, Frist abgelaufen, entfernt). Beute bleibt erhalten (2.5, 11.5). */
  private heldWeg(p: RunPlayer, why: 'left' | 'timeout' | 'kick'): void {
    if (p.unitId === null) return;
    heldEntfernen(this.lauf, p.heroId);
    p.unitId = null;
    p.gateReady = false;
    this.wahlen.delete(p.accountId);
    this.record(['rm', p.accountId, why]);
    this.staerke();
    void this.flush(p, {}, true).then(() => {
      if (why !== 'timeout' && !p.endSent && !this.ended) {
        p.endSent = true;
        this.hub.client(p.accountId)?.send(this.endMsg(p, 'abort', null));
      }
      this.hub.heroChanged(p.heroId);
    });
    this.hub.partyChanged(this.party);
    this.afterLeave();
  }

  private afterLeave(): void {
    if (this.ended || this.finishing) return;
    if (this.joined().length > 0) {
      this.pruefeVollstaendig();
      this.pruefeTor();
      return;
    }
    const waiting = [...this.players.values()].some((p) => p.wantsRejoin);
    const waitingConnected = [...this.players.values()].some((p) => p.wantsRejoin && p.connected);
    this.planungBis = null;
    if (waitingConnected) {
      this.rejoinWaiting();
      return;
    }
    if (!waiting) void this.end('left');
  }

  // ---------- Befehle der Spieler ----------

  private player(accountId: number): RunPlayer {
    const p = this.players.get(accountId);
    if (!p || p.unitId === null) fail('CONFLICT', 'Du bist gerade nicht im Run.');
    return p;
  }

  nachricht(accountId: number, m: LaufMsg): void {
    switch (m.t) {
      case 'runde.wahl':
        this.wahl(accountId, m.runde, m.a);
        break;
      case 'runde.fertig':
        this.fertig(accountId);
        break;
      case 'runde.auto':
        this.auto(accountId, m.on);
        break;
      case 'run.settings': {
        const s: { autoPotion?: boolean } = {};
        if (m.autoPotion !== undefined) s.autoPotion = m.autoPotion;
        this.applySettings(accountId, s);
        break;
      }
      case 'run.autocast':
        this.applySettings(accountId, { autocast: { [m.skillId]: m.on } });
        break;
      case 'run.ready':
        this.bereit(accountId);
        break;
      case 'run.leave':
        this.leave(accountId);
        break;
      case 'run.rejoin':
        this.rejoin(accountId, m.on);
        break;
      default:
        fail('BAD_REQUEST', 'Diese Nachricht gibt es im Rundenkampf nicht.');
    }
  }

  /** Wahl für die kommende Runde (ENTWURF 1.4). Der Server prüft sie beim Abhandeln noch einmal. */
  wahl(accountId: number, runde: number, a: Aktion): void {
    const p = this.player(accountId);
    if (this.planungBis === null) fail('CONFLICT', 'Gerade läuft keine Planung.');
    if (runde !== this.lauf.kampf.runde + 1) fail('CONFLICT', 'Diese Runde ist schon vorbei.');
    const f = this.figurVon(p);
    if (!f || f.tot) fail('CONFLICT', 'Dein Held kann nicht handeln.');
    p.autopilot = false;
    this.wahlen.set(accountId, a);
    this.sendePlan();
    this.pruefeVollstaendig();
  }

  /** „Los!": Dieser Spieler wartet nicht länger; ohne Wahl handelt die Automatik für ihn. */
  fertig(accountId: number): void {
    const p = this.player(accountId);
    if (this.planungBis === null) return;
    if (!this.wahlen.has(accountId)) p.auto = true;
    this.pruefeVollstaendig();
  }

  /** Auto-Kampf (ENTWURF 4): Die Runde startet ohne Wahl dieses Spielers. */
  auto(accountId: number, on: boolean): void {
    const p = this.player(accountId);
    p.auto = on;
    if (on) p.autopilot = false;
    this.record(['auto', accountId, on]);
    this.sendePlan();
    this.pruefeVollstaendig();
  }

  applySettings(accountId: number, s: { autocast?: Record<string, boolean>; autoPotion?: boolean; autoDodge?: boolean }): void {
    const p = this.players.get(accountId);
    const f = p ? this.figurVon(p) : undefined;
    if (!p) return;
    const h = this.lauf.helden.find((x) => x.dbId === p.heroId);
    for (const [id, on] of Object.entries(s.autocast ?? {})) {
      if (f) f.autocast[id] = on;
      if (h) h.autocast[id] = on;
    }
    if (s.autoPotion !== undefined) {
      if (f) f.autoTrank = s.autoPotion;
      if (h) h.autoTrank = s.autoPotion;
    }
    this.record(['set', accountId, s]);
  }

  /** Bereitschaft am Boss-Tor (10.1): Der Bosskampf beginnt, sobald alle bereit sind. */
  bereit(accountId: number): void {
    const p = this.player(accountId);
    if (this.lauf.phase !== 'tor') return;
    p.gateReady = true;
    this.record(['ready', accountId]);
    this.pruefeTor();
  }

  private pruefeTor(): void {
    if (this.lauf.phase !== 'tor' || this.ended) return;
    const js = this.joined();
    if (js.length === 0 || !js.every((p) => p.gateReady || !p.connected)) return;
    bossBeginnen(this.lauf);
    this.planungOeffnen(false);
    this.sendeProtokoll(this.lauf.kampf.runde, [{ e: 'bossStart' }]);
  }

  leave(accountId: number, why: 'left' | 'kick' = 'left'): void {
    const p = this.players.get(accountId);
    if (!p) return;
    p.wantsRejoin = false;
    if (p.unitId !== null) this.heldWeg(p, why);
    else this.afterLeave();
  }

  rejoin(accountId: number, on: boolean): void {
    const p = this.players.get(accountId);
    if (!p) fail('CONFLICT', 'Du warst in diesem Run nicht dabei.');
    if (p.unitId !== null) return;
    p.wantsRejoin = on;
    if (on && this.wiedereinstiegMoeglich()) this.rejoinWaiting();
    this.hub.partyChanged(this.party);
  }

  /** Alle geben auf (9.2): Der Lauf endet verloren. */
  aufgeben(): void {
    laufAufgeben(this.lauf);
    this.planungBis = null;
    void this.end('camp');
  }
}
