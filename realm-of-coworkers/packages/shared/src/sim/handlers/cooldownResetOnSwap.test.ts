import { describe, expect, it } from 'vitest';
import { autocastOff, cast, collect, testContent, testHero, trainingWorld } from '../../testing';
import { doSwap } from '../actions';

describe('Handler cooldownResetOnSwap', () => {
  it('Flussband (Artefakt) verkürzt die Sperre auf 14 s', () => {
    const c = testContent();
    const setup = testHero(c, 'magier', { level: 30, elementB: 'feuer', artifacts: [{ slot: 'ring', rank: 1 }] });
    const { w, heroes } = trainingWorld({ heroes: [setup], dummies: [{ x: 300 }] });
    const h = heroes[0]!;
    autocastOff(h);
    cast(w, h, 'magier_elementarkugel');
    doSwap(w, h);
    expect(h.hero!.elementarflussReadyAt - w.t).toBe(14000);
    collect(w, 14000);
    cast(w, h, 'magier_elementarkugel');
    expect(doSwap(w, h)).toBe(true);
    expect(h.hero!.skills[1]!.cdLeft).toBe(0);
  });
});
