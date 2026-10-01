import { describe, expect, it } from 'vitest';
import { enemy, foeWorld, steps } from '../../testing-foes';
import { applyDamage } from '../combat';

describe('Handler enemy_guardian_shield', () => {
  it('Schild mit 10 % Leben, kehrt erst nach 8 s ohne Schaden zurück', () => {
    const { w } = foeWorld({ heroes: [], chapter: 5 });
    const g = enemy(w, 'waechter', 0, { chapter: 5, level: 21 });
    expect(g.shields[0]!.amount).toBe(Math.round(g.maxHp * 0.1));
    applyDamage(w, null, g, g.maxHp * 0.15, {});
    expect(g.shields).toHaveLength(0);
    steps(w, 7900);
    expect(g.shields).toHaveLength(0);
    steps(w, 200);
    expect(g.shields[0]!.amount).toBe(Math.round(g.maxHp * 0.1));
  });
});
