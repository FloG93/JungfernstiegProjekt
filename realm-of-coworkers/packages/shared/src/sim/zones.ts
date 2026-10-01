// Flächen am Boden: Telegraphen, Gefahren, Auren und Fallen (6.7, 9.8).
import type { Zone, World } from './types';
import { emit, newId, unitById } from './util';

export type ZoneSpec = Omit<Zone, 'id' | 'createdAt'>;

export function addZone(w: World, spec: ZoneSpec): Zone {
  const z: Zone = { ...spec, id: newId(w), createdAt: w.t };
  if (z.tickMs && z.nextTickAt === undefined) z.nextTickAt = w.t + z.tickMs;
  w.zones.push(z);
  if (z.kind === 'telegraph' || z.kind === 'hazard') emit(w, { e: 'telegraph', zone: z.id, ms: z.endsAt - w.t });
  return z;
}

export function removeZone(w: World, id: number): void {
  const i = w.zones.findIndex((z) => z.id === id);
  if (i >= 0) w.zones.splice(i, 1);
}

/** Folgt Einheiten, führt Ticks aus und löst Zonen am Ende der Anzeige aus. */
export function updateZones(w: World): void {
  for (const z of [...w.zones]) {
    if (!w.zones.includes(z)) continue;
    if (z.followId !== undefined) {
      const u = unitById(w, z.followId);
      if (u && !u.dead) {
        z.x = u.x;
        z.y = u.y;
      }
    }
    if (z.onTick && z.tickMs) {
      while (z.nextTickAt !== undefined && z.nextTickAt <= w.t && z.nextTickAt <= z.endsAt && w.zones.includes(z)) {
        z.onTick(w, z);
        z.nextTickAt += z.tickMs;
      }
    }
    if (z.endsAt <= w.t && w.zones.includes(z)) {
      removeZone(w, z.id);
      z.onEnd?.(w, z);
    }
  }
}
