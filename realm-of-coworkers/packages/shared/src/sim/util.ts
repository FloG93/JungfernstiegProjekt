// Hilfsfunktionen der Simulation: Abfragen, Geometrie, Ereignisse.
import type { StatusId } from '../content/ids';
import type { GameEvent, Side, Unit, Vec, World, Zone } from './types';

export const MS_PER_S = 1000;
export const PERCENT = 100;
const DEG_PER_HALF_TURN = 180;

export function emit(w: World, ev: GameEvent): void {
  w.events.push(ev);
}

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function unitById(w: World, id: number | null | undefined): Unit | undefined {
  if (id === null || id === undefined) return undefined;
  for (const u of w.units) if (u.id === id) return u;
  return undefined;
}

export function isAlive(u: Unit | undefined): u is Unit {
  return !!u && !u.dead;
}

export function heroes(w: World): Unit[] {
  return w.units.filter((u) => u.kind === 'hero');
}

export function livingHeroes(w: World): Unit[] {
  return w.units.filter((u) => u.kind === 'hero' && !u.dead);
}

export function livingFoes(w: World): Unit[] {
  return w.units.filter((u) => u.side === 'foe' && !u.dead);
}

export function otherSide(s: Side): Side {
  return s === 'hero' ? 'foe' : 'hero';
}

/** Lebende Gegner einer Einheit (aus Sicht ihrer Seite). */
export function enemiesOf(w: World, u: Unit): Unit[] {
  const s = otherSide(u.side);
  return w.units.filter((o) => o.side === s && !o.dead);
}

/** Lebende Verbündete einschließlich der Einheit selbst (E-003). */
export function alliesOf(w: World, u: Unit): Unit[] {
  return w.units.filter((o) => o.side === u.side && !o.dead);
}

export function hpFrac(u: Unit): number {
  return u.maxHp > 0 ? u.hp / u.maxHp : 0;
}

export function hasStatus(u: Unit, id: StatusId): boolean {
  return u.statuses.some((s) => s.id === id);
}

export function statusStacks(u: Unit, id: StatusId): number {
  return u.statuses.find((s) => s.id === id)?.stacks ?? 0;
}

export function nearest(from: Vec, units: Unit[], maxDist = Infinity): Unit | undefined {
  let best: Unit | undefined;
  let bestD = maxDist;
  for (const u of units) {
    const d = dist(from, u);
    if (d <= bestD) {
      if (d < bestD || !best || u.id < best.id) {
        best = u;
        bestD = d;
      }
    }
  }
  return best;
}

export function within(from: Vec, units: Unit[], radius: number): Unit[] {
  return units.filter((u) => dist(from, u) <= radius);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / DEG_PER_HALF_TURN;
}

/** Liegt der Punkt in der Zone (Kreis oder Linie, 6.7)? */
export function pointInZone(z: Zone, p: Vec): boolean {
  if (z.shape === 'circle') return dist(z, p) <= z.w;
  const ang = z.ang ?? 0;
  const dx = p.x - z.x;
  const dy = p.y - z.y;
  const along = dx * Math.cos(ang) + dy * Math.sin(ang);
  const across = -dx * Math.sin(ang) + dy * Math.cos(ang);
  if (z.shape === 'line') return Math.abs(along) <= z.w / 2 && Math.abs(across) <= z.h / 2;
  // Kegel: w = Radius, h = Öffnungswinkel in Grad
  const d = Math.hypot(dx, dy);
  if (d > z.w) return false;
  const a = Math.abs(Math.atan2(across, along));
  return a <= degToRad(z.h) / 2;
}

export function unitsInZone(w: World, z: Zone): Unit[] {
  return w.units.filter((u) => u.side === z.affects && !u.dead && pointInZone(z, u));
}

export function newId(w: World): number {
  return w.nextId++;
}
