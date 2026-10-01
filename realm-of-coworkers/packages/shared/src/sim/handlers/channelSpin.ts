// Klingentanz (4.8): Wirbel mit mehreren Treffern auf Ziel und Gegner im Radius, dabei unverwundbar.
import { heroHit } from '../combat';
import { numParam, weaponElement } from '../heroutil';
import { applyStatus } from '../status';
import { addZone } from '../zones';
import { dist, enemiesOf } from '../util';
import type { HandlerModule } from './types';

export const channelSpin: HandlerModule = {
  id: 'channelSpin',
  cast({ w, caster, params, target }) {
    const hits = numParam(params, 'hits');
    const duration = numParam(params, 'durationMs');
    const radius = numParam(params, 'radiusPx');
    if (params['invulnerable'] === true) applyStatus(w, caster, caster, 'unverwundbar', { ms: duration });
    let done = 0;
    addZone(w, {
      kind: 'aura', shape: 'circle', x: caster.x, y: caster.y, w: radius, h: radius, endsAt: w.t + duration,
      affects: 'foe', srcId: caster.id, tickMs: duration / hits, followId: caster.id, label: 'klingentanz',
      onTick: (ww) => {
        if (done >= hits || caster.dead) return;
        done++;
        const set = new Map<number, (typeof ww.units)[number]>();
        if (target && !target.dead && target.side !== caster.side) set.set(target.id, target);
        for (const f of enemiesOf(ww, caster)) if (dist(f, caster) <= radius) set.set(f.id, f);
        for (const f of [...set.values()].sort((a, b) => a.id - b.id)) {
          heroHit(ww, caster, f, { coef: numParam(params, 'coef'), element: weaponElement(caster) });
        }
      },
    });
  },
};
