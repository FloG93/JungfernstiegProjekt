// Bosskampf (10): Leben und Schaden nach n und Kampfstufe, vier Angriffe, Wutwechsel, Phasen, Adds, Enrage.
import type { BossId } from '../content/ids';
import type { Attack, BossDef } from '../content/schemas';
import { bossDamageFactor, bossLife, countFactor, kampfstufeFactor, refLife } from '../formulas';
import { foeHit, healUnit, reviveUnit } from './combat';
import { attackRate, canAct, cooldownRate, moveMult } from './effstats';
import { spawnEnemy } from './enemies';
import { threatTarget } from './foes';
import { getHandler } from './handlers';
import { applyStatus, removeStatus } from './status';
import type { BossPhase, Unit, World } from './types';
import { MS_PER_S, PERCENT, dist, emit, heroes, livingHeroes, newId, unitById, unitsInZone } from './util';
import { addZone } from './zones';

export interface SpawnBossOpts {
  x: number;
  y: number;
  kampfstufe: number;
}

export function bossDef(w: World, u: Unit): BossDef {
  return w.content.bossById[u.foe!.bossId!];
}

/** Schaden eines Boss-Angriffs vor Mitigation: Anteil RefLeben × M(n) × (1 + 0,05 × K) × Enrage (10.4, 10.1). */
export function bossAttackAmount(w: World, u: Unit, pctRefHp: number): number {
  const def = bossDef(w, u);
  const hs = u.foe!.hs;
  return (pctRefHp / PERCENT) * refLife(w.content.balance, def.chapter) * (hs['dmgScale'] ?? 1) * (1 + (hs['enrage'] ?? 0));
}

export function spawnBoss(w: World, id: BossId, o: SpawnBossOpts): Unit {
  const c = w.content;
  const def = c.bossById[id];
  const b = c.balance;
  const hp = Math.round(bossLife(b, def.hpBase, w.n, o.kampfstufe));
  const a = def.attacks;
  const u: Unit = {
    id: newId(w), kind: 'boss', side: 'foe', x: o.x, y: o.y, face: -1, hp, maxHp: hp, dead: false,
    state: 'idle', stateUntil: 0, element: def.phases[0]!.element, armorMit: def.armorMit, resMit: def.resMit,
    statuses: [], shields: [],
    foe: {
      type: 'boss', bossId: id, level: b.boss.levelPerChapter * def.chapter, dmgPerHit: 0,
      intervalMs: a.standard.intervalMs, rangePx: b.boss.meleeRangePx, speed: b.boss.moveSpeed, ai: 'boss',
      attackCdLeft: a.standard.intervalMs, threat: new Map(), targetId: null, tauntById: null, tauntUntil: 0,
      weight: 0, encounter: -1, isElite: false, affix: null, physical: a.standard.dmgType === 'phys',
      hs: {
        phase: 1,
        startedAt: w.t,
        dmgScale: bossDamageFactor(b, w.n) * kampfstufeFactor(b, o.kampfstufe),
        enrage: 0,
        pulseLeft: a.pulse.intervalMs,
        teleLeft: a.telegraph.intervalMs,
        sigLeft: a.signature.intervalMs,
        rageAt: w.t + b.boss.rage.everyS * MS_PER_S,
        rageUntil: 0,
        rageTarget: 0,
        addsAt: w.t + def.adds.firstAtS * MS_PER_S,
        enrageAt: w.t + b.boss.enrage.seconds * MS_PER_S,
      },
      rushing: false, spawnedAt: w.t, side: 1,
    },
  };
  w.units.push(u);
  w.boss = u;
  getHandler(def.passive.id)?.setup?.(w, u, def.passive.params);
  getHandler(def.passive.id)?.onPhaseStart?.(w, u, 1, def.passive.params);
  emit(w, { e: 'phase', boss: u.id, phase: 1, el: u.element });
  return u;
}

/** Ziel des Bosses: Spott, sonst Wutwechsel-Ziel, sonst höchste Bedrohung (6.6, 10.2). */
function bossTarget(w: World, u: Unit): Unit | undefined {
  const f = u.foe!;
  if (f.tauntById !== null && w.t < f.tauntUntil) {
    const t = unitById(w, f.tauntById);
    if (t && !t.dead) return t;
  }
  if (w.t < (f.hs['rageUntil'] ?? 0)) {
    const t = unitById(w, f.hs['rageTarget']);
    if (t && !t.dead) return t;
  }
  return threatTarget(w, u);
}

function updateRage(w: World, u: Unit): void {
  const f = u.foe!;
  const r = w.content.balance.boss.rage;
  if (w.t < (f.hs['rageAt'] ?? Infinity)) return;
  f.hs['rageAt'] = w.t + r.everyS * MS_PER_S;
  if (f.tauntById !== null && w.t < f.tauntUntil) return;
  const living = livingHeroes(w);
  if (living.length === 0) return;
  const t = w.rng.pick(living);
  f.hs['rageTarget'] = t.id;
  f.hs['rageUntil'] = w.t + r.ms;
  emit(w, { e: 'fx', id: t.id, fx: 'wutwechsel', add: true });
}

function updateEnrage(w: World, u: Unit): void {
  const f = u.foe!;
  const e = w.content.balance.boss.enrage;
  if (w.t < (f.hs['enrageAt'] ?? Infinity)) return;
  const first = (f.hs['enrage'] ?? 0) === 0;
  f.hs['enrage'] = first ? e.bonus : (f.hs['enrage'] ?? 0) + e.stepBonus;
  f.hs['enrageAt'] = w.t + e.stepSeconds * MS_PER_S;
  emit(w, { e: 'bossText', boss: u.id, text: 'raserei' });
}

function phaseElement(def: BossDef, phase: number) {
  return def.phases[phase - 1]!.element;
}

/** Phasenwechsel bei 66 % und 33 % (10.5, 6.8). Der Boss kann keine Phase überspringen. */
export function onBossDamaged(w: World, u: Unit): void {
  const def = bossDef(w, u);
  const f = u.foe!;
  const phase = f.hs['phase'] ?? 1;
  if (phase >= def.phases.length) return;
  const next = def.phases[phase]!;
  const threshold = (next.fromPct / PERCENT) * u.maxHp;
  if (u.hp > threshold) return;
  u.hp = Math.max(1, Math.ceil(threshold));
  startPhase(w, u, (phase + 1) as BossPhase);
}

function startPhase(w: World, u: Unit, phase: BossPhase): void {
  const def = bossDef(w, u);
  const b = w.content.balance.boss.phaseTransition;
  const f = u.foe!;
  f.hs['phase'] = phase;
  u.element = phaseElement(def, phase);
  applyStatus(w, u, u, 'unverwundbar', { ms: b.invulnMs });
  f.hs['transitionUntil'] = w.t + b.invulnMs;
  for (const h of heroes(w)) {
    if (h.dead) reviveUnit(w, h, b.revivePct);
    else healUnit(w, null, h, (h.maxHp * b.healPct) / PERCENT, {});
  }
  for (const a of w.units) if (a.kind === 'add' && !a.dead) a.dead = true;
  emit(w, { e: 'phase', boss: u.id, phase, el: u.element });
  getHandler(def.passive.id)?.onPhaseStart?.(w, u, phase, def.passive.params);
}

function bossHit(w: World, u: Unit, t: Unit, atk: Attack): void {
  foeHit(w, u, t, {
    amount: bossAttackAmount(w, u, atk.pctRefHp), physical: atk.dmgType === 'phys',
    element: atk.dmgType === 'phys' ? 'physisch' : u.element, attackerLevel: u.foe!.level,
  });
}

function standardAttack(w: World, u: Unit, t: Unit): void {
  const atk = bossDef(w, u).attacks.standard;
  bossHit(w, u, t, atk);
  u.face = t.x >= u.x ? 1 : -1;
  u.state = 'attack';
  u.stateUntil = w.t + w.tickMs * 2 * 2;
  // Fernwurf, wenn kein Held in Reichweite ist (10.4): gleicher Schaden, nur andere Darstellung
  if (dist(u, t) > u.foe!.rangePx) emit(w, { e: 'cast', id: u.id, skill: 'boss_fernwurf', tid: t.id });
}

function pulse(w: World, u: Unit): void {
  const atk = bossDef(w, u).attacks.pulse;
  emit(w, { e: 'cast', id: u.id, skill: 'boss_puls' });
  for (const h of livingHeroes(w)) bossHit(w, u, h, atk);
}

/** Telegraph-Angriff auf einen zufälligen Helden; Treffer tragen den Debuff des Bosses. OPEN-020 */
function telegraphAttack(w: World, u: Unit): void {
  const def = bossDef(w, u);
  const atk = def.attacks.telegraph;
  const living = livingHeroes(w);
  if (living.length === 0) return;
  const t = w.rng.pick(living);
  const r = atk.radiusPx ?? 0;
  addZone(w, {
    kind: 'telegraph', shape: 'circle', x: t.x, y: t.y, w: r, h: r, endsAt: w.t + (atk.telegraphMs ?? w.content.balance.combat.telegraphMs),
    affects: 'hero', srcId: u.id, label: 'boss_telegraph',
    onEnd: (ww, z) => {
      if (u.dead) return;
      for (const h of unitsInZone(ww, z)) {
        if (h.statuses.some((s) => s.id === 'unverwundbar')) continue;
        bossHit(ww, u, h, atk);
        applyStatus(ww, u, h, def.debuff, { attackerLevel: u.foe!.level });
      }
    },
  });
}

function spawnAdds(w: World, u: Unit): void {
  const def = bossDef(w, u);
  const count = Math.round(def.adds.groupsPerWave * w.content.enemyById[def.adds.enemy].groupSize * countFactor(w.content.balance, w.n));
  const s = w.scenario.bounds(w);
  const inset = w.content.engine.boss.addSpawnInsetPx;
  const side: -1 | 1 = w.rng.chance(1 / 2) ? 1 : -1;
  for (let i = 0; i < count; i++) {
    spawnEnemy(w, {
      type: def.adds.enemy, x: side === 1 ? s.maxX - inset : s.minX + inset, y: w.rng.range(0, w.content.engine.world.bandDepthPx),
      level: w.content.balance.boss.levelPerChapter * def.chapter, chapter: def.chapter, n: w.n, encounter: -1, side, kind: 'add',
    });
  }
}

export function updateBoss(w: World, u: Unit): void {
  const f = u.foe!;
  if (!f.bossId) return;
  const def = bossDef(w, u);
  const passive = getHandler(def.passive.id);
  passive?.update?.(w, u, def.passive.params);
  updateEnrage(w, u);
  if (w.t < (f.hs['transitionUntil'] ?? 0)) return; // Phasenübergang: keine Angriffe (10.5)
  if (f.hs['transitionUntil']) {
    delete f.hs['transitionUntil'];
    removeStatus(w, u, 'unverwundbar');
  }
  updateRage(w, u);
  if (w.t >= (f.hs['addsAt'] ?? Infinity)) {
    f.hs['addsAt'] = w.t + def.adds.everyS * MS_PER_S;
    spawnAdds(w, u);
  }
  const dtAtk = w.tickMs * attackRate(w, u);
  const dtCd = w.tickMs * cooldownRate(w, u);
  f.attackCdLeft -= dtAtk;
  f.hs['pulseLeft'] = (f.hs['pulseLeft'] ?? 0) - dtCd;
  f.hs['teleLeft'] = (f.hs['teleLeft'] ?? 0) - dtCd;
  if ((f.hs['phase'] ?? 1) >= (def.attacks.signature.fromPhase ?? 1)) f.hs['sigLeft'] = (f.hs['sigLeft'] ?? 0) - dtCd;
  if (!canAct(u)) return;
  const t = bossTarget(w, u);
  if (!t) return;
  f.targetId = t.id;
  // Bewegung (10.2): auf das Ziel zu, solange kein Held in Reichweite ist
  const anyInRange = livingHeroes(w).some((h) => dist(u, h) <= f.rangePx);
  if (!anyInRange) {
    const speed = f.speed * moveMult(w, u);
    const d = dist(u, t);
    if (d > 0 && speed > 0) {
      const s = Math.min(d, (speed * w.tickMs) / MS_PER_S);
      u.x += ((t.x - u.x) / d) * s;
      u.y += ((t.y - u.y) / d) * s;
      u.face = t.x >= u.x ? 1 : -1;
      u.state = 'walk';
      u.stateUntil = w.t + w.tickMs;
    }
  }
  if (f.attackCdLeft <= 0) {
    f.attackCdLeft += def.attacks.standard.intervalMs;
    standardAttack(w, u, t);
  }
  if ((f.hs['pulseLeft'] ?? 0) <= 0) {
    f.hs['pulseLeft'] = (f.hs['pulseLeft'] ?? 0) + def.attacks.pulse.intervalMs;
    pulse(w, u);
  }
  if ((f.hs['teleLeft'] ?? 0) <= 0) {
    f.hs['teleLeft'] = (f.hs['teleLeft'] ?? 0) + def.attacks.telegraph.intervalMs;
    telegraphAttack(w, u);
  }
  if ((f.hs['sigLeft'] ?? 0) <= 0) {
    f.hs['sigLeft'] = (f.hs['sigLeft'] ?? 0) + def.attacks.signature.intervalMs;
    const sig = def.attacks.signature;
    const m = sig.handler ? getHandler(sig.handler) : undefined;
    if (m?.signature) {
      emit(w, { e: 'bossText', boss: u.id, text: sig.handler! });
      m.signature(w, u, sig);
    }
  }
}

/** Sekunden seit Kampfbeginn (für Enrage-Anzeige, 14.4). */
export function bossElapsedMs(w: World, u: Unit): number {
  return w.t - (u.foe?.hs['startedAt'] ?? w.t);
}

