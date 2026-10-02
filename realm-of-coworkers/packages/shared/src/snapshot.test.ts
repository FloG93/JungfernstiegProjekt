// Snapshots (11.7, 15.4): Delta je Empfänger, vollständig auf Wunsch, entfernte Einheiten, eigene Abklingzeiten.
import { describe, expect, it } from 'vitest';
import { SnapshotTracker } from './snapshot';
import { createRun, stepWorld } from './sim';
import { testContent, testHero } from './testing';

const extra = { helper: false, ready: [], autoReadyIn: null };

function setup() {
  const c = testContent();
  const run = createRun(c, { stage: 1, seed: 7, heroes: [testHero(c, 'krieger', { dbId: 1, level: 1 }), testHero(c, 'magier', { dbId: 2, level: 1 })] });
  return { c, run };
}

describe('SnapshotTracker', () => {
  it('erster Snapshot vollständig mit Meta, danach nur Änderungen', () => {
    const { run } = setup();
    const [h1] = run.heroes;
    const tr = new SnapshotTracker();
    const s1 = tr.build(run.world, run.scenario, h1!.id, true, extra);
    expect(s1.full).toBe(true);
    expect(s1.ents.length).toBe(2);
    expect(s1.ents[0]!.meta?.name).toBeDefined();
    // Abklingzeiten nur für den eigenen Helden
    expect(s1.ents.find((e) => e.id === h1!.id)!.cd).toBeDefined();
    expect(s1.ents.find((e) => e.id !== h1!.id)!.cd).toBeUndefined();
    expect(s1.run.me?.unitId).toBe(h1!.id);
    const s2 = tr.build(run.world, run.scenario, h1!.id, false, extra);
    expect(s2.ents).toEqual([]);
    h1!.x += 30;
    const s3 = tr.build(run.world, run.scenario, h1!.id, false, extra);
    expect(s3.ents.map((e) => e.id)).toEqual([h1!.id]);
    expect(s3.ents[0]!.meta).toBeUndefined();
  });

  it('entfernte Einheiten stehen in rm; regelmäßige vollständige Snapshots ohne Meta', () => {
    const { run } = setup();
    const [h1, h2] = run.heroes;
    const tr = new SnapshotTracker();
    tr.build(run.world, run.scenario, h1!.id, true, extra);
    run.world.units = run.world.units.filter((u) => u.id !== h2!.id);
    const s = tr.build(run.world, run.scenario, h1!.id, false, extra);
    expect(s.rm).toEqual([h2!.id]);
    const f = tr.build(run.world, run.scenario, h1!.id, true, extra, false);
    expect(f.ents.length).toBe(1);
    expect(f.ents[0]!.meta).toBeUndefined();
  });

  it('Positionen ganzzahlig, Flächen mit Restzeit, Laufzustand der Stage', () => {
    const { run } = setup();
    for (let i = 0; i < 400; i++) stepWorld(run.world);
    const tr = new SnapshotTracker();
    const s = tr.build(run.world, run.scenario, run.heroes[0]!.id, true, extra);
    for (const e of s.ents) {
      expect(Number.isInteger(e.x)).toBe(true);
      expect(Number.isInteger(e.y)).toBe(true);
    }
    expect(s.run.anchorX).toBeGreaterThan(0);
    expect(s.run.encounters).toBe(6);
    expect(s.tick).toBe(400);
    for (const z of s.zones) expect(z.endsIn).toBeGreaterThanOrEqual(0);
  });
});
