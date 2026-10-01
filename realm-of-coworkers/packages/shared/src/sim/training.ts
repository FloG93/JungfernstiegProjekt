// Trainingsablauf für Tests und Messungen: feste Position, Übungsziele ohne Gegenwehr.
import type { ElementId } from '../content/ids';
import { refLife } from '../formulas';
import type { Scenario, Unit, World } from './types';
import { livingFoes, newId } from './util';

export interface TrainingOpts {
  chapter?: number;
  attackerLevel?: number;
  anchorX?: number;
  combat?: boolean;
}

export function trainingScenario(o: TrainingOpts = {}): Scenario {
  const chapter = o.chapter ?? 1;
  return {
    kind: 'training',
    update() {},
    anchor: (w) => ({ x: o.anchorX ?? 0, y: w.content.engine.world.bandDepthPx / 2 }),
    inCombat: (w) => o.combat ?? livingFoes(w).length > 0,
    attackerLevel: () => o.attackerLevel ?? chapter,
    refLife: (w) => refLife(w.content.balance, chapter),
    bounds: () => ({ minX: -Infinity, maxX: Infinity }),
  };
}

/** Leben eines Übungsziels ohne Angabe. */
const DEFAULT_DUMMY_HP = 1_000_000;

export interface DummyOpts {
  x: number;
  y?: number;
  hp?: number;
  kind?: 'enemy' | 'boss';
  armorMit?: number;
  resMit?: number;
  element?: ElementId;
  elite?: boolean;
  immortal?: boolean;
}

/** Übungsziel ohne eigene Angriffe. */
export function addDummy(w: World, o: DummyOpts): Unit {
  const hp = o.hp ?? DEFAULT_DUMMY_HP;
  const u: Unit = {
    id: newId(w), kind: o.kind ?? 'enemy', side: 'foe', x: o.x, y: o.y ?? w.content.engine.world.bandDepthPx / 2,
    face: -1, hp, maxHp: hp, dead: false, state: 'idle', stateUntil: 0, element: o.element ?? 'physisch',
    armorMit: o.armorMit ?? 0, resMit: o.resMit ?? 0, statuses: [], shields: [],
    foe: {
      type: 'scherge', level: 1, dmgPerHit: 0, intervalMs: Infinity, rangePx: 0, speed: 0, ai: 'dummy',
      attackCdLeft: Infinity, threat: new Map(), targetId: null, tauntById: null, tauntUntil: 0, weight: 1,
      encounter: 0, isElite: o.elite ?? false, affix: null, physical: true, hs: {}, rushing: false, spawnedAt: 0, side: 1,
    },
  };
  if (o.immortal) u.immortal = true;
  w.units.push(u);
  if (u.kind === 'boss') w.boss = u;
  return u;
}
