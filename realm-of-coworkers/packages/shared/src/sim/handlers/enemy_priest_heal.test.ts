import { describe, expect, it } from 'vitest';
import { enemy, foeWorld, steps } from '../../testing-foes';
import { applyStatus } from '../status';

describe('Handler enemy_priest_heal', () => {
  it('heilt nach 3 s + 1 s Zauberzeit den verwundetsten Verbündeten um 5 %, Betäubung unterbricht', () => {
    const { w, heroes } = foeWorld({ heroes: [] });
    void heroes;
    const p = enemy(w, 'priester', 0);
    const ally = enemy(w, 'brecher', 100);
    ally.hp = Math.round(ally.maxHp / 2);
    const before = ally.hp;
    steps(w, 3950);
    expect(ally.hp).toBe(before);
    steps(w, 1050);
    expect(ally.hp - before).toBe(Math.round(ally.maxHp * 0.05));
    const after = ally.hp;
    // nächster Zauber beginnt 3 s nach der Heilung (bei 7 s) und wird bei 7,5 s unterbrochen
    steps(w, 2500);
    applyStatus(w, null, p, 'betaeubung', { ms: 1500 });
    steps(w, 1100);
    expect(ally.hp).toBe(after);
  });
});
