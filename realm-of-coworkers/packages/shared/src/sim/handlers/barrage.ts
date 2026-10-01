// Pfeilhagel (4.7): Pfeile in einen Zielkreis; jeder Pfeil trifft einen Gegner im Kreis. OPEN-011
import { heroHit } from '../combat';
import { numParam, weaponElement } from '../heroutil';
import { addZone } from '../zones';
import { unitsInZone } from '../util';
import type { HandlerModule } from './types';

export const barrage: HandlerModule = {
  id: 'barrage',
  cast({ w, caster, params, point, target }) {
    const p = point ?? target;
    if (!p) return;
    const arrows = numParam(params, 'arrows');
    const step = numParam(params, 'durationMs') / arrows;
    let fired = 0;
    addZone(w, {
      kind: 'aura', shape: 'circle', x: p.x, y: p.y, w: numParam(params, 'radiusPx'), h: numParam(params, 'radiusPx'),
      endsAt: w.t + numParam(params, 'durationMs'), affects: 'foe', srcId: caster.id, tickMs: step, label: 'pfeilhagel',
      onTick: (ww, zone) => {
        if (fired >= arrows || caster.dead) return;
        fired++;
        const inside = unitsInZone(ww, zone);
        if (inside.length === 0) return;
        heroHit(ww, caster, ww.rng.pick(inside), { coef: numParam(params, 'coef'), element: weaponElement(caster) });
      },
    });
  },
};
