// Einen Run aufsetzen (2.3): Welt, Ablauf einer Stage, Helden in Formation. Ein Codepfad für Solo und Koop.
import type { Content } from '../content/loader';
import { addHero, sameClassIndices } from './heroes';
import { RunScenario } from './stage';
import type { RunConfig } from './stage';
import type { HeroSetup, SimOptions, Unit, World } from './types';
import { createWorld } from './world';

export interface RunSetup extends RunConfig {
  seed: number;
  heroes: HeroSetup[];
  opts?: SimOptions;
}

export interface Run {
  world: World;
  scenario: RunScenario;
  heroes: Unit[];
}

export function createRun(content: Content, s: RunSetup): Run {
  const scenario = new RunScenario(content, s);
  const n = s.heroes.length;
  const world = createWorld(content, { seed: s.seed, n, scenario, ...(s.opts ? { opts: s.opts } : {}) });
  const idx = sameClassIndices(s.heroes);
  const anchor = scenario.anchor(world);
  const heroes = s.heroes.map((h, i) => {
    const u = addHero(world, h, { x: 0, sameClassIndex: idx[i] ?? 0, solo: n === 1 });
    u.x = anchor.x + u.hero!.formationOffsetX;
    return u;
  });
  return { world, scenario, heroes };
}
