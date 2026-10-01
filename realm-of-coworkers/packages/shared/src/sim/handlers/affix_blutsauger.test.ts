import { describe, expect, it } from 'vitest';
import { enemy, foeWorld } from '../../testing-foes';
import { foeHit } from '../combat';

describe('Handler affix_blutsauger', () => {
  it('heilt sich um 30 % des verursachten Schadens', () => {
    const { w, heroes } = foeWorld();
    const e = enemy(w, 'scherge', 0, { affix: 'affix_blutsauger' });
    e.hp = 10;
    const d = foeHit(w, e, heroes[0]!, { amount: 100, physical: true, element: 'physisch', attackerLevel: 15 });
    expect(e.hp).toBe(10 + Math.round(d * 0.3));
  });
});
