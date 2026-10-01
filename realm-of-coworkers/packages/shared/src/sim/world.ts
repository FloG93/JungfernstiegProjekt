// Welt und Tick-Schleife (11.7): 1. Eingaben, 2. Gegner und Bosse, 3. Bewegung, 4. Spawns,
// 5. Auto-Cast und Fähigkeiten, 6. Treffer, 7. Effekte, 8. Tod und Beute, 9. Snapshot (außerhalb).
import type { Content } from '../content/loader';
import { Rng } from '../rng';
import { doPotion, doRoll, doSwap, setFocus, startRevive, updateRevive } from './actions';
import { runAutocast } from './autocast';
import { attackRate, cooldownRate } from './effstats';
import { updateFoes } from './foes';
import { clampUnits, moveHero, separate } from './movement';
import { castSkill, tickCooldowns } from './skills';
import { tickStatuses } from './status';
import type { HeroInput, Scenario, SimOptions, Unit, World } from './types';
import { MS_PER_S, unitById } from './util';
import { updateZones } from './zones';

export interface CreateWorldOpts {
  seed: number;
  n?: number;
  opts?: SimOptions;
  scenario: Scenario;
}

export function createWorld(content: Content, o: CreateWorldOpts): World {
  return {
    content,
    rng: new Rng(o.seed),
    seed: o.seed,
    tick: 0,
    t: 0,
    tickMs: MS_PER_S / content.balance.combat.tickRate,
    nextId: 1,
    units: [],
    zones: [],
    events: [],
    removed: [],
    scenario: o.scenario,
    n: o.n ?? 1,
    paused: false,
    opts: o.opts ?? {},
    heroSkillDefs: new Map(),
    boss: null,
  };
}

/** Wendet die Eingaben eines Helden an (Schritt 1). Ungültige Aktionen werden still verworfen (2.6). */
export function applyInput(w: World, u: Unit, input: HeroInput): void {
  const h = u.hero;
  if (!h) return;
  h.input.mx = Math.sign(input.mx);
  h.input.my = Math.sign(input.my);
  h.input.moveTo = input.tx !== undefined && input.ty !== undefined ? { x: input.tx, y: input.ty } : h.input.moveTo;
  if (input.mx !== 0 || input.my !== 0) h.input.moveTo = null;
  h.input.lastInputAt = w.t;
  for (const a of input.act ?? []) {
    switch (a.k) {
      case 'skill': {
        const o: { targetId?: number; x?: number; y?: number; auto: boolean } = { auto: false };
        if (a.target !== undefined) o.targetId = a.target;
        if (a.x !== undefined) o.x = a.x;
        if (a.y !== undefined) o.y = a.y;
        castSkill(w, u, a.id, o);
        break;
      }
      case 'roll':
        doRoll(w, u, { x: h.input.mx || u.face, y: h.input.my });
        break;
      case 'swap':
        doSwap(w, u);
        break;
      case 'potion':
        doPotion(w, u);
        break;
      case 'focus':
        setFocus(w, u, a.targetId);
        break;
      case 'revive':
        startRevive(w, u, a.targetId);
        break;
    }
  }
}

/** Ein Tick der Simulation. Ereignisse des Ticks stehen danach in w.events. */
export function stepWorld(w: World, inputs?: ReadonlyMap<number, HeroInput[]>): void {
  w.events = [];
  w.removed = [];
  if (w.paused) return;
  w.tick++;
  w.t += w.tickMs;

  // 1. Eingaben
  if (inputs) {
    for (const [id, list] of inputs) {
      const u = unitById(w, id);
      if (u?.hero) for (const inp of list) applyInput(w, u, inp);
    }
  }
  // 2. Gegner und Bosse
  updateFoes(w);
  // 3. Bewegung
  for (const u of w.units) if (u.hero) moveHero(w, u);
  separate(w);
  clampUnits(w);
  // 4. Spawns und Ablauf
  w.scenario.update(w);
  // 5. Auto-Cast und Fähigkeiten
  for (const u of w.units) {
    if (!u.hero || u.dead) continue;
    tickCooldowns(w, u, cooldownRate(w, u), attackRate(w, u));
    updateRevive(w, u);
    runAutocast(w, u);
  }
  // 7. Effekte
  for (const u of w.units) tickStatuses(w, u);
  updateZones(w);
  for (const u of w.units) if (u.state !== 'dead' && u.stateUntil <= w.t && !u.dead) u.state = 'idle';
  // 8. Tote Gegner entfernen
  const keep: Unit[] = [];
  for (const u of w.units) {
    if (u.dead && u.side === 'foe') w.removed.push(u.id);
    else keep.push(u);
  }
  w.units = keep;
}
