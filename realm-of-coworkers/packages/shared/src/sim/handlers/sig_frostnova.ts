// Glaciara, Frostnova (10.6): Kreis 260 px um den Boss, 20 % RefLeben, Frost 2 Stapel (Fernkämpfer sind sicher).
import { numParam } from '../heroutil';
import { applyStatus } from '../status';
import { addZone } from '../zones';
import { unitsInZone } from '../util';
import { sigHit, telegraphMs } from './sigCommon';
import type { HandlerModule } from './types';

export const sig_frostnova: HandlerModule = {
  id: 'sig_frostnova',
  signature(w, boss, a) {
    const params = a.params ?? {};
    const r = numParam(params, 'radiusPx');
    addZone(w, {
      kind: 'telegraph', shape: 'circle', x: boss.x, y: boss.y, w: r, h: r, endsAt: w.t + telegraphMs(w, a),
      affects: 'hero', srcId: boss.id, followId: boss.id, label: 'frostnova',
      onEnd: (ww, z) => {
        if (boss.dead) return;
        for (const h of unitsInZone(ww, z)) {
          if (sigHit(ww, boss, h, a) > 0) applyStatus(ww, boss, h, 'frost', { stacks: numParam(params, 'frostStacks') });
        }
      },
    });
  },
};
