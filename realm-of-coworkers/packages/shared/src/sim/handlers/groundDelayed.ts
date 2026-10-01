// Kataklysmus (4.6): Zielgebiet wird markiert, nach der Verzögerung Schaden auf alle Gegner darin.
import { heroHit } from '../combat';
import { numParam, weaponElement } from '../heroutil';
import { addZone } from '../zones';
import { unitsInZone } from '../util';
import type { HandlerModule } from './types';

export const groundDelayed: HandlerModule = {
  id: 'groundDelayed',
  cast({ w, caster, params, point, target }) {
    const p = point ?? target;
    if (!p) return;
    const r = numParam(params, 'radiusPx');
    addZone(w, {
      kind: 'aura', shape: 'circle', x: p.x, y: p.y, w: r, h: r, endsAt: w.t + numParam(params, 'delayMs'),
      affects: 'foe', srcId: caster.id, label: 'kataklysmus',
      onEnd: (ww, z) => {
        for (const f of unitsInZone(ww, z)) heroHit(ww, caster, f, { coef: numParam(params, 'coef'), element: weaponElement(caster) });
      },
    });
  },
};
