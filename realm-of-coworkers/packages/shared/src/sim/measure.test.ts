// Abnahme M2: gemessenes K je Klasse höchstens 10 % neben 13.2; gleicher Seed, gleiche Ereignisse.
import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '../content/ids';
import { cast, testContent, trainingWorld } from '../testing';
import { measureK } from './measure';
import { stepWorld } from './world';

const c = testContent();
const K_MODEL = { krieger: 1.11, magier: 1.64, waldlaeufer: 1.63, schurke: 1.62, kleriker: 0.65, runenweber: 0.78 };

describe('Gemessenes K (13.2, 13.10)', () => {
  for (const cls of CLASS_IDS) {
    it(`${cls}: höchstens 10 % Abweichung von ${K_MODEL[cls]}`, () => {
      const m = measureK(c, cls, 600);
      expect(Math.abs(m.k / K_MODEL[cls] - 1)).toBeLessThanOrEqual(0.1);
    });
  }
});

describe('Determinismus (2.3)', () => {
  function run(seed: number) {
    const r = trainingWorld({
      seed, heroes: ['krieger', 'magier', 'waldlaeufer', 'schurke', 'kleriker', 'runenweber'], castAll: true, noCrit: false,
      dummies: [{ x: 150 }, { x: 250, elite: true }, { x: 300, kind: 'boss' }],
    });
    const log: string[] = [];
    for (let i = 0; i < 2000; i++) {
      stepWorld(r.w);
      for (const e of r.w.events) log.push(JSON.stringify(e));
    }
    return log;
  }

  it('gleicher Seed liefert gleiche Ereignisse', () => {
    const a = run(7);
    const b = run(7);
    expect(a.length).toBeGreaterThan(1000);
    expect(a).toEqual(b);
  });

  it('anderer Seed liefert andere Ereignisse (Krits, Pfeilhagel)', () => {
    expect(run(7)).not.toEqual(run(8));
  });

  it('manuelle Eingaben werden verworfen, wenn sie ungültig sind', () => {
    const r = trainingWorld({ heroes: ['magier'] });
    expect(cast(r.w, r.heroes[0]!, 'krieger_spott')).toBe(false);
    expect(cast(r.w, r.heroes[0]!, 'magier_elementarkugel')).toBe(false); // kein Ziel in Reichweite
  });
});
