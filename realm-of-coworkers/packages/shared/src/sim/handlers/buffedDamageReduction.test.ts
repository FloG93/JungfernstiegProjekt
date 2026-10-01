import { describe, expect, it } from 'vitest';
import { cast, trainingWorld } from '../../testing';
import { dmgTakenMult } from '../effstats';

describe('Handler buffedDamageReduction', () => {
  it('wirkt nur unter einem Buff des Runenwebers, nicht unter fremden Buffs', () => {
    const { w, heroes } = trainingWorld({ heroes: ['runenweber', 'krieger', 'magier'] });
    const [rw, kr, mg] = heroes;
    kr!.hero!.level = 5;
    cast(w, kr!, 'krieger_bollwerk');
    expect(dmgTakenMult(w, mg!)).toBe(1);
    cast(w, rw!, 'runenweber_rune_der_kraft');
    expect(dmgTakenMult(w, mg!)).toBeCloseTo(0.95);
  });
});
