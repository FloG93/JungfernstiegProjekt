import { describe, expect, it } from 'vitest';
import { boss, foeWorld } from '../../testing-foes';
import { applyDamage } from '../combat';

describe('Handler boss_sonnenschild', () => {
  it('Schild 3 % Boss-Leben zu Beginn jeder Phase', () => {
    const { w } = foeWorld({ heroes: [], chapter: 5 });
    const b = boss(w, 'solaris');
    expect(b.shields[0]!.amount).toBe(Math.round(b.maxHp * 0.03));
    applyDamage(w, null, b, b.maxHp, {});
    expect(b.foe!.hs['phase']).toBe(2);
    expect(b.shields.find((s) => s.tag === 'sonnenschild')!.amount).toBe(Math.round(b.maxHp * 0.03));
  });
});
