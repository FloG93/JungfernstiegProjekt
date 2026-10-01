// Gorthul, Beben (10.6): Kreis 300 px um den Boss, 25 % RefLeben, Betäubung 1,5 s (die Ausweichrolle verhindert sie).
import { numParam } from '../heroutil';
import { applyStatus } from '../status';
import { addZone } from '../zones';
import { unitsInZone } from '../util';
import { sigHit, telegraphMs } from './sigCommon';
import type { HandlerModule } from './types';

export const sig_beben: HandlerModule = {
  id: 'sig_beben',
  signature(w, boss, a) {
    const params = a.params ?? {};
    const r = numParam(params, 'radiusPx');
    addZone(w, {
      kind: 'telegraph', shape: 'circle', x: boss.x, y: boss.y, w: r, h: r, endsAt: w.t + telegraphMs(w, a),
      affects: 'hero', srcId: boss.id, followId: boss.id, label: 'beben',
      onEnd: (ww, z) => {
        if (boss.dead) return;
        for (const h of unitsInZone(ww, z)) {
          if (sigHit(ww, boss, h, a) > 0) applyStatus(ww, boss, h, 'betaeubung', { ms: numParam(params, 'stunMs') });
        }
      },
    });
  },
};
