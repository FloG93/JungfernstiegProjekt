// Elite-Affix Regenerierend (9.7): 1 % Max-Leben pro Sekunde, nicht während Betäubung.
import { canAct } from '../effstats';
import { numParam } from '../heroutil';
import { MS_PER_S, PERCENT } from '../util';
import type { HandlerModule } from './types';

export const affix_regenerierend: HandlerModule = {
  id: 'affix_regenerierend',
  update(w, u, params) {
    if (!canAct(u) || u.hp >= u.maxHp) return;
    u.hp = Math.min(u.maxHp, u.hp + (u.maxHp * numParam(params, 'pctMaxHpPerS') * w.tickMs) / PERCENT / MS_PER_S);
  },
};
