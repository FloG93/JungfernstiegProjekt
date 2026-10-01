import { describe, expect, it } from 'vitest';
import { boss, foeWorld, steps } from '../../testing-foes';
import { applyDamage } from '../combat';

describe('Handler boss_eispanzer', () => {
  it('Schild 2 % Boss-Leben, erneuert sich alle 45 s', () => {
    const { w } = foeWorld({ heroes: [], chapter: 2 });
    const b = boss(w, 'glaciara');
    expect(b.shields[0]!.amount).toBe(Math.round(b.maxHp * 0.02));
    applyDamage(w, null, b, b.maxHp * 0.03, {});
    expect(b.shields).toHaveLength(0);
    steps(w, 45_000);
    expect(b.shields[0]!.amount).toBe(Math.round(b.maxHp * 0.02));
  });
});
