// Auto-Ausweichen (E-023): Ein Held ohne Eingabe verlässt nach einer Reaktionszeit feindliche Flächen
// (Telegraphen, Gefahren) bzw. stellt sich in einen Lichtkreis (Stille). Reicht die Zeit zu Fuß nicht,
// nutzt er die Ausweichrolle, sofern sie bereit ist.
import { doRoll } from './actions';
import { moveMult } from './effstats';
import type { Unit, Vec, World, Zone } from './types';
import { MS_PER_S, dist, pointInZone } from './util';

const SAFE_LABEL = 'lichtkreis';

/** Punkt außerhalb der Zone, möglichst nah am Helden. */
function exitPoint(z: Zone, u: Unit, margin: number): Vec {
  if (z.shape === 'circle') {
    const dx = u.x - z.x;
    const dy = u.y - z.y;
    const d = Math.hypot(dx, dy);
    const ux = d > 0 ? dx / d : (u.face === 1 ? -1 : 1);
    const uy = d > 0 ? dy / d : 0;
    return { x: z.x + ux * (z.w + margin), y: z.y + uy * (z.w + margin) };
  }
  const ang = z.ang ?? 0;
  const nx = -Math.sin(ang);
  const ny = Math.cos(ang);
  const across = (u.x - z.x) * nx + (u.y - z.y) * ny;
  const side = across >= 0 ? 1 : -1;
  const need = z.h / 2 + margin - Math.abs(across);
  return { x: u.x + nx * side * need, y: u.y + ny * side * need };
}

/** Ziel des Ausweichens oder null, wenn keine Gefahr besteht. */
export function dodgeGoal(w: World, u: Unit): Vec | null {
  const h = u.hero;
  if (!h || !h.autoDodge || !h.connected || u.dead) return null;
  const react = w.content.engine.idle.autoDodgeReactMs;
  const margin = w.content.engine.idle.autoDodgeMarginPx;
  const depth = w.content.engine.world.bandDepthPx;
  const safe = w.zones.filter((z) => z.label === SAFE_LABEL && w.t - z.createdAt >= react);
  if (safe.length > 0 && !safe.some((z) => pointInZone(z, u))) {
    const z = [...safe].sort((a, b) => dist(a, u) - dist(b, u) || a.id - b.id)[0]!;
    return { x: z.x, y: z.y };
  }
  const danger = w.zones.filter((z) => z.affects === 'hero' && (z.kind === 'telegraph' || z.kind === 'hazard')
    && w.t - z.createdAt >= react && pointInZone(z, u));
  if (danger.length === 0) return null;
  const z = [...danger].sort((a, b) => a.endsAt - b.endsAt || a.id - b.id)[0]!;
  const p = exitPoint(z, u, margin);
  p.y = Math.max(0, Math.min(depth, p.y));
  // Reicht die Zeit zu Fuß nicht, rollen
  const speed = w.content.balance.movement.manual * moveMult(w, u);
  const left = (z.endsAt - w.t) / MS_PER_S;
  if (speed * left < dist(u, p) && w.t >= h.rollReadyAt) doRoll(w, u, { x: p.x - u.x, y: p.y - u.y });
  return p;
}
