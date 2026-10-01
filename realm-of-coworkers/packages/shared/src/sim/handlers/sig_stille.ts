// Nyxhara, Stille (10.6): 3 Lichtkreise (Radius 120 px) erscheinen; nach 3 s erhalten alle Helden außerhalb
// Furcht 2 s und 15 % RefLeben.
import { numParam } from '../heroutil';
import { applyStatus } from '../status';
import { addZone } from '../zones';
import { dist, livingHeroes } from '../util';
import type { Vec } from '../types';
import { arenaWidth, sigHit } from './sigCommon';
import type { HandlerModule } from './types';

export const sig_stille: HandlerModule = {
  id: 'sig_stille',
  signature(w, boss, a) {
    const params = a.params ?? {};
    const r = numParam(params, 'radiusPx');
    const delay = numParam(params, 'delayMs');
    const minX = w.scenario.bounds(w).minX;
    const width = arenaWidth(w);
    const depth = w.content.engine.world.bandDepthPx;
    const circles: Vec[] = [];
    for (let i = 0; i < numParam(params, 'circles'); i++) {
      const p = { x: minX + r + w.rng.range(0, Math.max(0, width - 2 * r)), y: w.rng.range(0, depth) };
      circles.push(p);
      addZone(w, {
        kind: 'aura', shape: 'circle', x: p.x, y: p.y, w: r, h: r, endsAt: w.t + delay, affects: 'hero', srcId: boss.id,
        label: 'lichtkreis',
        ...(i === 0
          ? {
              onEnd: (ww: typeof w) => {
                if (boss.dead) return;
                for (const h of livingHeroes(ww)) {
                  if (circles.some((cc) => dist(cc, h) <= r)) continue;
                  if (sigHit(ww, boss, h, a) > 0) applyStatus(ww, boss, h, 'furcht', { ms: numParam(params, 'fearMs') });
                }
              },
            }
          : {}),
      });
    }
  },
};
