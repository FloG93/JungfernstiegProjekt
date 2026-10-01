// Voltrax, Kettenblitz (10.6): springt 5-mal zwischen Helden (Sprungradius 300 px), je Sprung 15 % RefLeben,
// danach Schock (6 s). Das erste Ziel wird 1,5 s markiert; Ausweichrolle oder Abstand > 300 px unterbrechen. OPEN-021
import { numParam } from '../heroutil';
import { applyStatus } from '../status';
import { addZone } from '../zones';
import { dist, livingHeroes } from '../util';
import type { Unit } from '../types';
import { sigHit, telegraphMs } from './sigCommon';
import type { HandlerModule } from './types';

export const sig_kettenblitz: HandlerModule = {
  id: 'sig_kettenblitz',
  signature(w, boss, a) {
    const params = a.params ?? {};
    const living = livingHeroes(w);
    if (living.length === 0) return;
    const first = w.rng.pick(living);
    const r = w.content.engine.world.separationRadiusPx * 2;
    addZone(w, {
      kind: 'telegraph', shape: 'circle', x: first.x, y: first.y, w: r, h: r, endsAt: w.t + telegraphMs(w, a),
      affects: 'hero', srcId: boss.id, followId: first.id, label: 'kettenblitz',
      onEnd: (ww) => {
        if (boss.dead || first.dead) return;
        const hit: Unit[] = [];
        let current: Unit | undefined = first;
        let previous: Unit | undefined;
        for (let i = 0; i < numParam(params, 'jumps') && current; i++) {
          if (sigHit(ww, boss, current, a) > 0 && !hit.includes(current)) hit.push(current);
          const from: Unit = current;
          const next: Unit | undefined = livingHeroes(ww)
            .filter((h) => h.id !== from.id && h.id !== previous?.id && dist(h, from) <= numParam(params, 'jumpRadiusPx'))
            .sort((x, y) => dist(x, from) - dist(y, from) || x.id - y.id)[0]
            ?? livingHeroes(ww).filter((h) => h.id !== from.id && dist(h, from) <= numParam(params, 'jumpRadiusPx'))[0];
          previous = from;
          current = next;
        }
        for (const h of hit) applyStatus(ww, boss, h, 'schock', { ms: numParam(params, 'shockMs') });
      },
    });
  },
};
