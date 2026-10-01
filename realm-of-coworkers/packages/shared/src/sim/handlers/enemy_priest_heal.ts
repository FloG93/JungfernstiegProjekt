// Priester (9.3): heilt alle 3 s den verwundetsten Verbündeten im Umkreis 400 px um 5 % seines Max-Lebens.
// 1,0 s Zauberzeit mit sichtbarer Anzeige, Betäubung unterbricht.
import { healUnit } from '../combat';
import { canAct } from '../effstats';
import { numParam } from '../heroutil';
import { addZone, removeZone } from '../zones';
import { MS_PER_S, PERCENT, dist, emit, hpFrac, livingFoes } from '../util';
import type { Unit, World } from '../types';
import type { HandlerModule, Params } from './types';

function woundedAlly(w: World, u: Unit, params: Params): Unit | undefined {
  const r = numParam(params, 'radiusPx');
  return livingFoes(w)
    .filter((f) => f.hp < f.maxHp && dist(u, f) <= r)
    .sort((a, b) => hpFrac(a) - hpFrac(b) || a.id - b.id)[0];
}

export const enemy_priest_heal: HandlerModule = {
  id: 'enemy_priest_heal',
  setup(w, u, params) {
    u.foe!.hs['healAt'] = w.t + numParam(params, 'everyS') * MS_PER_S;
  },
  update(w, u, params) {
    const hs = u.foe!.hs;
    const castUntil = hs['castUntil'];
    if (castUntil !== undefined) {
      if (!canAct(u) && numParam(params, 'interruptible') > 0) {
        delete hs['castUntil'];
        if (hs['castZone'] !== undefined) removeZone(w, hs['castZone']);
        hs['healAt'] = w.t + numParam(params, 'everyS') * MS_PER_S;
        return;
      }
      if (w.t < castUntil) return;
      delete hs['castUntil'];
      const t = woundedAlly(w, u, params);
      if (t) healUnit(w, u, t, (t.maxHp * numParam(params, 'pctMaxHp')) / PERCENT, {});
      hs['healAt'] = w.t + numParam(params, 'everyS') * MS_PER_S;
      return;
    }
    if (w.t < (hs['healAt'] ?? Infinity) || !canAct(u)) return;
    const t = woundedAlly(w, u, params);
    if (!t) return;
    const castMs = numParam(params, 'castMs');
    hs['castUntil'] = w.t + castMs;
    const z = addZone(w, {
      kind: 'aura', shape: 'circle', x: u.x, y: u.y, w: numParam(params, 'radiusPx'), h: numParam(params, 'radiusPx'),
      endsAt: w.t + castMs, affects: 'foe', srcId: u.id, followId: u.id, label: 'priester_heilung',
    });
    hs['castZone'] = z.id;
    emit(w, { e: 'cast', id: u.id, skill: 'priester_heilung', tid: t.id });
  },
};
