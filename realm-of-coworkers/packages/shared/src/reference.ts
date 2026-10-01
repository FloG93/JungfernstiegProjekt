// Referenzheld (13.1): Heldenstufe L, alle 7 Slots Selten mit iLvl L, ohne Gems, Artefakte, Waffenstufe.
// Wird von Tests, Messungen und pnpm balance verwendet.
import { SLOT_IDS } from './content/ids';
import type { ClassId, ElementId } from './content/ids';
import type { Content } from './content/loader';
import { itemBudget } from './formulas';
import { distributeBudget } from './items';
import type { HeroSetup } from './sim/types';
import { computeStats } from './stats';

export interface ReferenceOpts {
  element?: ElementId;
  /** Faktor auf Kraft, Leben, Rüstung und Resistenz (erwartete Stärke nach 13.8). */
  strength?: number;
  /** Auch Ultimates im Auto-Cast (Modellannahme 13.1). */
  allAutocast?: boolean;
  index?: number;
  autoDodge?: boolean;
}

export function referenceHero(content: Content, classId: ClassId, level: number, o: ReferenceOpts = {}): HeroSetup {
  const items = SLOT_IDS.map((slot) => {
    const budget = itemBudget(content.balance, slot, level, 'selten');
    return { slot, budget, stats: distributeBudget(content, null, classId, budget), ele: 0 };
  });
  const stats = computeStats(content, { classId, level, items }, { caps: false });
  const f = o.strength ?? 1;
  stats.kra *= f;
  stats.leb *= f;
  stats.rue *= f;
  stats.res *= f;
  const el = o.element ?? 'physisch';
  const i = o.index ?? 0;
  const autocast: Record<string, boolean> = {};
  if (o.allAutocast) for (const id of content.classById[classId].skills) autocast[id] = true;
  const setup: HeroSetup = {
    dbId: i + 1, playerId: `ref-${i}`, name: `${classId}-${i}`, classId, level,
    sets: {
      A: { stats, element: el, effectBoss: null, hasWeapon: true },
      B: { stats, element: 'physisch', effectBoss: null, hasWeapon: false },
    },
    activeSet: 'A', artifacts: [], autocast, autoPotion: true,
  };
  if (o.autoDodge !== undefined) setup.autoDodge = o.autoDodge;
  return setup;
}

/** Neutrales Element je Boss-Kapitel (weder Schwäche noch Resistenz in allen Phasen, 13.5). */
export function neutralElement(content: Content, chapter: number): ElementId {
  const boss = content.bosses.find((b) => b.chapter === chapter);
  const used = new Set<ElementId>();
  for (const p of boss?.phases ?? []) {
    used.add(p.element);
    const weak = content.elementById[p.element].weakTo;
    if (weak) used.add(weak);
  }
  const free = content.elements.map((e) => e.id).filter((e) => e !== 'physisch' && !used.has(e));
  return free[0] ?? 'physisch';
}
