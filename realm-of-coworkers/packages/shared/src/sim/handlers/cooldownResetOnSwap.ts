// Elementarfluss (4.6): Waffenwechsel setzt die Abklingzeit von Elementarkugel zurück, höchstens alle 20 s.
import { numParam, strParam } from '../heroutil';
import type { HandlerModule } from './types';

export const cooldownResetOnSwap: HandlerModule = {
  id: 'cooldownResetOnSwap',
  onSwap(w, hero, params) {
    const h = hero.hero;
    if (!h || w.t < h.elementarflussReadyAt) return;
    const sk = h.skills.find((s) => s.def.id === strParam(params, 'skill'));
    if (!sk) return;
    sk.cdLeft = 0;
    h.elementarflussReadyAt = w.t + numParam(params, 'lockoutMs');
  },
};
