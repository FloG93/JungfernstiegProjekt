// Gemeinsame Hilfen für Tests und Messungen (nur Node).
import type { ClassId, ElementId } from './content/ids';
import type { Content } from './content/loader';
import { loadContentFromDir } from './node';
import type { HeroSetup, Unit, WeaponInfo, World } from './sim/types';
import { addDummy, trainingScenario } from './sim/training';
import type { DummyOpts, TrainingOpts } from './sim/training';
import { addHero } from './sim/heroes';
import { createWorld, stepWorld } from './sim/world';
import { castSkill } from './sim/skills';
import { computeStats } from './stats';
import type { StatInput } from './stats';

let cached: Content | undefined;

/** Lädt die echten Inhaltsdateien einmal je Testprozess. */
export function testContent(): Content {
  cached ??= loadContentFromDir();
  return cached;
}

export interface TestHeroOpts {
  level?: number;
  element?: ElementId;
  elementB?: ElementId;
  items?: StatInput['items'];
  autocast?: Record<string, boolean>;
  artifacts?: HeroSetup['artifacts'];
  autoPotion?: boolean;
  name?: string;
  dbId?: number;
  /** Krit-Chance 0, damit Schaden in Tests exakt ist. */
  noCrit?: boolean;
}

/** Held ohne Ausrüstung (oder mit gegebenen Items) für Simulationstests. */
export function testHero(content: Content, classId: ClassId, o: TestHeroOpts = {}): HeroSetup {
  const level = o.level ?? 10;
  const stats = computeStats(content, { classId, level, items: o.items ?? [] }, { caps: false });
  if (o.noCrit) stats.krt = 0;
  const set = (element: ElementId, hasWeapon: boolean): WeaponInfo => ({ stats, element, effectBoss: null, hasWeapon });
  return {
    dbId: o.dbId ?? 1,
    playerId: `p-${o.dbId ?? 1}`,
    name: o.name ?? classId,
    classId,
    level,
    sets: { A: set(o.element ?? 'physisch', true), B: set(o.elementB ?? 'physisch', o.elementB !== undefined) },
    activeSet: 'A',
    artifacts: o.artifacts ?? [],
    autocast: o.autocast ?? {},
    autoPotion: o.autoPotion ?? false,
  };
}

export interface TrainingSetup {
  seed?: number;
  heroes: (ClassId | HeroSetup)[];
  dummies?: DummyOpts[];
  castAll?: boolean;
  training?: TrainingOpts;
  solo?: boolean;
  noCrit?: boolean;
  level?: number;
}

/** Welt mit Helden und Übungszielen für Tests. Helden stehen ab x = 0 in einer Reihe. */
export function trainingWorld(s: TrainingSetup): { w: World; heroes: Unit[]; dummies: Unit[] } {
  const c = testContent();
  const w = createWorld(c, {
    seed: s.seed ?? 1,
    n: s.heroes.length,
    opts: { castAllWhenReady: s.castAll ?? false },
    scenario: trainingScenario(s.training ?? {}),
  });
  const heroes = s.heroes.map((h, i) => {
    const setup = typeof h === 'string'
      ? testHero(c, h, { noCrit: s.noCrit ?? true, level: s.level ?? 10, dbId: i + 1, name: `${h}${i}` })
      : h;
    return addHero(w, setup, { x: -i * 10, y: 120, solo: s.solo ?? false });
  });
  const dummies = (s.dummies ?? []).map((d) => addDummy(w, d));
  return { w, heroes, dummies };
}

export function runMs(w: World, ms: number): void {
  const ticks = Math.round(ms / w.tickMs);
  for (let i = 0; i < ticks; i++) stepWorld(w);
}

/** Wirkt eine Fähigkeit sofort (wie eine manuelle Eingabe). */
export function cast(w: World, hero: Unit, skillId: string, o: { targetId?: number; x?: number; y?: number } = {}): boolean {
  return castSkill(w, hero, skillId, { ...o, auto: false });
}

/** Alle Auto-Casts eines Helden aus, damit Tests nur die geprüfte Fähigkeit sehen. */
export function autocastOff(hero: Unit): void {
  for (const s of hero.hero?.skills ?? []) if (s.slot !== 'auto') s.autocast = false;
}

/** Schaltet den Automatikangriff ab (Abklingzeit unendlich), damit nur die geprüfte Fähigkeit trifft. */
export function muteAuto(hero: Unit): void {
  const a = hero.hero?.skills.find((s) => s.slot === 'auto');
  if (a) a.cdLeft = Infinity;
}

/** Läuft ms Millisekunden und sammelt alle Ereignisse. */
export function collect(w: World, ms: number): World['events'] {
  const out: World['events'] = [];
  const ticks = Math.round(ms / w.tickMs);
  for (let i = 0; i < ticks; i++) {
    stepWorld(w);
    out.push(...w.events);
  }
  return out;
}

/** Summe des Schadens an einer Einheit in einer Ereignisliste. */
export function damageTo(events: World['events'], id: number): number {
  let s = 0;
  for (const e of events) if (e.e === 'hit' && e.dst === id) s += e.dmg;
  return s;
}

export function hitsTo(events: World['events'], id: number): number[] {
  const out: number[] = [];
  for (const e of events) if (e.e === 'hit' && e.dst === id && e.dmg > 0) out.push(e.dmg);
  return out;
}
