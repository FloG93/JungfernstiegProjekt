import { describe, expect, it } from 'vitest';
import { boss, foeWorld, steps } from '../../testing-foes';

describe('Handler boss_glutmantel', () => {
  it('Nahkämpfer im Umkreis 120 px erhalten alle 3 s Verbrennung, weiter entfernte nicht', () => {
    const { w, heroes } = foeWorld({ heroes: ['krieger', 'magier'], chapter: 1 });
    const b = boss(w, 'ignarch', 0);
    heroes[0]!.x = 80; heroes[0]!.y = 120; heroes[0]!.hero!.manualUntil = 1e9;
    heroes[1]!.x = -400; heroes[1]!.y = 120; heroes[1]!.hero!.manualUntil = 1e9;
    b.foe!.hs['glutAt'] = w.t + 50;
    steps(w, 50);
    expect(heroes[0]!.statuses.find((s) => s.id === 'verbrennung')?.scale).toBeCloseTo(0.4);
    expect(heroes[1]!.statuses.some((s) => s.id === 'verbrennung')).toBe(false);
  });
});
