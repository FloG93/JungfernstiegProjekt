// Fallensteller (4.7): Falle am Boden, löst bei Gegnern im Radius aus. Höchstens maxActive Fallen je Held.
import { heroHit } from '../combat';
import { numParam, weaponElement } from '../heroutil';
import { applyStatus } from '../status';
import { addZone, removeZone } from '../zones';
import { unitsInZone } from '../util';
import type { HandlerModule } from './types';

export const trap: HandlerModule = {
  id: 'trap',
  cast({ w, caster, params, point, target }) {
    const h = caster.hero;
    const p = point ?? target;
    if (!h || !p) return;
    const maxActive = numParam(params, 'maxActive');
    h.trapIds = h.trapIds.filter((id) => w.zones.some((z) => z.id === id));
    while (h.trapIds.length >= maxActive) removeZone(w, h.trapIds.shift()!);
    const z = addZone(w, {
      kind: 'trap', shape: 'circle', x: p.x, y: p.y, w: numParam(params, 'radiusPx'), h: numParam(params, 'radiusPx'),
      endsAt: w.t + numParam(params, 'lifetimeMs'), affects: 'foe', srcId: caster.id, tickMs: w.tickMs, label: 'falle',
      onTick: (ww, zone) => {
        const inside = unitsInZone(ww, zone);
        if (inside.length === 0 || caster.dead) return;
        removeZone(ww, zone.id);
        for (const f of inside) {
          heroHit(ww, caster, f, { coef: numParam(params, 'coef'), element: weaponElement(caster) });
          if (f.dead) continue;
          if (f.kind === 'boss') {
            applyStatus(ww, caster, f, 'bewegung_malus', { ms: numParam(params, 'bossSlowMs'), value: numParam(params, 'bossSlowPct') });
          } else {
            applyStatus(ww, caster, f, 'wurzel', { ms: numParam(params, 'rootMs') });
          }
        }
      },
    });
    h.trapIds.push(z.id);
  },
};
