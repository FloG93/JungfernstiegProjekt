// Ignarch, Glutregen (10.6): 8 Feuersäulen (Radius 90 px) an zufälligen Orten im Band, je 20 % RefLeben.
import { numParam } from '../heroutil';
import { addZone } from '../zones';
import { unitsInZone } from '../util';
import { arenaWidth, sigHit, telegraphMs } from './sigCommon';
import type { HandlerModule } from './types';

export const sig_glutregen: HandlerModule = {
  id: 'sig_glutregen',
  signature(w, boss, a) {
    const params = a.params ?? {};
    const r = numParam(params, 'radiusPx');
    const minX = w.scenario.bounds(w).minX;
    const width = arenaWidth(w);
    const depth = w.content.engine.world.bandDepthPx;
    for (let i = 0; i < numParam(params, 'pillars'); i++) {
      addZone(w, {
        kind: 'telegraph', shape: 'circle', x: minX + w.rng.range(0, width), y: w.rng.range(0, depth), w: r, h: r,
        endsAt: w.t + telegraphMs(w, a), affects: 'hero', srcId: boss.id, label: 'glutregen',
        onEnd: (ww, z) => {
          if (boss.dead) return;
          for (const h of unitsInZone(ww, z)) sigHit(ww, boss, h, a);
        },
      });
    }
  },
};
