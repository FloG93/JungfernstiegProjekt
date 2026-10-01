import { describe, expect, it } from 'vitest';
import { foeWorld, steps } from '../../testing-foes';
import { autocastOff, muteAuto, testContent } from '../../testing';
import { getHandler } from '../handlers';

describe('Handler hazard_blitz', () => {
  it('Anzeige 1,5 s, dann 4 % RefLeben (Resistenz), Form und Zusatzwirkung laut 9.8', () => {
    const c = testContent();
    const def = c.hazardById.get('hazard_blitz')!;
    const { w, heroes } = foeWorld({ chapter: def.chapter });
    const h = heroes[0]!;
    autocastOff(h);
    muteAuto(h);
    h.hero!.autoDodge = false;
    getHandler('hazard_blitz')!.hazard!(w, def, h.x, h.y);
    const z = w.zones.find((x) => x.label === 'hazard_blitz')!;
    expect(z.shape).toBe('circle');
    expect(z.w).toBe(70);
    expect(z.endsAt - w.t).toBe(1500);
    const hp = h.hp;
    steps(w, 1500);
    expect(h.hp).toBeLessThan(hp);
    expect(hp - h.hp).toBeLessThanOrEqual(Math.ceil(0.04 * c.balance.boss.refLife[def.chapter - 1]!));
    expect(h.statuses.some((s) => s.id === 'schock')).toBe(true);

  });
});
