// Spott (4.5): Gegner im Radius greifen den Krieger an; Bosse: Bedrohung auf Maximum plus 10 %.
import { applyStatus } from '../status';
import { numParam } from '../heroutil';
import { PERCENT } from '../util';
import type { HandlerModule } from './types';

export const taunt: HandlerModule = {
  id: 'taunt',
  cast({ w, caster, params, recipients }) {
    const ms = numParam(params, 'ms');
    for (const f of recipients) {
      if (!f.foe) continue;
      if (f.kind === 'boss') {
        let max = 0;
        for (const v of f.foe.threat.values()) max = Math.max(max, v);
        const own = f.foe.threat.get(caster.id) ?? 0;
        f.foe.threat.set(caster.id, Math.max(own, max * (1 + numParam(params, 'bossThreatBonusPct') / PERCENT)));
      }
      f.foe.tauntById = caster.id;
      f.foe.tauntUntil = w.t + ms;
      f.foe.targetId = caster.id;
      applyStatus(w, caster, f, 'verspottet', { ms });
    }
  },
};
