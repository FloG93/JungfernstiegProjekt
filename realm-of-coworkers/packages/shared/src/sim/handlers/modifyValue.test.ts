import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '../../content/ids';
import { testContent } from '../../testing';
import { buildHeroDefs } from '../heroes';

const c = testContent();

describe('Handler modifyValue (7.7)', () => {
  it('wendet alle 18 Artefakt-Effekte an, nur für die eigene Klasse', () => {
    const all = (['amulett', 'ring', 'relikt'] as const).map((slot) => ({ slot, rank: 1 }));
    for (const cls of CLASS_IDS) expect(() => buildHeroDefs(c, cls, all)).not.toThrow();
    const kr = buildHeroDefs(c, 'krieger', all);
    expect(kr.balance.potionPct).toBe(45);
    expect(kr.defs.get('krieger_spott')!.cooldownS).toBe(8);
    expect(kr.defs.get('krieger_bollwerk')!.effects[0]).toMatchObject({ ms: 7000 });
    const wl = buildHeroDefs(c, 'waldlaeufer', all);
    expect(wl.balance.rollPx).toBe(200);
    const trap = wl.defs.get('waldlaeufer_fallensteller')!.effects[0]!;
    expect(trap.k === 'handler' && trap.params['lifetimeMs']).toBe(20000);
    const rw = buildHeroDefs(c, 'runenweber', all);
    expect(rw.buffDurationAddMs).toBe(1000);
    expect(rw.defs.get('runenweber_rune_der_kraft')!.cooldownS).toBe(14);
    expect(c.skillById.get('krieger_spott')!.cooldownS).toBe(10);
  });

  it('ohne Rang wirkt kein Artefakt', () => {
    const kr = buildHeroDefs(c, 'krieger', [{ slot: 'amulett', rank: 0 }]);
    expect(kr.balance.potionPct).toBe(35);
  });
});
