// Glaciara, Eispanzer (10.6): Schild in Höhe von 2 % Boss-Leben, erneuert sich alle 45 s.
import { setFoeShield } from '../enemies';
import { numParam } from '../heroutil';
import { MS_PER_S } from '../util';
import type { HandlerModule } from './types';

const TAG = 'eispanzer';

export const boss_eispanzer: HandlerModule = {
  id: 'boss_eispanzer',
  setup(w, u, params) {
    setFoeShield(w, u, numParam(params, 'pctMaxHp'), TAG);
    u.foe!.hs['eisAt'] = w.t + numParam(params, 'renewS') * MS_PER_S;
  },
  update(w, u, params) {
    if (w.t < (u.foe!.hs['eisAt'] ?? Infinity)) return;
    setFoeShield(w, u, numParam(params, 'pctMaxHp'), TAG);
    u.foe!.hs['eisAt'] = w.t + numParam(params, 'renewS') * MS_PER_S;
  },
};
