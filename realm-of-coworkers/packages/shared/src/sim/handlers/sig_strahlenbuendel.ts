// Solaris, Strahlenbündel (10.6): 3 rotierende Lichtlinien (Breite 50 px) vom Boss aus, je Treffer 20 % RefLeben.
// Die Linien drehen sich während der Anzeige; maßgeblich ist der Winkel am Ende. OPEN-022
import { numParam } from '../heroutil';
import { addZone } from '../zones';
import { degToRad, pointInZone, livingHeroes } from '../util';
import type { Zone } from '../types';
import { arenaWidth, sigHit, telegraphMs } from './sigCommon';
import type { HandlerModule } from './types';

const FULL_TURN_DEG = 360;

export const sig_strahlenbuendel: HandlerModule = {
  id: 'sig_strahlenbuendel',
  signature(w, boss, a) {
    const params = a.params ?? {};
    const beams = numParam(params, 'beams');
    const width = numParam(params, 'widthPx');
    const len = arenaWidth(w) * 2;
    const base = w.rng.range(0, FULL_TURN_DEG) + w.content.engine.boss.beamRotationDeg;
    const zones: Zone[] = [];
    for (let i = 0; i < beams; i++) {
      const ang = degToRad(base + (i * FULL_TURN_DEG) / beams);
      const z = addZone(w, {
        kind: 'telegraph', shape: 'line', x: boss.x + (Math.cos(ang) * len) / 2, y: boss.y + (Math.sin(ang) * len) / 2,
        w: len, h: width, ang, endsAt: w.t + telegraphMs(w, a), affects: 'hero', srcId: boss.id, label: 'strahlenbuendel',
        ...(i === 0
          ? {
              onEnd: (ww: typeof w) => {
                if (boss.dead) return;
                for (const h of livingHeroes(ww)) if (zones.some((zz) => pointInZone(zz, h))) sigHit(ww, boss, h, a);
              },
            }
          : {}),
      });
      zones.push(z);
    }
  },
};
