import { describe, expect, it } from 'vitest';
import { enemy, foeWorld, steps } from '../../testing-foes';
import { applyDamage } from '../combat';

describe('Handler affix_schild', () => {
  it('Schild 20 % des Lebens, nach 15 s erneuert', () => {
    const { w } = foeWorld({ heroes: [] });
    const e = enemy(w, 'scherge', 0, { affix: 'affix_schild' });
    expect(e.shields[0]!.amount).toBe(Math.round(e.maxHp * 0.2));
    applyDamage(w, null, e, e.maxHp * 0.3, {});
    expect(e.shields).toHaveLength(0);
    steps(w, 15_000);
    expect(e.shields[0]!.amount).toBe(Math.round(e.maxHp * 0.2));
  });
});
