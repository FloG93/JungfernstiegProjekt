// Großangriff der Elite (9.7): alle 12 s Bodenschlag, Kreis 120 px, 1,5 s Telegraph, 15 % RefLeben.
import { foeHit } from '../combat';
import { addZone } from '../zones';
import { MS_PER_S, PERCENT, unitsInZone } from '../util';
import type { HandlerModule } from './types';

export const elite_slam: HandlerModule = {
  id: 'elite_slam',
  update(w, u) {
    const s = w.content.elite.slam;
    const f = u.foe!;
    if (w.t < (f.hs['slamAt'] ?? Infinity)) return;
    f.hs['slamAt'] = w.t + s.everyS * MS_PER_S;
    const amount = (s.pctRefHp / PERCENT) * w.scenario.refLife(w);
    const level = w.scenario.attackerLevel(w);
    addZone(w, {
      kind: 'telegraph', shape: 'circle', x: u.x, y: u.y, w: s.radiusPx, h: s.radiusPx, endsAt: w.t + s.telegraphMs,
      affects: 'hero', srcId: u.id, label: 'bodenschlag',
      onEnd: (ww, z) => {
        if (u.dead) return;
        for (const h of unitsInZone(ww, z)) {
          foeHit(ww, u, h, { amount, physical: f.physical, element: u.element, attackerLevel: level });
        }
      },
    });
  },
};
