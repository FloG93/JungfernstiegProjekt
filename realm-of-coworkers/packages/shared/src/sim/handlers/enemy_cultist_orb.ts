// Kultist (9.3): feuert Elementarkugeln mit 0,6 s Anzeige auf ein zufälliges Ziel.
import { foeHit } from '../combat';
import { numParam } from '../heroutil';
import { addZone } from '../zones';
import { emit, unitsInZone } from '../util';
import type { HandlerModule } from './types';

export const enemy_cultist_orb: HandlerModule = {
  id: 'enemy_cultist_orb',
  attack(w, u, target, params) {
    const r = w.content.engine.enemy.cultistOrbRadiusPx;
    const f = u.foe!;
    const level = w.scenario.attackerLevel(w);
    emit(w, { e: 'cast', id: u.id, skill: 'kultist_kugel', tid: target.id });
    addZone(w, {
      kind: 'telegraph', shape: 'circle', x: target.x, y: target.y, w: r, h: r, endsAt: w.t + numParam(params, 'telegraphMs'),
      affects: 'hero', srcId: u.id, label: 'kultist_kugel',
      onEnd: (ww, z) => {
        if (u.dead) return;
        for (const h of unitsInZone(ww, z)) {
          foeHit(ww, u, h, { amount: f.dmgPerHit, physical: f.physical, element: u.element, attackerLevel: level });
        }
      },
    });
    return true;
  },
};
