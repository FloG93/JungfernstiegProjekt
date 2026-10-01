import { describe, expect, it } from 'vitest';
import { boss, foeWorld, steps } from '../../testing-foes';
import { autocastOff, muteAuto, testContent } from '../../testing';
import { doRoll } from '../actions';
import { getHandler } from '../handlers';

describe('Handler sig_beben', () => {
  it('Kreis 300 px um den Boss, Betäubung 1,5 s; die Ausweichrolle verhindert sie', () => {
    const c = testContent();
    const { w, heroes } = foeWorld({ heroes: ['krieger', 'schurke'], chapter: 4 });
    const b = boss(w, 'gorthul', 0);
    for (const h of heroes) {
      autocastOff(h);
      muteAuto(h);
      h.hero!.autoDodge = false;
      h.hero!.manualUntil = 1e9;
      h.x = 100;
      h.y = 120;
    }
    getHandler('sig_beben')!.signature!(w, b, c.bossById.gorthul.attacks.signature);
    steps(w, 1300);
    doRoll(w, heroes[1]!, { x: 0, y: 1 });
    steps(w, 200);
    expect(heroes[0]!.statuses.some((s) => s.id === 'betaeubung')).toBe(true);
    expect(heroes[1]!.statuses.some((s) => s.id === 'betaeubung')).toBe(false);
    expect(heroes[1]!.hp).toBe(heroes[1]!.maxHp);
  });
});
