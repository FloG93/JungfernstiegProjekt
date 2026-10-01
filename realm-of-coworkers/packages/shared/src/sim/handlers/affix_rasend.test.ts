import { describe, expect, it } from 'vitest';
import { enemy, foeWorld } from '../../testing-foes';
import { attackRate, moveMult } from '../effstats';

describe('Handler affix_rasend', () => {
  it('+30 % Angriffs- und Bewegungstempo unter 50 % Leben', () => {
    const { w } = foeWorld({ heroes: [] });
    const e = enemy(w, 'brecher', 0, { affix: 'affix_rasend', chapter: 3 });
    expect(attackRate(w, e)).toBe(1);
    e.hp = Math.round(e.maxHp * 0.49);
    expect(attackRate(w, e)).toBeCloseTo(1.3);
    expect(moveMult(w, e)).toBeCloseTo(1.3);
  });
});
