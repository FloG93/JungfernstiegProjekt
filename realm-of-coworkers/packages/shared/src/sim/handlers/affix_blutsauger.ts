// Elite-Affix Blutsauger (9.7): heilt sich um 30 % des verursachten Schadens (Wirkung in combat.ts, foeHit).
import { numParam } from '../heroutil';
import { PERCENT } from '../util';
import type { HandlerModule } from './types';

export const affix_blutsauger: HandlerModule = {
  id: 'affix_blutsauger',
  setup(_w, u, params) {
    u.foe!.hs['leechPct'] = numParam(params, 'leechPct') / PERCENT;
  },
};
