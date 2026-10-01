import { describe, expect, it } from 'vitest';
import { enemy, foeWorld, steps } from '../../testing-foes';
import { applyStatus } from '../status';

describe('Handler affix_regenerierend', () => {
  it('1 % Max-Leben pro Sekunde, nicht während Betäubung', () => {
    const { w } = foeWorld({ heroes: [] });
    const e = enemy(w, 'scherge', 0, { affix: 'affix_regenerierend' });
    e.hp = e.maxHp / 2;
    steps(w, 1000);
    expect(e.hp - e.maxHp / 2).toBeCloseTo(e.maxHp * 0.01);
    const hp = e.hp;
    applyStatus(w, null, e, 'betaeubung', { ms: 1000 });
    steps(w, 500);
    expect(e.hp).toBe(hp);
  });
});
