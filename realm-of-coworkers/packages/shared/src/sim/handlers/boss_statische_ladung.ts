// Voltrax, Statische Ladung (10.6): alle 30 s für 8 s Raserei (+25 % Schaden).
import { numParam } from '../heroutil';
import { applyStatus } from '../status';
import { MS_PER_S } from '../util';
import type { HandlerModule } from './types';

export const boss_statische_ladung: HandlerModule = {
  id: 'boss_statische_ladung',
  setup(w, u, params) {
    u.foe!.hs['ladungAt'] = w.t + numParam(params, 'everyS') * MS_PER_S;
  },
  update(w, u, params) {
    if (w.t < (u.foe!.hs['ladungAt'] ?? Infinity)) return;
    u.foe!.hs['ladungAt'] = w.t + numParam(params, 'everyS') * MS_PER_S;
    applyStatus(w, u, u, 'raserei', { ms: numParam(params, 'ms'), value: numParam(params, 'dmgDealtPct') });
  },
};
