// Ablauf eines Runs (9, 10.1): Autowalk, Begegnungen, Checkpoints, Gefahren, Wipe, Topf-Regel, Boss-Arena.
import type { BossId } from '../content/ids';
import type { Content } from '../content/loader';
import type { ArenaDef, StageDef } from '../content/schemas';
import { bossAttackerLevel, chapterOfStage, introFactor, refLife } from '../formulas';
import { spawnBoss } from './boss';
import { healUnit, reviveUnit } from './combat';
import { spawnEnemy } from './enemies';
import { getHandler } from './handlers';
import { planEncounter } from './spawn';
import type { EncounterPlan, PlannedEnemy } from './spawn';
import { clearStatuses } from './status';
import type { Scenario, StagePhase, Unit, Vec, World } from './types';
import { MS_PER_S, PERCENT, dist, emit, heroes, livingFoes, livingHeroes } from './util';

const EPS = 1e-9;

export interface RunConfig {
  stage: number;
  /** Eigene Stage-Definition (Messungen, zum Beispiel eine normale Stage auf Gegnerstufe 10). */
  stageDef?: StageDef;
  /** Kampfstufe des Bosskampfes (10.9): höchstes K der beute-berechtigten Spieler. */
  kampfstufe?: number;
  /** Bereitschaft vor dem Boss automatisch bestätigen (Tests und Messungen). */
  autoBossReady?: boolean;
  /** Direkt am Arena-Tor beginnen (Wiedereintritt am Checkpoint des Bosses, Tests). */
  startAtGate?: boolean;
}

interface QueuedEnemy extends PlannedEnemy {
  side: -1 | 1;
  x: number;
  y: number;
  eliteSlot?: number;
}

interface ActiveEncounter {
  idx: number;
  startedAt: number;
  plan: EncounterPlan;
  nextGroup: number;
  queue: QueuedEnemy[];
  spawnPaused: boolean;
  lastSpawnAt: number;
  hazardAt: number;
  eliteSlot: number;
}

export class RunScenario implements Scenario {
  kind: 'stage' | 'arena' = 'stage';
  readonly def: StageDef;
  readonly chapter: number;
  readonly bossId: BossId | null;
  phase: StagePhase = 'walk';
  anchorX = 0;
  autowalk = true;
  nextEnc = 0;
  readonly cleared = new Set<number>();
  checkpointIdx = -1;
  /** Ausgezahlter Anteil am Topf je Begegnung (6.8, 12.3). */
  readonly paid: number[];
  readonly eliteDropped = new Set<string>();
  active: ActiveEncounter | null = null;
  bossReady = false;
  countdownEndsAt = 0;
  bossStartedAt = 0;
  arena: ArenaDef | null = null;
  kampfstufe: number;
  wipes = 0;
  readonly autoBossReady: boolean;

  constructor(content: Content, cfg: RunConfig) {
    const def = cfg.stageDef ?? content.stages[cfg.stage - 1];
    if (!def) throw new Error(`Stage ${cfg.stage} existiert nicht`);
    this.def = def;
    this.chapter = def.chapter;
    this.bossId = def.boss ?? null;
    this.paid = def.encounters.map(() => 0);
    this.kampfstufe = cfg.kampfstufe ?? 0;
    this.autoBossReady = cfg.autoBossReady ?? false;
    this.bossReady = this.autoBossReady;
    if (cfg.startAtGate && this.bossId) {
      def.encounters.forEach((_, i) => this.cleared.add(i));
      this.nextEnc = def.encounters.length;
      this.checkpointIdx = def.checkpoints.length - 1;
      this.anchorX = def.lengthPx;
    }
  }

  // ---------- Scenario ----------

  anchor(w: World): Vec {
    const y = w.content.engine.world.bandDepthPx / 2;
    if (this.kind === 'arena' && this.arena) return { x: this.arena.heroStartX[1], y };
    return { x: this.anchorX, y };
  }

  inCombat(): boolean {
    return this.phase === 'fight' || this.phase === 'boss';
  }

  attackerLevel(w: World): number {
    return this.kind === 'arena' ? bossAttackerLevel(w.content.balance, this.chapter) : this.def.stage;
  }

  refLife(w: World): number {
    return refLife(w.content.balance, this.chapter);
  }

  bounds(w: World): { minX: number; maxX: number } {
    if (this.kind === 'arena' && this.arena) return { minX: 0, maxX: this.arena.widthPx };
    const view = w.content.engine.world.viewWidthPx;
    return { minX: -view, maxX: this.def.lengthPx + view };
  }

  /** Mitte der Kamera (14.8): sie folgt der Vorhut, leicht nach hinten versetzt. */
  cameraX(w: World): number {
    if (this.kind === 'arena' && this.arena) return this.arena.widthPx / 2;
    return this.anchorX + w.content.engine.world.cameraLeadPx;
  }

  update(w: World): void {
    switch (this.phase) {
      case 'walk':
        this.updateWalk(w);
        break;
      case 'fight':
        this.updateEncounter(w);
        break;
      case 'gate':
        if (this.bossReady) this.startCountdown(w);
        break;
      case 'countdown':
        if (w.t >= this.countdownEndsAt) this.startBossFight(w);
        break;
      default:
        break;
    }
    const hs = heroes(w);
    if (hs.length > 0 && hs.every((h) => h.dead) && this.phase !== 'won') this.wipe(w);
  }

  onDeath(w: World, u: Unit, _killer: Unit | null): void {
    if (u.kind === 'boss') {
      this.phase = 'won';
      for (const f of livingFoes(w)) f.dead = true;
      emit(w, { e: 'bossDefeated', boss: u.foe?.bossId ?? '' });
      emit(w, { e: 'stage', phase: 'won' });
      emit(w, { e: 'stageEnd', result: 'win' });
      return;
    }
    const f = u.foe;
    const a = this.active;
    if (!f || !a || f.encounter !== a.idx || u.kind === 'add' || f.hs['selfDestruct']) return;
    this.pay(w, a.idx, f.weight / a.plan.totalWeight);
    if (f.isElite) {
      const key = `${a.idx}:${f.hs['eliteSlot'] ?? 0}`;
      if (!this.eliteDropped.has(key)) {
        this.eliteDropped.add(key);
        emit(w, { e: 'eliteLoot', encounter: a.idx, slot: f.hs['eliteSlot'] ?? 0 });
      }
    }
  }

  // ---------- Steuerung von außen (Server) ----------

  setAutowalk(on: boolean): void {
    this.autowalk = on;
  }

  confirmBossReady(): void {
    this.bossReady = true;
  }

  // ---------- Ablauf ----------

  private pay(w: World, idx: number, frac: number): void {
    const eff = Math.min(frac, 1 - (this.paid[idx] ?? 0));
    if (eff <= EPS) return;
    this.paid[idx] = (this.paid[idx] ?? 0) + eff;
    emit(w, { e: 'reward', encounter: idx, frac: eff });
  }

  private leashOk(w: World): boolean {
    const leash = w.content.balance.movement.leashPx;
    return livingHeroes(w).every((h) => !h.hero?.connected || Math.abs(h.x - this.anchorX) <= leash);
  }

  private regen(w: World): void {
    const pct = (w.content.balance.stage.regenBetweenPct * w.tickMs) / MS_PER_S / PERCENT;
    for (const h of livingHeroes(w)) {
      if (h.hp < h.maxHp) {
        h.hp = Math.min(h.maxHp, h.hp + h.maxHp * pct);
      }
    }
  }

  private updateWalk(w: World): void {
    this.regen(w);
    const enc = this.def.encounters[this.nextEnc];
    const stopX = enc ? enc.x : this.def.lengthPx;
    if (this.autowalk && this.leashOk(w) && this.anchorX < stopX) {
      this.anchorX = Math.min(stopX, this.anchorX + (w.content.balance.movement.autowalk * w.tickMs) / MS_PER_S);
    }
    this.def.checkpoints.forEach((cx, i) => {
      if (i > this.checkpointIdx && this.anchorX >= cx) this.reachCheckpoint(w, i);
    });
    if (enc && this.anchorX >= enc.x) this.startEncounter(w, this.nextEnc);
    else if (!enc && this.anchorX >= this.def.lengthPx) this.finishStage(w);
  }

  private reachCheckpoint(w: World, i: number): void {
    this.checkpointIdx = i;
    for (const h of heroes(w)) if (h.hero) h.hero.potionCharges = w.content.balance.combat.potion.charges;
    emit(w, { e: 'checkpoint', index: i });
  }

  private startEncounter(w: World, idx: number): void {
    const plan = planEncounter(w.content, w.rng, this.def, idx, w.n);
    this.active = {
      idx, startedAt: w.t, plan, nextGroup: 0, queue: [], spawnPaused: false, lastSpawnAt: w.t,
      hazardAt: w.t, eliteSlot: 0,
    };
    this.phase = 'fight';
    emit(w, { e: 'encounter', index: idx, state: 'start' });
    this.updateEncounter(w);
  }

  private enqueueGroup(w: World, a: ActiveEncounter, gi: number): void {
    const g = a.plan.groups[gi]!;
    const ew = w.content.engine.world;
    const side: -1 | 1 = w.rng.chance(w.content.balance.stage.spawnRightShare) ? 1 : -1;
    const center = this.cameraX(w);
    const edge = center + side * (ew.viewWidthPx / 2 + ew.spawnEdgeOffsetPx);
    for (const e of g.enemies) {
      const q: QueuedEnemy = { ...e, side, x: edge + side * w.rng.range(0, ew.spawnSpreadPx), y: w.rng.range(0, ew.bandDepthPx) };
      if (e.eliteAffix) q.eliteSlot = a.eliteSlot++;
      a.queue.push(q);
    }
  }

  private updateEncounter(w: World): void {
    const a = this.active;
    if (!a) return;
    const st = w.content.balance.stage;
    while (a.nextGroup < a.plan.groups.length && w.t >= a.startedAt + a.plan.groups[a.nextGroup]!.delayMs) {
      this.enqueueGroup(w, a, a.nextGroup);
      a.nextGroup++;
    }
    let alive = livingFoes(w).length;
    if (a.spawnPaused && alive < st.resumeBelow) a.spawnPaused = false;
    while (!a.spawnPaused && a.queue.length > 0 && alive < st.maxAlive) {
      const q = a.queue.shift()!;
      const spec: Parameters<typeof spawnEnemy>[1] = {
        type: q.type, x: q.x, y: q.y, level: this.def.stage, chapter: this.chapter, n: w.n, encounter: a.idx,
        side: q.side, introMult: introFactor(w.content.balance, this.def.stage),
      };
      if (q.eliteAffix) spec.eliteAffix = q.eliteAffix;
      const u = spawnEnemy(w, spec);
      if (q.eliteSlot !== undefined) u.foe!.hs['eliteSlot'] = q.eliteSlot;
      alive++;
      a.lastSpawnAt = w.t;
      if (alive >= st.maxAlive) a.spawnPaused = true;
    }
    // Umgebungsgefahr (9.8)
    const enc = this.def.encounters[a.idx]!;
    if (enc.hazard && this.def.hazard && w.t >= a.hazardAt) {
      a.hazardAt = w.t + st.hazard.everyS * MS_PER_S;
      const hz = w.content.hazardById.get(this.def.hazard);
      const m = getHandler(this.def.hazard);
      if (hz && m?.hazard) {
        const spread = w.content.engine.world.hazardSpreadPx;
        m.hazard(w, hz, this.cameraX(w) + w.rng.range(-spread, spread), w.rng.range(0, w.content.engine.world.bandDepthPx));
      }
    }
    // Sicherung (9.5, Schritt 6): nach 45 s ohne Spawn laufen die Gegner auf die Party zu
    if (w.t - a.lastSpawnAt >= st.rushAfterS * MS_PER_S) {
      for (const f of livingFoes(w)) {
        if (f.foe && !f.foe.rushing && !livingHeroes(w).some((h) => dist(f, h) <= f.foe!.rangePx)) f.foe.rushing = true;
      }
    }
    const done = a.nextGroup >= a.plan.groups.length && a.queue.length === 0
      && !w.units.some((u) => u.foe && !u.dead && u.foe.encounter === a.idx && u.kind === 'enemy');
    if (done) this.endEncounter(w, a);
  }

  private endEncounter(w: World, a: ActiveEncounter): void {
    // Entfernte Gegner (Bomber) zahlen ihren Anteil am Ende der Begegnung (12.3)
    this.pay(w, a.idx, 1);
    const pct = w.content.balance.stage.reviveAtEncounterEndPct;
    for (const h of heroes(w)) if (h.dead) reviveUnit(w, h, pct);
    for (const h of heroes(w)) h.hero!.focusId = null;
    this.cleared.add(a.idx);
    this.nextEnc = a.idx + 1;
    this.active = null;
    this.phase = 'walk';
    w.zones = w.zones.filter((z) => z.kind === 'trap');
    emit(w, { e: 'encounter', index: a.idx, state: 'end' });
  }

  private finishStage(w: World): void {
    if (this.bossId) {
      this.phase = 'gate';
      emit(w, { e: 'stage', phase: 'gate' });
      if (this.bossReady) this.startCountdown(w);
      return;
    }
    this.phase = 'won';
    emit(w, { e: 'stage', phase: 'won' });
    emit(w, { e: 'stageEnd', result: 'win' });
  }

  /** Bereit-Bildschirm bestätigt: 10 s Countdown in der Arena, Waffenwechsel erlaubt (10.1). */
  private startCountdown(w: World): void {
    const boss = w.content.bossById[this.bossId!];
    const arena = w.content.arenaById.get(boss.arena);
    if (!arena) throw new Error(`Arena ${boss.arena} fehlt`);
    this.arena = arena;
    this.kind = 'arena';
    this.phase = 'countdown';
    this.countdownEndsAt = w.t + w.content.balance.boss.readyCountdownS * MS_PER_S;
    w.zones = [];
    this.resetHeroes(w, true);
    emit(w, { e: 'stage', phase: 'countdown', endsAt: this.countdownEndsAt });
  }

  private startBossFight(w: World): void {
    this.resetHeroes(w, true);
    for (const h of heroes(w)) for (const s of h.hero!.skills) s.cdLeft = 0;
    const arena = this.arena!;
    spawnBoss(w, this.bossId!, { x: arena.bossStartX, y: w.content.engine.world.bandDepthPx / 2, kampfstufe: this.kampfstufe });
    this.phase = 'boss';
    this.bossStartedAt = w.t;
    emit(w, { e: 'stage', phase: 'boss' });
  }

  /** Volles Leben, volle Tränke, Formation am Anker (Arena: Startbereich der Helden). */
  private resetHeroes(w: World, place: boolean): void {
    const a = this.anchor(w);
    for (const h of heroes(w)) {
      clearStatuses(w, h);
      h.dead = false;
      h.state = 'idle';
      h.hp = h.maxHp;
      h.hero!.potionCharges = w.content.balance.combat.potion.charges;
      h.hero!.reviveTargetId = null;
      if (place) {
        h.x = a.x + h.hero!.formationOffsetX;
        h.y = a.y + h.hero!.formationOffsetY;
        if (this.arena) h.x = Math.max(this.arena.heroStartX[0], Math.min(this.arena.heroStartX[1], h.x));
      }
    }
  }

  /** Gruppenwipe (6.8): Neustart am letzten Checkpoint bzw. am Bereit-Bildschirm des Bosses. */
  wipe(w: World): void {
    this.wipes++;
    for (const u of w.units) if (u.side === 'foe') w.removed.push(u.id);
    w.units = w.units.filter((u) => u.side !== 'foe');
    w.boss = null;
    w.zones = [];
    this.active = null;
    if (this.kind === 'arena') {
      this.phase = 'gate';
      this.bossReady = this.autoBossReady;
      this.resetHeroes(w, true);
      emit(w, { e: 'wipe', checkpoint: this.checkpointIdx });
      emit(w, { e: 'stage', phase: 'gate' });
      return;
    }
    const x0 = this.checkpointIdx >= 0 ? this.def.checkpoints[this.checkpointIdx]! : 0;
    for (const idx of [...this.cleared]) if (this.def.encounters[idx]!.x > x0) this.cleared.delete(idx);
    this.nextEnc = this.def.encounters.findIndex((_, i) => !this.cleared.has(i));
    if (this.nextEnc < 0) this.nextEnc = this.def.encounters.length;
    this.anchorX = x0;
    this.phase = 'walk';
    this.resetHeroes(w, true);
    for (const h of heroes(w)) healUnit(w, null, h, h.maxHp, {});
    emit(w, { e: 'wipe', checkpoint: this.checkpointIdx });
  }
}

export function isRunScenario(s: Scenario): s is RunScenario {
  return s instanceof RunScenario;
}

export function chapterOf(stage: number): number {
  return chapterOfStage(stage);
}
