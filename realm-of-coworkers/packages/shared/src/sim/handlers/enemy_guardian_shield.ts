// Wächter (9.3): Die ersten 10 % Leben absorbiert ein Schild, der erst nach 8 s ohne Schaden zurückkehrt.
import { setFoeShield } from '../enemies';
import { numParam } from '../heroutil';
import { MS_PER_S } from '../util';
import type { HandlerModule } from './types';

const TAG = 'waechter';

export const enemy_guardian_shield: HandlerModule = {
  id: 'enemy_guardian_shield',
  setup(w, u, params) {
    setFoeShield(w, u, numParam(params, 'pctMaxHp'), TAG);
  },
  update(w, u, params) {
    if (u.shields.some((s) => s.tag === TAG)) return;
    const last = u.foe!.hs['lastDamageAt'] ?? u.foe!.spawnedAt;
    if (w.t - last >= numParam(params, 'restoreAfterS') * MS_PER_S) setFoeShield(w, u, numParam(params, 'pctMaxHp'), TAG);
  },
};
