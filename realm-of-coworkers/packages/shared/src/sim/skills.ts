// Fähigkeiten aus JSON (4, 15.5): Ziel wählen, Abklingzeit setzen, Effekte der Reihe nach anwenden.
import type { Effect, SkillDef, StatusEffect } from '../content/schemas';
import { addShield, healUnit, heroDotPerStackTick, heroHit } from './combat';
import { canAct, canUseAbilities, kraftEff } from './effstats';
import { getHandler } from './handlers';
import { skillRange, weaponElement } from './heroutil';
import { applyBuff, applyStatus } from './status';
import type { HeroSkill, Unit, Vec, World } from './types';
import { MS_PER_S, PERCENT, alliesOf, dist, emit, enemiesOf, hpFrac, nearest, unitById, within } from './util';

export interface CastOpts {
  targetId?: number;
  x?: number;
  y?: number;
  auto: boolean;
}

export function heroSkill(u: Unit, skillId: string): HeroSkill | undefined {
  return u.hero?.skills.find((s) => s.def.id === skillId);
}

/** Darf die Fähigkeit jetzt gewirkt werden (Stufe, Abklingzeit, Kontrolle, Wechsel, Rolle)? */
export function skillUsable(w: World, u: Unit, sk: HeroSkill): boolean {
  const h = u.hero;
  if (!h || u.dead || sk.slot === 'passive') return false;
  if (h.level < sk.def.unlockLevel) return false;
  if (sk.cdLeft > 0) return false;
  if (!canAct(u)) return false;
  if (sk.slot !== 'auto' && !canUseAbilities(u)) return false;
  if (w.t < h.swapUntil || w.t < h.rollUntil) return false;
  return true;
}

function inRange(u: Unit, t: Unit, range: number): boolean {
  return dist(u, t) <= range;
}

export interface Resolved {
  target: Unit | null;
  point: Vec | null;
}

/** Zielwahl je Zieltyp (15.5, E-003, E-005). Gibt null zurück, wenn kein gültiges Ziel existiert. */
export function resolveTarget(w: World, u: Unit, def: SkillDef, o: CastOpts): Resolved | null {
  const range = skillRange(w, u, def);
  const foes = enemiesOf(w, u);
  const explicit = unitById(w, o.targetId);
  const focus = unitById(w, u.hero?.focusId);
  const validFoe = (t: Unit | undefined): t is Unit => !!t && !t.dead && t.side !== u.side && inRange(u, t, range);
  const nearestInRange = () => nearest(u, foes, range) ?? null;

  switch (def.target) {
    case 'nearest': {
      const t = validFoe(explicit) ? explicit : validFoe(focus) ? focus : nearestInRange();
      return t ? { target: t, point: { x: t.x, y: t.y } } : null;
    }
    case 'focus': {
      let t: Unit | null = validFoe(explicit) ? explicit : validFoe(focus) ? focus : null;
      t ??= foes.find((f) => f.kind === 'boss' && inRange(u, f, range)) ?? null;
      t ??= foes.filter((f) => f.foe?.isElite && inRange(u, f, range)).sort((a, b) => dist(u, a) - dist(u, b) || a.id - b.id)[0] ?? null;
      t ??= nearestInRange();
      return t ? { target: t, point: { x: t.x, y: t.y } } : null;
    }
    case 'ground': {
      if (o.x !== undefined && o.y !== undefined && dist(u, { x: o.x, y: o.y }) <= range) {
        return { target: null, point: { x: o.x, y: o.y } };
      }
      const t = validFoe(explicit) ? explicit : validFoe(focus) ? focus : nearestInRange();
      return t ? { target: t, point: { x: t.x, y: t.y } } : null;
    }
    case 'lowestAlly': {
      const allies = alliesOf(w, u);
      const t = explicit && !explicit.dead && explicit.side === u.side ? explicit : lowestAllies(allies, 1)[0];
      return t ? { target: t, point: null } : null;
    }
    case 'self':
    case 'none':
      return { target: u, point: { x: u.x, y: u.y } };
  }
}

export function lowestAllies(allies: Unit[], count: number): Unit[] {
  return [...allies].sort((a, b) => hpFrac(a) - hpFrac(b) || a.id - b.id).slice(0, count);
}

/** Wirkt eine Fähigkeit. Gibt true zurück, wenn sie ausgelöst wurde. */
export function castSkill(w: World, u: Unit, skillId: string, o: CastOpts): boolean {
  const sk = heroSkill(u, skillId);
  if (!sk || !skillUsable(w, u, sk)) return false;
  const res = resolveTarget(w, u, sk.def, o);
  if (!res) return false;
  sk.cdLeft = sk.def.cooldownS * MS_PER_S;
  const tx = res.target?.x ?? res.point?.x;
  if (tx !== undefined && tx !== u.x) u.face = tx > u.x ? 1 : -1;
  u.state = sk.slot === 'auto' ? 'attack' : 'cast';
  u.stateUntil = w.t + w.tickMs * w.content.balance.net.snapshotEveryTicks * 2;
  if (u.hero && !o.auto) u.hero.reviveTargetId = null;
  const ev: { e: 'cast'; id: number; skill: string; tx?: number; ty?: number; tid?: number } = { e: 'cast', id: u.id, skill: skillId };
  if (res.target && res.target.id !== u.id) ev.tid = res.target.id;
  if (res.point) {
    ev.tx = Math.round(res.point.x);
    ev.ty = Math.round(res.point.y);
  }
  emit(w, ev);
  for (const eff of sk.def.effects) applyEffect(w, u, sk.def, eff, res.target, res.point);
  return true;
}

function radiusOf(eff: Effect): number | undefined {
  if (eff.radiusPx !== undefined) return eff.radiusPx;
  if (eff.k === 'handler' && typeof eff.params['radiusPx'] === 'number') return eff.params['radiusPx'];
  return undefined;
}

/** Empfänger eines Effekts nach `to` (15.5). Sortiert nach ID für Determinismus. */
export function recipientsFor(w: World, caster: Unit, eff: Effect, target: Unit | null, point: Vec | null): Unit[] {
  const to = eff.to ?? 'target';
  const foes = enemiesOf(w, caster);
  switch (to) {
    case 'target':
      return target && !target.dead ? [target] : [];
    case 'self':
      return caster.dead ? [] : [caster];
    case 'allies':
      return alliesOf(w, caster);
    case 'lowestAllies':
      return lowestAllies(alliesOf(w, caster), eff.count ?? 1);
    case 'enemiesAroundSelf':
      return within(caster, foes, radiusOf(eff) ?? 0).sort((a, b) => a.id - b.id);
    case 'enemiesAroundTarget': {
      const center = target ?? point;
      if (!center) return [];
      const r = radiusOf(eff) ?? 0;
      const set = new Map<number, Unit>();
      if (target && !target.dead && target.side !== caster.side) set.set(target.id, target);
      for (const f of within(center, foes, r)) set.set(f.id, f);
      return [...set.values()].sort((a, b) => a.id - b.id);
    }
  }
}

export function applyEffect(w: World, caster: Unit, def: SkillDef, eff: Effect, target: Unit | null, point: Vec | null): void {
  const rec = recipientsFor(w, caster, eff, target, point);
  switch (eff.k) {
    case 'damage': {
      const el = weaponElement(caster);
      for (const r of rec) heroHit(w, caster, r, { coef: eff.coef, element: el });
      if (eff.splashPct !== undefined && target && eff.radiusPx !== undefined) {
        const others = within(target, enemiesOf(w, caster), eff.radiusPx).filter((f) => f.id !== target.id);
        for (const f of others.sort((a, b) => a.id - b.id)) {
          heroHit(w, caster, f, { coef: eff.coef * (eff.splashPct / PERCENT), element: el });
        }
      }
      return;
    }
    case 'heal': {
      for (const r of rec) {
        const amount = eff.coef !== undefined ? eff.coef * kraftEff(w, caster) : ((eff.pctMaxHp ?? 0) * r.maxHp) / PERCENT;
        healUnit(w, caster, r, amount, { healerAction: true });
      }
      return;
    }
    case 'shield': {
      for (const r of rec) {
        const base = eff.pctMaxHpOf === 'caster' ? caster.maxHp : r.maxHp;
        addShield(w, caster, r, (base * eff.pct) / PERCENT, eff.ms);
      }
      return;
    }
    case 'status':
      for (const r of rec) applySkillStatus(w, caster, eff, r);
      return;
    case 'buff': {
      if (eff.ms === 0) return; // dauerhafte Passive stecken in den statischen Werten (5.5)
      const ms = eff.ms + (caster.hero?.buffDurationAddMs ?? 0);
      for (const r of rec) applyBuff(w, caster, r, eff, ms);
      return;
    }
    case 'handler': {
      const m = getHandler(eff.id);
      if (!m?.cast) throw new Error(`Handler ${eff.id} kann nicht gewirkt werden`);
      m.cast({ w, caster, skill: def, params: eff.params, target, point, recipients: rec });
      return;
    }
  }
}

function applySkillStatus(w: World, caster: Unit, eff: StatusEffect, r: Unit): void {
  if (eff.chance !== undefined && !w.rng.chance(eff.chance)) return;
  const def = w.content.statusById[eff.id];
  if (r.kind === 'boss' && def.bossImmune) {
    if (eff.bossReplace) {
      const repl = eff.bossReplace;
      if (repl.k === 'status') applySkillStatus(w, caster, { ...repl, to: 'target' }, r);
    }
    return;
  }
  let ms = eff.ms;
  if (def.kind === 'buff') ms += caster.hero?.buffDurationAddMs ?? 0;
  const o: { ms: number; stacks?: number; value?: number; perStackTick?: number } = { ms };
  if (eff.stacks !== undefined) o.stacks = eff.stacks;
  if (eff.value !== undefined) o.value = eff.value;
  const pst = caster.hero ? heroDotPerStackTick(w, caster, eff.id, eff.value) : undefined;
  if (pst !== undefined) o.perStackTick = pst;
  applyStatus(w, caster, r, eff.id, o);
}

/** Zählt die Abklingzeiten herunter: Tempo und Schock für Fähigkeiten, Angriffstempo für den Automatikangriff (4.4). */
export function tickCooldowns(w: World, u: Unit, cdRate: number, atkRate: number): void {
  const h = u.hero;
  if (!h) return;
  for (const sk of h.skills) {
    if (sk.cdLeft <= 0) continue;
    sk.cdLeft = Math.max(0, sk.cdLeft - w.tickMs * (sk.slot === 'auto' ? atkRate : cdRate));
  }
}

