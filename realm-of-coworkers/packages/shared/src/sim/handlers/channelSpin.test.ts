import { describe, expect, it } from 'vitest';
import { autocastOff, cast, collect, muteAuto, trainingWorld } from '../../testing';
import { foeHit } from '../combat';

describe('Handler channelSpin', () => {
  it('macht während des Wirbels unverwundbar', () => {
    const { w, heroes, dummies } = trainingWorld({ heroes: ['schurke'], dummies: [{ x: 60 }] });
    const h = heroes[0]!;
    autocastOff(h);
    muteAuto(h);
    h.hero!.level = 5;
    cast(w, h, 'schurke_klingentanz');
    collect(w, 500);
    expect(foeHit(w, dummies[0]!, h, { amount: 100, physical: true, element: 'physisch', attackerLevel: 1 })).toBe(0);
    collect(w, 1100);
    expect(foeHit(w, dummies[0]!, h, { amount: 100, physical: true, element: 'physisch', attackerLevel: 1 })).toBeGreaterThan(0);
  });
});
