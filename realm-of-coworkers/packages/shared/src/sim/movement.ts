// Bewegung der Helden (6.5, 9.2): Formation, manuelle Steuerung, Rückkehr, Verfolgung im Kampf. OPEN-012
import { dodgeGoal } from './dodge';
import { canMove, moveMult } from './effstats';
import { skillRange } from './heroutil';
import type { Unit, Vec, World } from './types';
import { MS_PER_S, clamp, dist, enemiesOf, nearest, unitById } from './util';

/** Formationsplatz eines Helden relativ zum Anker. */
export function formationSlot(w: World, u: Unit): Vec {
  const a = w.scenario.anchor(w);
  const h = u.hero!;
  return { x: a.x + h.formationOffsetX, y: a.y + h.formationOffsetY };
}

function stepToward(w: World, u: Unit, target: Vec, speed: number): boolean {
  const dt = w.tickMs / MS_PER_S;
  const dx = target.x - u.x;
  const dy = target.y - u.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return false;
  const step = speed * dt;
  if (step >= d) {
    u.x = target.x;
    u.y = target.y;
  } else {
    u.x += (dx / d) * step;
    u.y += (dy / d) * step;
  }
  if (Math.abs(dx) >= 1) u.face = dx > 0 ? 1 : -1;
  return true;
}

/** Ziel, das ein Held im Kampf ohne Eingabe verfolgt: Fokus, sonst der nächste Gegner. */
export function chaseTarget(w: World, u: Unit): Unit | undefined {
  const f = unitById(w, u.hero?.focusId);
  if (f && !f.dead) return f;
  return nearest(u, enemiesOf(w, u));
}

export function moveHero(w: World, u: Unit): void {
  const h = u.hero;
  if (!h || u.dead) return;
  const dt = w.tickMs / MS_PER_S;
  const mv = w.content.balance.movement;
  // Ausweichrolle: Strecke über die Dauer der Unverwundbarkeit
  if (w.t < h.rollUntil) {
    const speed = (h.balance.rollPx / w.content.balance.combat.roll.invulnMs) * MS_PER_S;
    u.x += h.rollDir.x * speed * dt;
    u.y += h.rollDir.y * speed * dt;
    if (h.rollDir.x !== 0) u.face = h.rollDir.x > 0 ? 1 : -1;
    return;
  }
  if (!canMove(u)) return;
  const speed = mv.manual * moveMult(w, u);
  const manual = h.connected && (h.input.mx !== 0 || h.input.my !== 0 || h.input.moveTo !== null);
  if (manual) {
    h.manualUntil = w.t + mv.formationReturnS * MS_PER_S;
    h.reviveTargetId = null;
    if (h.input.moveTo) {
      if (!stepToward(w, u, h.input.moveTo, speed)) h.input.moveTo = null;
    } else {
      const len = Math.hypot(h.input.mx, h.input.my) || 1;
      u.x += (h.input.mx / len) * speed * dt;
      u.y += (h.input.my / len) * speed * dt;
      if (h.input.mx !== 0) u.face = h.input.mx > 0 ? 1 : -1;
    }
    u.state = 'walk';
    u.stateUntil = w.t + w.tickMs;
    return;
  }
  if (w.t < h.manualUntil) return;

  // Auto-Ausweichen (E-023)
  const dodge = dodgeGoal(w, u);
  if (w.t < h.rollUntil) return;
  if (dodge) {
    if (stepToward(w, u, dodge, speed)) {
      u.state = 'walk';
      u.stateUntil = w.t + w.tickMs;
    }
    return;
  }

  // Wiederbeleben: zum Gefallenen laufen
  const rt = unitById(w, h.reviveTargetId);
  if (rt) {
    if (dist(u, rt) > w.content.engine.hero.reviveRadiusPx) stepToward(w, u, rt, speed);
    return;
  }

  let goal = formationSlot(w, u);
  if (h.connected && w.scenario.inCombat(w)) {
    const t = chaseTarget(w, u);
    const auto = h.skills.find((s) => s.slot === 'auto');
    if (t && auto) {
      const range = skillRange(w, u, auto.def);
      const d = dist(u, t);
      if (d <= range) {
        if (t.x !== u.x) u.face = t.x > u.x ? 1 : -1;
        return;
      }
      const want = range * w.content.engine.hero.chaseRangeFraction;
      const dx = u.x - t.x;
      const dy = u.y - t.y;
      const len = Math.hypot(dx, dy) || 1;
      goal = { x: t.x + (dx / len) * want, y: t.y + (dy / len) * want };
      const a = w.scenario.anchor(w);
      if (w.scenario.kind === 'stage') goal.x = clamp(goal.x, a.x - mv.leashPx, a.x + mv.leashPx);
    }
  }
  if (stepToward(w, u, goal, speed)) {
    u.state = 'walk';
    u.stateUntil = w.t + w.tickMs;
  }
}

/** Figuren derselben Seite werden leicht auseinandergeschoben (6.5). */
export function separate(w: World): void {
  const r = w.content.engine.world.separationRadiusPx;
  const push = (w.content.engine.world.separationPushPxPerS * w.tickMs) / MS_PER_S;
  const living = w.units.filter((u) => !u.dead);
  for (let i = 0; i < living.length; i++) {
    const a = living[i]!;
    for (let j = i + 1; j < living.length; j++) {
      const b = living[j]!;
      if (a.side !== b.side) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d >= r) continue;
      const ux = d > 0 ? dx / d : 1;
      const uy = d > 0 ? dy / d : 0;
      const k = Math.min(push, (r - d) / 2);
      if (canMove(a) && a.kind !== 'boss') {
        a.x -= ux * k;
        a.y -= uy * k;
      }
      if (canMove(b) && b.kind !== 'boss') {
        b.x += ux * k;
        b.y += uy * k;
      }
    }
  }
}

/** Hält alle Einheiten im Tiefenband und in den Grenzen der Welt. */
export function clampUnits(w: World): void {
  const depth = w.content.engine.world.bandDepthPx;
  const b = w.scenario.bounds(w);
  for (const u of w.units) {
    u.y = clamp(u.y, 0, depth);
    u.x = clamp(u.x, b.minX, b.maxX);
  }
}
