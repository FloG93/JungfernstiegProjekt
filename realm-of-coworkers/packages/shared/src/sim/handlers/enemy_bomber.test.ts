import { describe, expect, it } from 'vitest';
import { enemy, foeWorld, steps } from '../../testing-foes';
import { autocastOff, muteAuto } from '../../testing';
import { killUnit } from '../combat';

describe('Handler enemy_bomber', () => {
  it('explodiert nach 1 s Anzeige (8 % RefLeben im Radius 100) und verschwindet, auch bei Tod', () => {
    const { w, heroes } = foeWorld();
    const h = heroes[0]!;
    autocastOff(h);
    muteAuto(h);
    h.hero!.autoDodge = false;
    const b = enemy(w, 'bomber', h.x + 30, { y: h.y });
    steps(w, 100);
    expect(w.zones.some((z) => z.label === 'bomber')).toBe(true);
    const hp = h.hp;
    steps(w, 1000);
    expect(h.hp).toBeLessThan(hp);
    expect(b.dead || !w.units.includes(b)).toBe(true);
    const b2 = enemy(w, 'bomber', h.x + 400, { y: h.y });
    killUnit(w, b2, null);
    expect(w.zones.some((z) => z.label === 'bomber')).toBe(true);
  });
});
