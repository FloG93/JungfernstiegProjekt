// Bomber (9.3): läuft auf einen Helden zu und explodiert nach 1,0 s Anzeige oder bei Tod (8 % RefLeben, Radius 100).
import { foeHit, killUnit } from '../combat';
import { numParam } from '../heroutil';
import { addZone } from '../zones';
import { PERCENT, dist, unitById, unitsInZone } from '../util';
import type { Unit, World } from '../types';
import type { HandlerModule, Params } from './types';

function fuse(w: World, u: Unit, params: Params): void {
  const hs = u.foe!.hs;
  if (hs['fuseAt'] !== undefined) return;
  const r = numParam(params, 'radiusPx');
  hs['fuseAt'] = w.t + numParam(params, 'fuseMs');
  const element = u.element;
  const level = w.scenario.attackerLevel(w);
  const amount = (numParam(params, 'pctRefHp') / PERCENT) * w.scenario.refLife(w);
  addZone(w, {
    kind: 'telegraph', shape: 'circle', x: u.x, y: u.y, w: r, h: r, endsAt: hs['fuseAt'], affects: 'hero', srcId: u.id,
    label: 'bomber',
    onEnd: (ww, z) => {
      if (hs['exploded']) return;
      hs['exploded'] = 1;
      for (const h of unitsInZone(ww, z)) {
        foeHit(ww, null, h, { amount, physical: element === 'physisch', element, attackerLevel: level });
      }
      if (!u.dead) {
        hs['selfDestruct'] = 1;
        killUnit(ww, u, null);
      }
    },
  });
}

export const enemy_bomber: HandlerModule = {
  id: 'enemy_bomber',
  update(w, u, params) {
    const f = u.foe!;
    if (f.hs['fuseAt'] !== undefined) return;
    const t = unitById(w, f.targetId);
    if (t && !t.dead && dist(u, t) <= f.rangePx) fuse(w, u, params);
  },
  onDeath(w, u, params) {
    if (u.foe!.hs['fuseAt'] !== undefined || numParam(params, 'explodeOnDeath') <= 0) return;
    if (!w.content.engine.enemy.bomberDeathFuse) return;
    fuse(w, u, params);
  },
};
