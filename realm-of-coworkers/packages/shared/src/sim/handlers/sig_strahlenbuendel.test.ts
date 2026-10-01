import { describe, expect, it } from 'vitest';
import { boss, foeWorld } from '../../testing-foes';
import { testContent } from '../../testing';
import { getHandler } from '../handlers';

describe('Handler sig_strahlenbuendel', () => {
  it('3 Lichtlinien mit 50 px Breite, im Winkel von 120° zueinander, vom Boss aus', () => {
    const c = testContent();
    const { w } = foeWorld({ heroes: [], chapter: 5 });
    const b = boss(w, 'solaris');
    getHandler('sig_strahlenbuendel')!.signature!(w, b, c.bossById.solaris.attacks.signature);
    const z = w.zones.filter((x) => x.label === 'strahlenbuendel');
    expect(z).toHaveLength(3);
    expect(z.every((x) => x.shape === 'line' && x.h === 50)).toBe(true);
    const diff = (((z[1]!.ang! - z[0]!.ang!) * 180) / Math.PI + 360) % 360;
    expect(diff).toBeCloseTo(120);
  });
});
