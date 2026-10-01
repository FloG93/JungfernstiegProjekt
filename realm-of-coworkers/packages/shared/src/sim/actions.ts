// Aktionen eines Helden: Ausweichrolle, Waffenwechsel, Heiltrank, Fokus, Wiederbeleben (4.4, 8.6).
import { healUnit, reviveUnit } from './combat';
import { canAct, canMove, heroStats } from './effstats';
import { heroPassiveHooks } from './handlers';
import { applyStatus } from './status';
import type { Unit, Vec, World } from './types';
import { MS_PER_S, PERCENT, dist, emit, unitById } from './util';

export function doRoll(w: World, u: Unit, dir: Vec): boolean {
  const h = u.hero;
  if (!h || !canAct(u) || !canMove(u) || w.t < h.rollReadyAt) return false;
  const len = Math.hypot(dir.x, dir.y);
  h.rollDir = len > 0 ? { x: dir.x / len, y: dir.y / len } : { x: u.face, y: 0 };
  const invuln = w.content.balance.combat.roll.invulnMs;
  h.rollUntil = w.t + invuln;
  h.rollReadyAt = w.t + h.rollCooldownS * MS_PER_S;
  h.reviveTargetId = null;
  applyStatus(w, u, u, 'unverwundbar', { ms: invuln });
  u.state = 'roll';
  u.stateUntil = h.rollUntil;
  emit(w, { e: 'roll', id: u.id });
  return true;
}

/** Waffenwechsel (8.6): 0,5 s ohne Angriff, danach 4 s Sperre. Der Lebensanteil bleibt erhalten. */
export function doSwap(w: World, u: Unit): boolean {
  const h = u.hero;
  if (!h || u.dead || !canAct(u) || w.t < h.swapLockUntil) return false;
  const next = h.activeSet === 'A' ? 'B' : 'A';
  if (!h.sets[next].hasWeapon) return false;
  const frac = u.maxHp > 0 ? u.hp / u.maxHp : 1;
  h.activeSet = next;
  const b = w.content.balance.weapon;
  h.swapUntil = w.t + b.swapMs;
  h.swapLockUntil = w.t + b.swapMs + b.swapLockS * MS_PER_S;
  u.element = h.sets[next].element;
  refreshMaxHp(w, u, frac);
  heroPassiveHooks(w, u).onSwap?.(w, u);
  emit(w, { e: 'swap', id: u.id, set: next });
  return true;
}

/** Max-Leben aus den aktuellen Werten neu setzen, Lebensanteil behalten. */
export function refreshMaxHp(w: World, u: Unit, frac = u.maxHp > 0 ? u.hp / u.maxHp : 1): void {
  u.maxHp = Math.max(1, Math.round(heroStats(w, u).leb));
  if (!u.dead) u.hp = Math.max(1, Math.min(u.maxHp, Math.round(u.maxHp * frac)));
}

export function doPotion(w: World, u: Unit): boolean {
  const h = u.hero;
  if (!h || !canAct(u) || h.potionCharges <= 0 || w.t < h.potionReadyAt || u.hp >= u.maxHp) return false;
  h.potionCharges--;
  h.potionReadyAt = w.t + h.balance.potionCooldownS * MS_PER_S;
  healUnit(w, null, u, (u.maxHp * h.balance.potionPct) / PERCENT, {});
  emit(w, { e: 'potion', id: u.id });
  return true;
}

export function setFocus(w: World, u: Unit, targetId: number | null): void {
  if (!u.hero) return;
  const t = unitById(w, targetId);
  u.hero.focusId = t && t.side !== u.side && !t.dead ? t.id : null;
}

/** Wiederbeleben (4.4): Held läuft zum Gefallenen und kanalisiert 3 s. */
export function startRevive(w: World, u: Unit, targetId: number): boolean {
  const h = u.hero;
  const t = unitById(w, targetId);
  if (!h || u.dead || !t || !t.dead || !t.hero || t.side !== u.side || t.id === u.id) return false;
  h.reviveTargetId = t.id;
  h.reviveDoneAt = 0;
  return true;
}

export function updateRevive(w: World, u: Unit): void {
  const h = u.hero;
  if (!h || h.reviveTargetId === null) return;
  const t = unitById(w, h.reviveTargetId);
  if (u.dead || !t || !t.dead || !canAct(u)) {
    h.reviveTargetId = null;
    return;
  }
  if (dist(u, t) > w.content.engine.hero.reviveRadiusPx) {
    h.reviveDoneAt = 0;
    return;
  }
  if (h.reviveDoneAt === 0) {
    h.reviveDoneAt = w.t + h.balance.reviveChannelS * MS_PER_S;
    u.state = 'cast';
    u.stateUntil = h.reviveDoneAt;
    return;
  }
  if (w.t >= h.reviveDoneAt) {
    reviveUnit(w, t, w.content.balance.combat.revive.pct);
    h.reviveTargetId = null;
  }
}
