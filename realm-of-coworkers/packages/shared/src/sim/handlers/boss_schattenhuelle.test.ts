import { describe, expect, it } from 'vitest';
import { boss, foeWorld } from '../../testing-foes';
import { foeIncomingMult } from '../handlers';

describe('Handler boss_schattenhuelle', () => {
  it('Elementarschaden −10 %, physischer Schaden unverändert', () => {
    const { w } = foeWorld({ heroes: [], chapter: 6 });
    const b = boss(w, 'nyxhara');
    expect(foeIncomingMult(w, b, false)).toBeCloseTo(0.9);
    expect(foeIncomingMult(w, b, true)).toBe(1);
  });
});
