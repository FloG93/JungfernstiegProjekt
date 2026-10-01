import { describe, expect, it } from 'vitest';
import { boss, foeWorld } from '../../testing-foes';
import { foeIncomingMult } from '../handlers';

describe('Handler boss_steinhaut', () => {
  it('physischer Schaden −25 %, Elementarschaden unverändert', () => {
    const { w } = foeWorld({ heroes: [], chapter: 4 });
    const b = boss(w, 'gorthul');
    expect(foeIncomingMult(w, b, true)).toBeCloseTo(0.75);
    expect(foeIncomingMult(w, b, false)).toBe(1);
  });
});
