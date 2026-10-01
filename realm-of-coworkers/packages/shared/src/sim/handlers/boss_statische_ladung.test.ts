import { describe, expect, it } from 'vitest';
import { boss, foeWorld, steps } from '../../testing-foes';
import { dmgDealtMult } from '../effstats';

describe('Handler boss_statische_ladung', () => {
  it('alle 30 s für 8 s Raserei (+25 % Schaden)', () => {
    const { w } = foeWorld({ heroes: [], chapter: 3 });
    const b = boss(w, 'voltrax');
    steps(w, 30_000);
    expect(dmgDealtMult(w, b)).toBeCloseTo(1.25);
    steps(w, 8_050);
    expect(dmgDealtMult(w, b)).toBe(1);
  });
});
