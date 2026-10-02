// Abnahme M3: Gegner, Stages, Spawn-Logik, Autowalk, Begegnungen (9, 12.3, 13.7).
import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '../content/ids';
import type { ClassId } from '../content/ids';
import { countFactor } from '../formulas';
import { referenceHero } from '../reference';
import { Rng } from '../rng';
import { testContent } from '../testing';
import { killUnit } from './combat';
import { spawnEnemy } from './enemies';
import { createRun } from './run';
import type { Run } from './run';
import { planEncounter, typeCost } from './spawn';
import type { GameEvent } from './types';
import { stepWorld } from './world';

const c = testContent();

function runUntil(run: Run, done: (ev: GameEvent[]) => boolean, maxMs = 1_800_000): GameEvent[] {
  const all: GameEvent[] = [];
  const w = run.world;
  while (w.t < maxMs) {
    stepWorld(w);
    all.push(...w.events);
    if (done(w.events)) break;
  }
  return all;
}

const finished = (ev: GameEvent[]) => ev.some((e) => e.e === 'stageEnd');

describe('Spawn-Budget (9.5 bis 9.7)', () => {
  it('Budget = Punkte × C(n), Elite ersetzt je 4 Punkte, Gruppen nach groupSplit, mindestens 3 Gegner', () => {
    const st = c.stages[3]!; // Stage 1-4: Elite in Begegnung 4 und 6
    for (const n of [1, 2, 3, 6]) {
      const plan = planEncounter(c, new Rng(n), st, 5, n);
      const cf = countFactor(c.balance, n);
      const elites = Math.ceil(1 * cf);
      expect(plan.budget).toBeCloseTo(14 * cf - elites * 4);
      const eliteGroup = plan.groups.find((g) => g.elite)!;
      expect(eliteGroup.enemies).toHaveLength(elites);
      expect(eliteGroup.enemies.every((e) => e.type === 'scherge' && e.eliteAffix)).toBe(true);
      for (const g of plan.groups.filter((x) => !x.elite)) {
        expect(g.enemies.length).toBeGreaterThanOrEqual(3);
        expect(g.enemies.every((e) => (c.palette['1']![e.type] ?? 0) > 0)).toBe(true);
      }
      const spent = plan.groups.filter((g) => !g.elite).reduce((s, g) => s + g.enemies.reduce((a, e) => a + c.enemyById[e.type].weight, 0), 0);
      expect(spent).toBeLessThanOrEqual(plan.budget + 1e-9);
      expect(spent).toBeGreaterThan(plan.budget - 0.6 * 3);
    }
  });

  it('kein Typ vor seinem Kapitel, Wächter erst ab Kapitel 5 (9.9)', () => {
    const rng = new Rng(9);
    for (const st of c.stages.filter((s) => !s.boss)) {
      for (let i = 0; i < st.encounters.length; i++) {
        const plan = planEncounter(c, rng, st, i, 2);
        for (const g of plan.groups) for (const e of g.enemies) expect(c.palette[String(st.chapter)]![e.type] ?? (e.eliteAffix ? 1 : 0)).toBeGreaterThan(0);
      }
    }
    expect(typeCost(c, 'schwarmling')).toBeCloseTo(1.2);
  });
});

describe('Ablauf einer Stage (9.1, 9.2)', () => {
  it('Autowalk stoppt an jeder Begegnung, Checkpoints füllen Tränke, Ziel am Ende', () => {
    const run = createRun(c, { seed: 3, stage: 3, heroes: [referenceHero(c, 'magier', 5, { allAutocast: true })] });
    const ev = runUntil(run, finished);
    const order = ev.filter((e) => e.e === 'encounter' || e.e === 'checkpoint').map((e) =>
      e.e === 'encounter' ? `${e.state}${e.index}` : `cp${e.e === 'checkpoint' ? e.index : ''}`);
    expect(order).toEqual(['start0', 'end0', 'start1', 'end1', 'cp0', 'start2', 'end2', 'start3', 'end3', 'cp1', 'start4', 'end4', 'start5', 'end5']);
    expect(run.scenario.phase).toBe('won');
    expect(run.scenario.anchorX).toBe(12000);
    expect(ev.some((e) => e.e === 'stageEnd' && e.result === 'win')).toBe(true);
  });

  it('der Anker wartet, solange ein Held weiter als 700 px entfernt ist (Leine)', () => {
    const run = createRun(c, { seed: 1, stage: 1, heroes: [referenceHero(c, 'magier', 5), referenceHero(c, 'krieger', 5, { index: 1 })] });
    const [, kr] = run.heroes;
    kr!.x = -2000;
    kr!.hero!.manualUntil = 1e9;
    for (let i = 0; i < 40; i++) stepWorld(run.world);
    expect(run.scenario.anchorX).toBe(0);
    kr!.hero!.connected = false;
    for (let i = 0; i < 40; i++) stepWorld(run.world);
    expect(run.scenario.anchorX).toBeGreaterThan(0);
  });

  it('Nahkämpfer erreicht einen Fernkämpfer knapp hinter der Leine (OPEN-049)', () => {
    // Früher hielt die Leine den Krieger 700 px vom Anker fest; der Schütze dahinter blieb in seiner Reichweite stehen,
    // keiner traf den anderen entscheidend, und der Run hing (gefunden im Koop-Test nach dem Entfernen eines Helden).
    const run = createRun(c, { seed: 1, stage: 1, heroes: [referenceHero(c, 'krieger', 5)] });
    const w = run.world;
    const start = runUntil(run, (e) => e.some((x) => x.e === 'encounter' && x.state === 'start'));
    const enc = start.find((e) => e.e === 'encounter' && e.state === 'start');
    const kr = run.heroes[0]!;
    const a = run.scenario.anchor(w);
    const leash = c.balance.movement.leashPx;
    const gap = 150;
    const sh = spawnEnemy(w, {
      type: 'schuetze', x: a.x - leash - gap, y: kr.y, level: 1, chapter: 1, n: 1,
      encounter: enc?.e === 'encounter' ? enc.index : 0, side: -1,
    });
    for (const u of w.units) if (u.side === 'foe' && u !== sh) killUnit(w, u, null);
    kr.x = a.x - leash;
    const until = w.t + 30_000;
    while (!sh.dead && w.t < until) stepWorld(w);
    expect(sh.dead).toBe(true);
  });

  it('Topf-Regel: jede Begegnung zahlt genau ihren vollen Topf, auch nach einem Wipe (6.8, 12.3)', () => {
    const run = createRun(c, { seed: 5, stage: 2, heroes: [referenceHero(c, 'waldlaeufer', 5, { allAutocast: true })] });
    const ev = runUntil(run, (e) => e.some((x) => x.e === 'encounter' && x.state === 'end' && x.index === 2));
    // Wipe mitten in Begegnung 4 (Index 3), danach weiter bis zum Ziel
    ev.push(...runUntil(run, (e) => e.some((x) => x.e === 'encounter' && x.state === 'start' && x.index === 3)));
    for (let i = 0; i < 100; i++) {
      stepWorld(run.world);
      ev.push(...run.world.events);
    }
    for (const h of run.heroes) killUnit(run.world, h, null);
    ev.push(...runUntil(run, finished));
    const sum = new Map<number, number>();
    for (const e of ev) if (e.e === 'reward') sum.set(e.encounter, (sum.get(e.encounter) ?? 0) + e.frac);
    expect(run.scenario.wipes).toBe(1);
    for (let i = 0; i < 6; i++) expect(sum.get(i)).toBeCloseTo(1, 9);
  });

  it('Wipe: Neustart am letzten Checkpoint, Begegnungen davor bleiben besiegt', () => {
    const run = createRun(c, { seed: 2, stage: 1, heroes: [referenceHero(c, 'magier', 5, { allAutocast: true })] });
    runUntil(run, (e) => e.some((x) => x.e === 'encounter' && x.state === 'start' && x.index === 2));
    for (const h of run.heroes) killUnit(run.world, h, null);
    stepWorld(run.world);
    expect(run.scenario.anchorX).toBe(4500);
    expect([...run.scenario.cleared].sort()).toEqual([0, 1]);
    expect(run.heroes[0]!.dead).toBe(false);
    expect(run.heroes[0]!.hp).toBe(run.heroes[0]!.maxHp);
    expect(run.world.units.some((u) => u.side === 'foe')).toBe(false);
  });

  it('Gefahren nur in Begegnung 3 und 5, höchstens alle 6 s (9.8)', () => {
    const run = createRun(c, { seed: 4, stage: 7, heroes: [referenceHero(c, 'krieger', 7, { allAutocast: true, strength: 1.5 })] });
    let enc = -1;
    const hazards: { enc: number; t: number }[] = [];
    const w = run.world;
    while (w.t < 1_800_000 && run.scenario.phase !== 'won') {
      stepWorld(w);
      for (const e of w.events) {
        if (e.e === 'encounter') enc = e.state === 'start' ? e.index : -1;
        if (e.e === 'telegraph' && w.zones.find((z) => z.id === e.zone)?.kind === 'hazard') hazards.push({ enc, t: w.t });
      }
    }
    expect(hazards.length).toBeGreaterThan(2);
    expect(new Set(hazards.map((h) => h.enc))).toEqual(new Set([2, 4]));
    for (let i = 1; i < hazards.length; i++) {
      if (hazards[i]!.enc === hazards[i - 1]!.enc) expect(hazards[i]!.t - hazards[i - 1]!.t).toBeGreaterThanOrEqual(6000);
    }
  });

  it('Elite-Beute je Begegnung und Elite höchstens einmal pro Run (6.8, 9.7)', () => {
    const run = createRun(c, { seed: 8, stage: 4, heroes: [referenceHero(c, 'magier', 6, { allAutocast: true, strength: 1.3 })] });
    const ev = runUntil(run, finished);
    const loot = ev.filter((e) => e.e === 'eliteLoot');
    expect(loot.map((e) => (e.e === 'eliteLoot' ? `${e.encounter}:${e.slot}` : ''))).toEqual(['3:0', '5:0']);
  });

  it('gleicher Seed liefert gleiche Ereignisse über eine ganze Stage (2.3)', () => {
    const log = (seed: number) => {
      const run = createRun(c, { seed, stage: 6, heroes: [referenceHero(c, 'schurke', 6, { allAutocast: true }), referenceHero(c, 'kleriker', 6, { index: 1 })] });
      return runUntil(run, finished).map((e) => JSON.stringify(e));
    };
    const a = log(11);
    expect(a.length).toBeGreaterThan(2000);
    expect(log(11)).toEqual(a);
    expect(log(12)).not.toEqual(a);
  });
});

describe('Kampfzeit pro Stage (13.7)', () => {
  /**
   * Zeit, in der mindestens ein Gegner in Reichweite eines Helden steht (reine Kampfzeit).
   * Wie im Modell ohne Auto-Ausweichen (E-023 ist eine Ergänzung außerhalb des Modells).
   */
  function combatTime(classes: ClassId[], s: number, seeds: number[], allAutocast: boolean): number {
    const base = c.stages[(s % 5 === 0 ? s - 1 : s) - 1]!;
    const def = { ...base, stage: s, recommendedLevel: s };
    let total = 0;
    for (const seed of seeds) {
      const run = createRun(c, { seed, stage: s, stageDef: def, heroes: classes.map((cl, i) => referenceHero(c, cl, s, { allAutocast, index: i, autoDodge: false })) });
      const w = run.world;
      while (run.scenario.phase !== 'won' && w.t < 1_800_000) {
        stepWorld(w);
        if (run.scenario.phase !== 'fight') continue;
        const foes = w.units.filter((u) => u.side === 'foe' && !u.dead);
        const active = foes.some((f) => w.units.some((h) => h.hero && !h.dead && Math.hypot(h.x - f.x, h.y - f.y) <= c.classById[h.hero.classId].rangePx));
        if (active) total += w.tickMs;
      }
    }
    return total / seeds.length / 1000;
  }

  it('alle 6 Klassen (n = 6, Auto-Cast laut Daten): Stage 10 und 30 innerhalb ±15 % von 161 s und 160 s', () => {
    expect(Math.abs(combatTime([...CLASS_IDS], 10, [1, 2, 3, 4], false) / 161 - 1)).toBeLessThanOrEqual(0.15);
    expect(Math.abs(combatTime([...CLASS_IDS], 30, [1, 2, 3, 4], false) / 160 - 1)).toBeLessThanOrEqual(0.15);
  });

  it('Magier und Schurke solo (Auto-Cast für alles, 13.1): Stage 10 innerhalb ±15 %', () => {
    expect(Math.abs(combatTime(['magier'], 10, [1, 2, 3, 4], true) / 110 - 1)).toBeLessThanOrEqual(0.15);
    expect(Math.abs(combatTime(['schurke'], 10, [1, 2, 3, 4], true) / 215 - 1)).toBeLessThanOrEqual(0.15);
  });
});
