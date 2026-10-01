// Abnahme M4: Bosse mit Phasen, Angriffen, Adds, Enrage, Skalierung nach n und Kampfstufe (10, 13.5).
import { describe, expect, it } from 'vitest';
import type { ClassId } from '../content/ids';
import { bossLife, heroMitigation } from '../formulas';
import { neutralElement, referenceHero } from '../reference';
import { autocastOff, testContent } from '../testing';
import { applyDamage, killUnit } from './combat';
import { heroStats } from './effstats';
import { createRun } from './run';
import type { Run } from './run';
import type { GameEvent } from './types';
import { stepWorld } from './world';

const c = testContent();

function bossRun(classes: ClassId[], chapter: number, o: { kampfstufe?: number; strength?: number; seed?: number; allAutocast?: boolean } = {}): Run {
  const el = neutralElement(c, chapter);
  return createRun(c, {
    seed: o.seed ?? 1, stage: chapter * 5, autoBossReady: true, startAtGate: true, kampfstufe: o.kampfstufe ?? 0,
    heroes: classes.map((cl, i) => referenceHero(c, cl, chapter * 5, { element: el, index: i, allAutocast: o.allAutocast ?? true, ...(o.strength ? { strength: o.strength } : {}) })),
  });
}

function toBoss(run: Run): GameEvent[] {
  const ev: GameEvent[] = [];
  while (!run.world.boss && run.world.t < 60_000) {
    stepWorld(run.world);
    ev.push(...run.world.events);
  }
  return ev;
}

describe('Ablauf und Skalierung (10.1, 10.3)', () => {
  it('Bereit, 10 s Countdown, dann Kampf mit vollem Leben und vollen Tränken', () => {
    const run = bossRun(['magier'], 1);
    const ev = toBoss(run);
    const cd = ev.find((e) => e.e === 'stage' && e.phase === 'countdown');
    const start = ev.find((e) => e.e === 'stage' && e.phase === 'boss');
    expect(cd).toBeDefined();
    expect(start).toBeDefined();
    expect(run.scenario.kind).toBe('arena');
    expect(run.world.boss!.x).toBe(1100);
    const h = run.heroes[0]!;
    expect(h.x).toBeGreaterThanOrEqual(200);
    expect(h.x).toBeLessThanOrEqual(700);
    expect(h.hp).toBe(h.maxHp);
  });

  it('Boss-Leben = B × F(n) × (1 + 0,05 × K)', () => {
    const run = bossRun(['magier', 'krieger'], 2, { kampfstufe: 2 });
    toBoss(run);
    expect(run.world.boss!.maxHp).toBe(Math.round(bossLife(c.balance, 18600, 2, 2)));
    expect(Math.round(bossLife(c.balance, 18600, 2, 2))).toBe(Math.round(18600 * 1.75 * 1.1));
  });

  it('Standardangriff: 11 % RefLeben × M(n) × Kampfstufe, physisch gegen Rüstung (10.4)', () => {
    const run = bossRun(['magier'], 3, { kampfstufe: 4 });
    autocastOff(run.heroes[0]!);
    toBoss(run);
    const h = run.heroes[0]!;
    let hit: GameEvent | undefined;
    for (let i = 0; i < 400 && !hit; i++) {
      stepWorld(run.world);
      hit = run.world.events.find((e) => e.e === 'hit' && e.dst === h.id && e.src === run.world.boss!.id && e.el === 'physisch');
    }
    const m = heroMitigation(c.balance, heroStats(run.world, h).rue, 15);
    const expected = Math.round(0.11 * 815 * 0.25 * 1.2 * (1 - m));
    expect(hit && hit.e === 'hit' ? hit.dmg : -1).toBe(expected);
  });
});

describe('Phasen, Adds, Wutwechsel, Enrage (10.1, 10.4, 10.5)', () => {
  it('Phase 2 bei 66 %: Gegenelement, 5 s unverwundbar, Heilung 25 %, Adds sterben', () => {
    const run = bossRun(['magier'], 1);
    autocastOff(run.heroes[0]!);
    toBoss(run);
    const w = run.world;
    const boss = w.boss!;
    for (let i = 0; i < 20 * 16; i++) stepWorld(w); // erste Adds nach 15 s
    expect(w.units.filter((u) => u.kind === 'add' && !u.dead).length).toBe(4);
    const h = run.heroes[0]!;
    h.hp = Math.round(h.maxHp / 2);
    const before = h.hp;
    w.events = [];
    applyDamage(w, null, boss, boss.hp, {});
    expect(boss.dead).toBe(false);
    expect(boss.hp).toBe(Math.ceil(boss.maxHp * 0.66));
    expect(boss.element).toBe('eis');
    expect(boss.statuses.some((s) => s.id === 'unverwundbar')).toBe(true);
    expect(w.events.some((e) => e.e === 'phase' && e.phase === 2 && e.el === 'eis')).toBe(true);
    expect(h.hp - before).toBe(Math.round(h.maxHp * 0.25));
    stepWorld(w);
    expect(w.units.some((u) => u.kind === 'add')).toBe(false);
    applyDamage(w, null, boss, 1000, {});
    expect(boss.hp).toBe(Math.ceil(boss.maxHp * 0.66));
  });

  it('der Boss stirbt erst in Phase 3, danach Sieg', () => {
    const run = bossRun(['magier'], 1);
    toBoss(run);
    const w = run.world;
    const boss = w.boss!;
    applyDamage(w, null, boss, boss.hp, {});
    for (let i = 0; i < 120; i++) stepWorld(w);
    applyDamage(w, null, boss, boss.hp, {});
    expect(boss.foe!.hs['phase']).toBe(3);
    expect(boss.element).toBe('feuer');
    for (let i = 0; i < 120; i++) stepWorld(w);
    w.events = [];
    applyDamage(w, null, boss, boss.hp, {});
    expect(boss.dead).toBe(true);
    expect(w.events.some((e) => e.e === 'bossDefeated' && e.boss === 'ignarch')).toBe(true);
    expect(run.scenario.phase).toBe('won');
  });

  it('Adds: erste Welle nach 15 s, dann alle 30 s, 4 × C(n) Schwarmlinge', () => {
    const run = bossRun(['magier', 'kleriker'], 2, { allAutocast: false });
    for (const h of run.heroes) autocastOff(h);
    toBoss(run);
    const w = run.world;
    const t0 = w.t;
    const waves: number[] = [];
    let seen = new Set<number>();
    while (w.t - t0 < 50_000) {
      stepWorld(w);
      const adds = w.units.filter((u) => u.kind === 'add' && !seen.has(u.id));
      if (adds.length > 0) {
        waves.push(Math.round((w.t - t0) / 1000));
        expect(adds.length).toBe(6);
        expect(adds.every((a) => a.element === 'eis' && a.foe!.level === 10)).toBe(true);
        seen = new Set([...seen, ...adds.map((a) => a.id)]);
      }
    }
    expect(waves).toEqual([15, 45]);
  });

  it('Wutwechsel: alle 15 s greift der Boss 4 s lang einen zufälligen Helden an', () => {
    const run = bossRun(['magier', 'waldlaeufer', 'runenweber'], 3);
    toBoss(run);
    const w = run.world;
    const boss = w.boss!;
    const t0 = w.t;
    while (w.t - t0 < 15_100) stepWorld(w);
    expect(boss.foe!.hs['rageUntil']! - w.t).toBeGreaterThan(3500);
    expect(run.heroes.map((h) => h.id)).toContain(boss.foe!.hs['rageTarget']);
  });

  it('Enrage nach 480 s: +25 % Schaden, danach alle 30 s +10 Prozentpunkte', () => {
    const run = bossRun(['krieger'], 1);
    toBoss(run);
    const w = run.world;
    const boss = w.boss!;
    boss.foe!.hs['enrageAt'] = w.t;
    stepWorld(w);
    expect(boss.foe!.hs['enrage']).toBeCloseTo(0.25);
    boss.foe!.hs['enrageAt'] = w.t;
    stepWorld(w);
    expect(boss.foe!.hs['enrage']).toBeCloseTo(0.35);
    expect(c.balance.boss.enrage.seconds).toBe(480);
  });

  it('Wipe: zurück zum Bereit-Bildschirm, Boss mit vollem Leben und Phase 1', () => {
    const run = bossRun(['magier'], 1);
    toBoss(run);
    const w = run.world;
    applyDamage(w, null, w.boss!, w.boss!.hp, {});
    expect(w.boss!.foe!.hs['phase']).toBe(2);
    for (const h of run.heroes) killUnit(w, h, null);
    stepWorld(w);
    expect(run.scenario.phase === 'countdown' || run.scenario.phase === 'gate').toBe(true);
    expect(run.scenario.wipes).toBe(1);
    expect(run.heroes[0]!.dead).toBe(false);
    expect(run.heroes[0]!.hero!.potionCharges).toBe(4);
    toBoss(run);
    expect(w.boss!.hp).toBe(w.boss!.maxHp);
    expect(w.boss!.foe!.hs['phase']).toBe(1);
  });
});

describe('Kampfdauer (13.5)', () => {
  /** Dauer des Bosskampfs (ohne Countdown). */
  function duration(cls: ClassId, chapter: number, seeds: number[], strength?: number): { s: number; wipes: number } {
    let total = 0;
    let wipes = 0;
    for (const seed of seeds) {
      const run = bossRun([cls], chapter, { seed, ...(strength ? { strength } : {}) });
      const w = run.world;
      let start = 0;
      while (run.scenario.phase !== 'won' && w.t < 1_200_000) {
        stepWorld(w);
        for (const e of w.events) if (e.e === 'stage' && e.phase === 'boss') start = w.t;
      }
      total += w.t - start;
      wipes += run.scenario.wipes;
    }
    return { s: total / seeds.length / 1000, wipes };
  }

  /**
   * Modellwert aus 13.5, umgerechnet auf die echte Boss-Resistenz (Modell: 25 %), plus Adds (+8 %, 10.4)
   * und zwei Phasenübergänge à 5 s (10.5), die das Modell nicht enthält.
   */
  function normalized(model: number, chapter: number): number {
    const boss = c.bosses.find((b) => b.chapter === chapter)!;
    const passive = boss.passive.id === 'boss_schattenhuelle' ? 0.9 : 1;
    const factor = (1 - boss.resMit) * passive;
    return model * (0.75 / factor) * 1.08 + 10;
  }

  const MODEL: Partial<Record<ClassId, number[]>> = { magier: [144, 145, 144], waldlaeufer: [149, 150, 150], schurke: [156, 156, 156] };
  for (const [cls, row] of Object.entries(MODEL) as [ClassId, number[]][]) {
    it(`${cls} solo: Kapitel 1, 3 und 6 innerhalb ±10 % (normalisiert)`, () => {
      [1, 3, 6].forEach((ch, i) => {
        const d = duration(cls, ch, [1, 2, 3]);
        expect(d.wipes).toBe(0);
        expect(Math.abs(d.s / normalized(row[i]!, ch) - 1)).toBeLessThanOrEqual(0.1);
      });
    });
  }

  it('jede Klasse besiegt Ignarch solo bei Referenzstärke ohne Wipe (Auto-Ausweichen, E-023)', () => {
    for (const cls of ['krieger', 'kleriker', 'runenweber'] as ClassId[]) expect(duration(cls, 1, [1, 2]).wipes).toBe(0);
  });
});
