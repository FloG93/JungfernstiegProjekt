// Solaris, Sonnenschild (10.6): Schild in Höhe von 3 % Boss-Leben zu Beginn jeder Phase.
import { setFoeShield } from '../enemies';
import { numParam } from '../heroutil';
import type { HandlerModule } from './types';

export const boss_sonnenschild: HandlerModule = {
  id: 'boss_sonnenschild',
  onPhaseStart(w, boss, _phase, params) {
    setFoeShield(w, boss, numParam(params, 'pctMaxHp'), 'sonnenschild');
  },
};
