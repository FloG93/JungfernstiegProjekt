// Elite-Affix Schild (9.7): Schild in Höhe von 20 % ihres Lebens, erneuert alle 15 s.
import { setFoeShield } from '../enemies';
import { numParam } from '../heroutil';
import { MS_PER_S } from '../util';
import type { HandlerModule } from './types';

const TAG = 'affix_schild';

export const affix_schild: HandlerModule = {
  id: 'affix_schild',
  setup(w, u, params) {
    setFoeShield(w, u, numParam(params, 'pctMaxHp'), TAG);
    u.foe!.hs['shieldAt'] = w.t + numParam(params, 'renewS') * MS_PER_S;
  },
  update(w, u, params) {
    if (w.t < (u.foe!.hs['shieldAt'] ?? Infinity)) return;
    setFoeShield(w, u, numParam(params, 'pctMaxHp'), TAG);
    u.foe!.hs['shieldAt'] = w.t + numParam(params, 'renewS') * MS_PER_S;
  },
};
