// Schattenschritt (4.8): Teleport hinter das Ziel, Schaden, Tarnung: nächster Treffer +25 %.
import { heroHit } from '../combat';
import { numParam, weaponElement } from '../heroutil';
import { applyStatus } from '../status';
import type { HandlerModule } from './types';

export const teleportBehind: HandlerModule = {
  id: 'teleportBehind',
  cast({ w, caster, params, target }) {
    if (!target || !caster.hero) return;
    const dir = target.x >= caster.x ? 1 : -1;
    caster.x = target.x + dir * w.content.engine.world.separationRadiusPx;
    caster.y = target.y;
    caster.face = dir === 1 ? -1 : 1;
    heroHit(w, caster, target, { coef: numParam(params, 'coef'), element: weaponElement(caster) });
    applyStatus(w, caster, caster, 'tarnung', { ms: numParam(params, 'stealthMs') });
    caster.hero.nextHitBonusPct = numParam(params, 'nextHitBonusPct');
  },
};
