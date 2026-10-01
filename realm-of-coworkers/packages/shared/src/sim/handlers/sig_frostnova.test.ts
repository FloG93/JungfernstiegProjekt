import { describe, expect, it } from 'vitest';
import { boss, foeWorld, steps } from '../../testing-foes';
import { autocastOff, muteAuto, testContent } from '../../testing';
import { getHandler } from '../handlers';

describe('Handler sig_frostnova', () => {
  it('Kreis 260 px um den Boss: Schaden und Frost 2 Stapel, Fernkämpfer außerhalb sicher', () => {
    const c = testContent();
    const { w, heroes } = foeWorld({ heroes: ['krieger', 'magier'], chapter: 2 });
    const b = boss(w, 'glaciara', 0);
    for (const h of heroes) {
      autocastOff(h);
      muteAuto(h);
      h.hero!.autoDodge = false;
      h.hero!.manualUntil = 1e9;
    }
    heroes[0]!.x = 100; heroes[0]!.y = 120;
    heroes[1]!.x = -400; heroes[1]!.y = 120;
    getHandler('sig_frostnova')!.signature!(w, b, c.bossById.glaciara.attacks.signature);
    steps(w, 1500);
    expect(heroes[0]!.statuses.find((s) => s.id === 'frost')?.stacks).toBe(2);
    expect(heroes[1]!.hp).toBe(heroes[1]!.maxHp);
  });
});
