// Testhilfen für Gegner- und Boss-Handler (nur Tests).
import type { BossId, EnemyId, HandlerId } from './content/ids';
import { spawnBoss } from './sim/boss';
import { spawnEnemy } from './sim/enemies';
import type { Unit, World } from './sim/types';
import { stepWorld } from './sim/world';
import { trainingWorld } from './testing';
import type { TrainingSetup } from './testing';

export function foeWorld(s: Partial<TrainingSetup> & { chapter?: number } = {}) {
  const chapter = s.chapter ?? 3;
  return trainingWorld({ heroes: s.heroes ?? ['krieger'], ...s, training: { chapter, attackerLevel: chapter * 5, combat: true } });
}

export function enemy(w: World, type: EnemyId, x: number, o: { y?: number; affix?: HandlerId; chapter?: number; level?: number } = {}): Unit {
  const spec: Parameters<typeof spawnEnemy>[1] = {
    type, x, y: o.y ?? 120, level: o.level ?? 15, chapter: o.chapter ?? 3, n: 1, encounter: 0, side: 1,
  };
  if (o.affix) spec.eliteAffix = o.affix;
  return spawnEnemy(w, spec);
}

export function boss(w: World, id: BossId, x = 300): Unit {
  return spawnBoss(w, id, { x, y: 120, kampfstufe: 0 });
}

/** Läuft ms Millisekunden; `each` wird nach jedem Tick gerufen. */
export function steps(w: World, ms: number, each?: () => void): void {
  for (let i = 0; i < Math.round(ms / w.tickMs); i++) {
    stepWorld(w);
    each?.();
  }
}
