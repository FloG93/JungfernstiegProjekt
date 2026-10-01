import { describe, expect, it } from 'vitest';
import { foeWorld, steps } from '../../testing-foes';
import { autocastOff, muteAuto, testContent } from '../../testing';
import { getHandler } from '../handlers';

describe('Handler hazard_lichtstrahl', () => {
  it('Anzeige 1,5 s, dann 4 % RefLeben (Resistenz), Form und Zusatzwirkung laut 9.8', () => {
    const c = testContent();
    const def = c.hazardById.get('hazard_lichtstrahl')!;
    const { w, heroes } = foeWorld({ chapter: def.chapter });
    const h = heroes[0]!;
    autocastOff(h);
    muteAuto(h);
    h.hero!.autoDodge = false;
    getHandler('hazard_lichtstrahl')!.hazard!(w, def, h.x, h.y);
    const z = w.zones.find((x) => x.label === 'hazard_lichtstrahl')!;
    expect(z.shape).toBe('line');
    expect(z.w).toBe(240);
    expect(z.endsAt - w.t).toBe(1500);
    const hp = h.hp;
    steps(w, 1500);
    expect(h.hp).toBeLessThan(hp);
    expect(hp - h.hp).toBeLessThanOrEqual(Math.ceil(0.04 * c.balance.boss.refLife[def.chapter - 1]!));
    expect(h.statuses.some((s) => s.id === 'blendung')).toBe(true);

  });
});
