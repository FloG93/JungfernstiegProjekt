// Läuterung (4.9): entfernt von jedem Verbündeten einen Debuff (Reihenfolge 6.4).
import { numParam } from '../heroutil';
import { cleanse as cleanseUnit } from '../status';
import type { HandlerModule } from './types';

export const cleanse: HandlerModule = {
  id: 'cleanse',
  cast({ w, params, recipients }) {
    const n = numParam(params, 'perAlly');
    for (const a of recipients) cleanseUnit(w, a, n);
  },
};
