import { describe, expect, it } from 'vitest';
import { boss, foeWorld, steps } from '../../testing-foes';
import { autocastOff, muteAuto, testContent } from '../../testing';
import { getHandler } from '../handlers';

describe('Handler sig_stille', () => {
  it('nach 3 s Furcht 2 s für Helden außerhalb der Lichtkreise, innen sicher', () => {
    const c = testContent();
    const { w, heroes } = foeWorld({ heroes: ['krieger', 'magier'], chapter: 6 });
    const b = boss(w, 'nyxhara', 2000);
    for (const h of heroes) {
      autocastOff(h);
      muteAuto(h);
      h.hero!.autoDodge = false;
      h.hero!.manualUntil = 1e9;
    }
    getHandler('sig_stille')!.signature!(w, b, c.bossById.nyxhara.attacks.signature);
    const circle = w.zones.find((z) => z.label === 'lichtkreis')!;
    heroes[0]!.x = circle.x; heroes[0]!.y = circle.y;
    heroes[1]!.x = circle.x + 2000; heroes[1]!.y = 120;
    steps(w, 3000);
    expect(heroes[0]!.statuses.some((s) => s.id === 'furcht')).toBe(false);
    expect(heroes[1]!.statuses.find((s) => s.id === 'furcht')?.endsAt).toBe(w.t + 2000);
  });
});
