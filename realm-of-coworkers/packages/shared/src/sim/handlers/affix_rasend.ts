// Elite-Affix Rasend (9.7): +30 % Angriffs- und Bewegungstempo unter 50 % Leben (Wirkung in effstats.ts).
import { numParam } from '../heroutil';
import { PERCENT } from '../util';
import type { HandlerModule } from './types';

export const affix_rasend: HandlerModule = {
  id: 'affix_rasend',
  setup(_w, u, params) {
    u.foe!.hs['rasendBelow'] = numParam(params, 'belowPct') / PERCENT;
    u.foe!.hs['rasendSpeed'] = numParam(params, 'speedPct') / PERCENT;
  },
};
