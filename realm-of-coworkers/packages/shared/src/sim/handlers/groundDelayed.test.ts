import { describe, expect, it } from 'vitest';
import { autocastOff, cast, collect, damageTo, muteAuto, trainingWorld } from '../../testing';
import { testContent, testHero } from '../../testing';

describe('Handler groundDelayed', () => {
  it('Kometenkern (Artefakt) verkürzt die Markierung auf 0,7 s', () => {
    const c = testContent();
    const setup = testHero(c, 'magier', { level: 30, noCrit: true, artifacts: [{ slot: 'relikt', rank: 1 }] });
    const { w, heroes, dummies } = trainingWorld({ heroes: [setup], dummies: [{ x: 300 }] });
    autocastOff(heroes[0]!);
    muteAuto(heroes[0]!);
    cast(w, heroes[0]!, 'magier_kataklysmus');
    expect(damageTo(collect(w, 650), dummies[0]!.id)).toBe(0);
    expect(damageTo(collect(w, 100), dummies[0]!.id)).toBeGreaterThan(0);
  });
});
