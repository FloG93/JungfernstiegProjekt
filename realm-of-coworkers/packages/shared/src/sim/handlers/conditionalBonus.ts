// Meucheln (4.8): ×1,5 gegen Ziele mit Gift, Blutung, Verbrennung oder Schwächung.
import type { StatusId } from '../../content/ids';
import { heroHit } from '../combat';
import { numParam, strParam, weaponElement } from '../heroutil';
import type { HandlerModule } from './types';

export const conditionalBonus: HandlerModule = {
  id: 'conditionalBonus',
  cast({ w, caster, params, target }) {
    if (!target) return;
    const list = strParam(params, 'statuses').split(',').map((s) => s.trim()) as StatusId[];
    const weakened = params['orWeakened'] === true
      && target.statuses.some((s) => w.content.statusById[s.id].weakening);
    const ok = weakened || target.statuses.some((s) => list.includes(s.id));
    heroHit(w, caster, target, {
      coef: numParam(params, 'coef'), element: weaponElement(caster), condMult: ok ? numParam(params, 'mult') : 1,
    });
  },
};
