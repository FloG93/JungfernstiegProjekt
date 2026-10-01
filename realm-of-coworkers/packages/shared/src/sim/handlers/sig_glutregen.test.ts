import { describe, expect, it } from 'vitest';
import { boss, foeWorld } from '../../testing-foes';
import { testContent } from '../../testing';
import { getHandler } from '../handlers';

describe('Handler sig_glutregen', () => {
  it('8 Feuersäulen mit Radius 90 px und 1,5 s Anzeige', () => {
    const c = testContent();
    const { w } = foeWorld({ heroes: [], chapter: 1 });
    const b = boss(w, 'ignarch');
    getHandler('sig_glutregen')!.signature!(w, b, c.bossById.ignarch.attacks.signature);
    const z = w.zones.filter((x) => x.label === 'glutregen');
    expect(z).toHaveLength(8);
    expect(z.every((x) => x.w === 90 && x.endsAt - w.t === 1500)).toBe(true);
  });
});
