// Statuseffekte (6.3, 6.4): Stapel, Dauer, Ticks, Höchstzahl, Reinigung, Immunitäten.
import type { StatusId } from '../content/ids';
import type { BuffEffect } from '../content/schemas';
import { dealDotDamage, healUnit } from './combat';
import { statusParam } from './effstats';
import type { BuffMod, StatusInst, Unit, World } from './types';
import { MS_PER_S, PERCENT, emit } from './util';

export interface ApplyStatusOpts {
  ms?: number;
  stacks?: number;
  value?: number;
  /** Festgehaltener Schaden oder Heilung je Stapel und Tick (Quelle Held). */
  perStackTick?: number;
  attackerLevel?: number;
}

export function isBossLike(u: Unit): boolean {
  return u.kind === 'boss';
}

/**
 * Wendet einen Status an. Gibt false zurück, wenn das Ziel immun ist oder kein Platz frei ist.
 * Bosse sind immun gegen Betäubung, Wurzel, Furcht und Einfrieren; Elite halbiert deren Dauer (6.4).
 */
export function applyStatus(w: World, src: Unit | null, dst: Unit, id: StatusId, o: ApplyStatusOpts = {}): boolean {
  if (dst.dead) return false;
  const def = w.content.statusById[id];
  if (def.bossImmune && isBossLike(dst)) return false;
  if (def.kind === 'debuff' && dst.statuses.some((s) => s.id === 'unverwundbar') && src && src.side !== dst.side) {
    return false;
  }
  let ms = o.ms ?? def.defaultMs;
  if (dst.foe?.isElite) ms *= def.eliteDurationMult;
  const stacks = o.stacks ?? 1;
  const existing = dst.statuses.find((s) => s.id === id);
  if (existing) {
    existing.stacks = Math.min(def.maxStacks, existing.stacks + stacks);
    existing.endsAt = Math.max(existing.endsAt, w.t + ms);
    if (o.value !== undefined) existing.value = o.value;
    if (o.perStackTick !== undefined) existing.perStackTick = Math.max(existing.perStackTick ?? 0, o.perStackTick);
    if (src) {
      existing.srcId = src.id;
      existing.fromHero = src.side === 'hero';
      existing.srcClass = src.hero?.classId;
    }
  } else {
    if (!makeRoom(w, dst)) return false;
    const inst: StatusInst = {
      id,
      stacks: Math.min(def.maxStacks, stacks),
      appliedAt: w.t,
      endsAt: w.t + ms,
      srcId: src?.id ?? 0,
      fromHero: src?.side === 'hero',
      srcClass: src?.hero?.classId,
    };
    if (o.value !== undefined) inst.value = o.value;
    if (o.perStackTick !== undefined) inst.perStackTick = o.perStackTick;
    if (o.attackerLevel !== undefined) inst.attackerLevel = o.attackerLevel;
    if (def.tickMs) inst.nextTickAt = w.t + def.tickMs;
    dst.statuses.push(inst);
    emit(w, { e: 'fx', id: dst.id, fx: id, add: true });
  }
  if (id === 'betaeubung' || id === 'eingefroren') interruptRevive(dst);
  if (id === 'frost') checkFreeze(w, src, dst);
  return true;
}

/** Höchstens 8 verschiedene Effekte; bei Überlauf wird der älteste Debuff ersetzt (6.4). */
function makeRoom(w: World, dst: Unit): boolean {
  if (dst.statuses.length < w.content.balance.combat.maxEffects) return true;
  let oldest: StatusInst | undefined;
  for (const s of dst.statuses) {
    if (w.content.statusById[s.id].kind !== 'debuff') continue;
    if (!oldest || s.appliedAt < oldest.appliedAt) oldest = s;
  }
  if (!oldest) return false;
  removeStatus(w, dst, oldest.id);
  return true;
}

/** Frost bei 3 Stapeln: eingefroren, Bosse stattdessen −40 % Tempo (6.3). */
function checkFreeze(w: World, src: Unit | null, dst: Unit): void {
  const f = dst.statuses.find((s) => s.id === 'frost');
  const p = w.content.statusById.frost.params;
  if (!f || f.stacks < (p['freezeAtStacks'] ?? Infinity)) return;
  removeStatus(w, dst, 'frost');
  if (isBossLike(dst)) {
    const ms = p['bossSlowAtMaxMs'] ?? 0;
    const value = p['bossSlowAtMaxPct'] ?? 0;
    applyStatus(w, src, dst, 'angriffstempo_malus', { ms, value });
    applyStatus(w, src, dst, 'bewegung_malus', { ms, value });
  } else {
    applyStatus(w, src, dst, 'eingefroren', { ms: p['freezeMs'] ?? 0 });
  }
}

export function removeStatus(w: World, u: Unit, id: StatusId): void {
  const i = u.statuses.findIndex((s) => s.id === id);
  if (i < 0) return;
  u.statuses.splice(i, 1);
  emit(w, { e: 'fx', id: u.id, fx: id, add: false });
}

export function clearStatuses(w: World, u: Unit): void {
  for (const s of [...u.statuses]) removeStatus(w, u, s.id);
  u.shields = [];
}

/** Entfernt bis zu `count` Debuffs in der Reihenfolge aus 6.4. Gibt die Zahl entfernter Effekte zurück. */
export function cleanse(w: World, u: Unit, count: number): number {
  let removed = 0;
  while (removed < count) {
    let best: StatusInst | undefined;
    for (const s of u.statuses) {
      const order = w.content.statusById[s.id].cleanseOrder;
      if (order === undefined) continue;
      if (!best || order < (w.content.statusById[best.id].cleanseOrder ?? Infinity)) best = s;
    }
    if (!best) break;
    removeStatus(w, u, best.id);
    removed++;
  }
  return removed;
}

export function hasCleansableDebuff(w: World, u: Unit): boolean {
  return u.statuses.some((s) => w.content.statusById[s.id].cleanseOrder !== undefined);
}

/**
 * Buff aus einer Fähigkeit (Effekt buff). Gleiche Buffs stapeln nicht: der stärkere Wert gilt,
 * die Dauer wird erneuert (6.4). Anzeige über den Status aus `display` (E-002).
 */
export function applyBuff(w: World, src: Unit, dst: Unit, e: BuffEffect, ms: number): void {
  if (dst.dead || ms <= 0) return;
  const id = e.display;
  if (!id) throw new Error(`Buff ohne display (${e.stat}) kann nicht angezeigt werden`);
  const mod: BuffMod = { stat: e.stat };
  if (e.mult !== undefined) mod.mult = e.mult;
  if (e.add !== undefined) mod.add = e.add;
  let inst = dst.statuses.find((s) => s.id === id);
  if (!inst) {
    if (!makeRoom(w, dst)) return;
    inst = {
      id, stacks: 1, appliedAt: w.t, endsAt: w.t + ms, srcId: src.id, fromHero: src.side === 'hero',
      srcClass: src.hero?.classId, mods: [mod],
    };
    dst.statuses.push(inst);
    emit(w, { e: 'fx', id: dst.id, fx: id, add: true });
    return;
  }
  inst.endsAt = Math.max(inst.endsAt, w.t + ms);
  inst.srcId = src.id;
  inst.fromHero = src.side === 'hero';
  inst.srcClass = src.hero?.classId;
  inst.mods ??= [];
  const same = inst.mods.find((m) => m.stat === mod.stat);
  if (!same) inst.mods.push(mod);
  else if (strength(mod) > strength(same)) Object.assign(same, mod);
}

function strength(m: BuffMod): number {
  return Math.abs((m.mult ?? 1) - 1) + Math.abs(m.add ?? 0);
}

/** Schaden und Heilung über Zeit, Ablauf der Effekte und Schilde (11.7, Schritt 7). */
export function tickStatuses(w: World, u: Unit): void {
  if (u.dead) return;
  for (const s of [...u.statuses]) {
    const def = w.content.statusById[s.id];
    if (def.tickMs && s.nextTickAt !== undefined) {
      while (s.nextTickAt <= w.t && s.nextTickAt <= s.endsAt && !u.dead) {
        tickOnce(w, u, s);
        s.nextTickAt += def.tickMs;
      }
    }
    if (s.endsAt <= w.t && u.statuses.includes(s)) removeStatus(w, u, s.id);
  }
  if (u.shields.length > 0) u.shields = u.shields.filter((sh) => sh.endsAt > w.t && sh.amount > 0);
}

function tickOnce(w: World, u: Unit, s: StatusInst): void {
  const def = w.content.statusById[s.id];
  const tickS = (def.tickMs ?? MS_PER_S) / MS_PER_S;
  const src = w.units.find((x) => x.id === s.srcId) ?? null;
  if (def.kind === 'buff') {
    // Regeneration: Heilung je Tick (Heileraktion, erzeugt Bedrohung)
    const amount = (s.perStackTick ?? 0) * s.stacks;
    if (amount > 0) healUnit(w, src, u, amount, { healerAction: true });
    return;
  }
  const physical = statusParam(w, s.id, 'physical') > 0;
  if (s.fromHero) {
    const amount = (s.perStackTick ?? 0) * s.stacks;
    if (amount > 0) dealDotDamage(w, src, u, amount, physical, { coefPerStackTick: coefOf(w, s) * tickS, stacks: s.stacks });
  } else {
    const pct = statusParam(w, s.id, 'enemyPctRefHpPerS');
    const amount = (pct / PERCENT) * w.scenario.refLife(w) * tickS * s.stacks;
    if (amount > 0) dealDotDamage(w, src, u, amount, physical, { attackerLevel: s.attackerLevel ?? w.scenario.attackerLevel(w) });
  }
}

function coefOf(w: World, s: StatusInst): number {
  return s.value ?? statusParam(w, s.id, 'heroCoefPerS');
}

function interruptRevive(u: Unit): void {
  if (u.hero) {
    u.hero.reviveTargetId = null;
  }
}
