import { describe, expect, it } from 'vitest';
import { enemy, foeWorld, steps } from '../../testing-foes';

describe('Handler elite_slam', () => {
  it('Bodenschlag alle 12 s, Kreis 120 px, 1,5 s Anzeige', () => {
    const { w } = foeWorld({ heroes: [] });
    enemy(w, 'scherge', 0, { affix: 'affix_regenerierend' });
    const seen: number[] = [];
    steps(w, 25_000, () => {
      for (const e of w.events) if (e.e === 'telegraph') {
        const z = w.zones.find((x) => x.id === e.zone);
        if (z?.label === 'bodenschlag') {
          seen.push(w.t);
          expect(z.w).toBe(120);
          expect(e.ms).toBe(1500);
        }
      }
    });
    expect(seen).toEqual([12_000, 24_000]);
  });
});
