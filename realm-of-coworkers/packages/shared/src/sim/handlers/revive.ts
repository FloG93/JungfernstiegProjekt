// Wunder (4.9): belebt alle gefallenen Verbündeten mit 30 % Leben wieder.
import { reviveUnit } from '../combat';
import { numParam } from '../heroutil';
import type { HandlerModule } from './types';

export const revive: HandlerModule = {
  id: 'revive',
  cast({ w, caster, params }) {
    for (const u of w.units) {
      if (u.side === caster.side && u.dead && u.hero) reviveUnit(w, u, numParam(params, 'pct'));
    }
  },
};
