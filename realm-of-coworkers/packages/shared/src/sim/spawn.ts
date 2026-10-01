// Spawn-Logik (9.5, 9.6, 9.7): Budget aus Wellenpunkten × C(n), Gruppen, Palette, Elite.
import { ENEMY_IDS } from '../content/ids';
import type { EnemyId, HandlerId } from '../content/ids';
import type { Content } from '../content/loader';
import type { StageDef } from '../content/schemas';
import { countFactor } from '../formulas';
import type { Rng } from '../rng';
import { MS_PER_S } from './util';

const EPS = 1e-9;

export interface PlannedEnemy {
  type: EnemyId;
  eliteAffix?: HandlerId;
}

export interface PlannedGroup {
  delayMs: number;
  enemies: PlannedEnemy[];
  elite: boolean;
}

export interface EncounterPlan {
  groups: PlannedGroup[];
  totalWeight: number;
  budget: number;
}

/** Kosten eines Typs im Budget: Gewicht × Gruppengröße (Schwarmlinge 4 × 0,3 = 1,2 Punkte, 9.3). */
export function typeCost(content: Content, id: EnemyId): number {
  const d = content.enemyById[id];
  return d.weight * d.groupSize;
}

/** Füllt eine Gruppe nach der Palette, bis das Budget aufgebraucht ist (9.5, Schritt 2 und 3). */
export function fillGroup(content: Content, rng: Rng, chapter: number, budget: number): PlannedEnemy[] {
  const palette = content.palette[String(chapter)] ?? {};
  const types = ENEMY_IDS.filter((id) => (palette[id] ?? 0) > 0);
  const out: PlannedEnemy[] = [];
  let left = budget;
  const minRest = content.balance.stage.restDropBelow;
  for (;;) {
    if (left < minRest) break;
    const fits = types.filter((id) => typeCost(content, id) <= left + EPS);
    if (fits.length === 0) break;
    const id = rng.weighted(palette, fits);
    left -= typeCost(content, id);
    for (let i = 0; i < content.enemyById[id].groupSize; i++) out.push({ type: id });
  }
  // Mindestens 3 Gegner je Gruppe (9.5, Schritt 3): mit dem günstigsten Typ der Palette auffüllen. OPEN-019
  const minSize = content.balance.stage.minGroupSize;
  if (out.length < minSize && types.length > 0) {
    const cheapest = [...types].sort((a, b) => content.enemyById[a].weight - content.enemyById[b].weight || a.localeCompare(b))[0]!;
    while (out.length < minSize) for (let i = 0; i < content.enemyById[cheapest].groupSize; i++) out.push({ type: cheapest });
  }
  return out;
}

/** Erlaubte Basistypen der Elite im Kapitel (E-012). */
export function eliteBases(content: Content, chapter: number): EnemyId[] {
  const e = content.elite;
  return e.bases.filter((b) => (e.basesFromChapter[b] ?? Infinity) <= chapter);
}

/** Plant alle Gruppen einer Begegnung beim Auslösen (OPEN-019). */
export function planEncounter(content: Content, rng: Rng, stage: StageDef, index: number, n: number): EncounterPlan {
  const enc = stage.encounters[index];
  if (!enc) throw new Error(`Stage ${stage.stage} hat keine Begegnung ${index}`);
  const b = content.balance;
  const cf = countFactor(b, n);
  const eliteCount = enc.elites > 0 ? Math.ceil(enc.elites * cf) : 0;
  const budget = Math.max(0, enc.points * cf - eliteCount * content.elite.replacesPoints);
  const groups: PlannedGroup[] = enc.groupSplit.map((share, i) => ({
    delayMs: (enc.groupDelaysS[i] ?? 0) * MS_PER_S,
    enemies: fillGroup(content, rng, stage.chapter, budget * share),
    elite: false,
  }));
  if (eliteCount > 0) {
    const bases = eliteBases(content, stage.chapter);
    const elites: PlannedEnemy[] = [];
    for (let i = 0; i < eliteCount; i++) elites.push({ type: rng.pick(bases), eliteAffix: rng.pick(content.elite.affixes) });
    const lastDelay = content.engine.enemy.eliteGroupWithLast ? Math.max(...groups.map((g) => g.delayMs)) : 0;
    groups.push({ delayMs: lastDelay, enemies: elites, elite: true });
  }
  let totalWeight = 0;
  for (const g of groups) {
    for (const e of g.enemies) totalWeight += e.eliteAffix ? content.elite.weight : content.enemyById[e.type].weight;
  }
  return { groups, totalWeight, budget };
}
