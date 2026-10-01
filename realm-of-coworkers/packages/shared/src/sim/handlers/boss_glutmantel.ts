// Ignarch, Glutmantel (10.6): Nahkämpfer im Umkreis 120 px erhalten alle 3 s Verbrennung (1 Stapel).
import { numParam } from '../heroutil';
import { applyStatus } from '../status';
import { MS_PER_S, dist, livingHeroes } from '../util';
import type { HandlerModule } from './types';

export const boss_glutmantel: HandlerModule = {
  id: 'boss_glutmantel',
  setup(w, u, params) {
    u.foe!.hs['glutAt'] = w.t + numParam(params, 'everyS') * MS_PER_S;
  },
  update(w, u, params) {
    if (w.t < (u.foe!.hs['glutAt'] ?? Infinity)) return;
    u.foe!.hs['glutAt'] = w.t + numParam(params, 'everyS') * MS_PER_S;
    for (const h of livingHeroes(w)) {
      if (dist(u, h) <= numParam(params, 'radiusPx')) {
        applyStatus(w, u, h, 'verbrennung', { stacks: numParam(params, 'stacks'), attackerLevel: u.foe!.level });
      }
    }
  },
};
