import { describe, expect, it } from 'vitest';
import { foeWorld, steps } from '../../testing-foes';
import { autocastOff, muteAuto, testContent } from '../../testing';
import { getHandler } from '../handlers';

describe('Handler hazard_schattenzone', () => {
  it('Anzeige 1,5 s, dann 4 % RefLeben (Resistenz), Form und Zusatzwirkung laut 9.8', () => {
    const c = testContent();
    const def = c.hazardById.get('hazard_schattenzone')!;
    const { w, heroes } = foeWorld({ chapter: def.chapter });
    const h = heroes[0]!;
    autocastOff(h);
    muteAuto(h);
    h.hero!.autoDodge = false;
    getHandler('hazard_schattenzone')!.hazard!(w, def, h.x, h.y);
    const z = w.zones.find((x) => x.label === 'hazard_schattenzone')!;
    expect(z.shape).toBe('circle');
    expect(z.w).toBe(100);
    expect(z.endsAt - w.t).toBe(1500);
    const hp = h.hp;
    steps(w, 1500);
    expect(h.hp).toBeLessThan(hp);
    expect(hp - h.hp).toBeLessThanOrEqual(Math.ceil(0.04 * c.balance.boss.refLife[def.chapter - 1]!));

    steps(w, 1050);
    expect(w.zones.some((z) => z.label === 'hazard_schattenzone_flaeche')).toBe(true);
    expect(h.statuses.some((s) => s.id === 'verderbnis')).toBe(true);
  });
});
