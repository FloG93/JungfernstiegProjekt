// Gezielter Schuss (4.7): durchbohrt und trifft den ersten Gegner in gerader Linie dahinter mit 50 %.
import { heroHit } from '../combat';
import { numParam, weaponElement } from '../heroutil';
import { PERCENT, enemiesOf } from '../util';
import type { HandlerModule } from './types';

export const pierce: HandlerModule = {
  id: 'pierce',
  cast({ w, caster, params, target }) {
    if (!target) return;
    const el = weaponElement(caster);
    const dx = target.x - caster.x;
    const dy = target.y - caster.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    heroHit(w, caster, target, { coef: numParam(params, 'coef'), element: el });
    const width = w.content.engine.world.separationRadiusPx;
    let best: { d: number; id: number } | null = null;
    for (const f of enemiesOf(w, caster)) {
      if (f.id === target.id) continue;
      const rx = f.x - caster.x;
      const ry = f.y - caster.y;
      const along = rx * ux + ry * uy;
      const across = Math.abs(-rx * uy + ry * ux);
      if (along <= len || across > width) continue;
      if (!best || along < best.d || (along === best.d && f.id < best.id)) best = { d: along, id: f.id };
    }
    const second = best ? enemiesOf(w, caster).find((f) => f.id === best!.id) : undefined;
    if (second) {
      heroHit(w, caster, second, { coef: numParam(params, 'coef') * (numParam(params, 'secondaryPct') / PERCENT), element: el });
    }
  },
};
