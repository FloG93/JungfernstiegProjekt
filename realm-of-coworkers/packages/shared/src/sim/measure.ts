// Messung von K je Klasse mit der echten Simulation (13.2, 13.10, Abnahme M2).
// Held ohne Ausrüstung gegen ein Ziel ohne Mitigation; alle Fähigkeiten feuern, sobald sie bereit sind (13.1).
import type { ClassId } from '../content/ids';
import type { Content } from '../content/loader';
import { applyCaps, computeStats } from '../stats';
import { addHero } from './heroes';
import { addDummy, trainingScenario } from './training';
import type { HeroSetup } from './types';
import { MS_PER_S, PERCENT } from './util';
import { createWorld, stepWorld } from './world';

/** Modellannahme 13.1: Krit-Bonus im Mittel 1 + 0,5 × Krit-Chance bei Krit-Schaden 150 %. */
const CRIT_MODEL_FACTOR = 0.5;
const MEASURE_LEVEL = 10;

export interface KMeasurement {
  classId: ClassId;
  k: number;
  casts: Record<string, number>;
}

export function measureK(content: Content, classId: ClassId, seconds: number, seed = 1): KMeasurement {
  const w = createWorld(content, { seed, n: 1, opts: { castAllWhenReady: true }, scenario: trainingScenario({ combat: true }) });
  const stats = computeStats(content, { classId, level: MEASURE_LEVEL, items: [] }, { caps: false });
  const setup: HeroSetup = {
    dbId: 1, playerId: 'messung', name: 'Messung', classId, level: MEASURE_LEVEL,
    sets: {
      A: { stats, element: 'physisch', effectBoss: null, hasWeapon: true },
      B: { stats, element: 'physisch', effectBoss: null, hasWeapon: false },
    },
    activeSet: 'A', artifacts: [], autocast: {}, autoPotion: false,
  };
  const hero = addHero(w, setup, { x: 0, solo: false });
  const meleeRange = Math.min(...content.classes.map((c) => c.rangePx));
  addDummy(w, { x: meleeRange / 2, kind: 'boss', immortal: true, hp: Number.MAX_SAFE_INTEGER });
  const casts: Record<string, number> = {};
  const ticks = Math.round((seconds * MS_PER_S) / w.tickMs);
  for (let i = 0; i < ticks; i++) {
    stepWorld(w);
    for (const e of w.events) if (e.e === 'cast' && e.id === hero.id) casts[e.skill] = (casts[e.skill] ?? 0) + 1;
  }
  // Grund-Krit (ohne Passiv) steckt im Modell außerhalb von K, das Passiv des Schurken innerhalb (13.2).
  const baseCrit = applyCaps(content, computeStats(content, { classId, level: MEASURE_LEVEL, items: [] }, { passives: false }), false).krt;
  const k = hero.hero!.meter.kCoef / seconds / (1 + (baseCrit / PERCENT) * CRIT_MODEL_FACTOR);
  return { classId, k, casts };
}
