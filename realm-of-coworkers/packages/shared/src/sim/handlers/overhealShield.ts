// Gnade (4.9): Überheilung wird zu einem Schild, höchstens 10 % Max-Leben des Ziels, 6 s.
import { addShield } from '../combat';
import { numParam } from '../heroutil';
import { PERCENT } from '../util';
import type { HandlerModule } from './types';

export const overhealShield: HandlerModule = {
  id: 'overhealShield',
  onOverheal(w, healer, target, over, params) {
    const cap = (target.maxHp * numParam(params, 'maxPctMaxHp')) / PERCENT;
    const ms = numParam(params, 'ms');
    const existing = target.shields.find((s) => s.tag === 'gnade');
    if (existing) {
      existing.amount = Math.min(cap, existing.amount + over);
      existing.endsAt = w.t + ms;
      return;
    }
    addShield(w, healer, target, Math.min(cap, over), ms, 'gnade');
  },
};
