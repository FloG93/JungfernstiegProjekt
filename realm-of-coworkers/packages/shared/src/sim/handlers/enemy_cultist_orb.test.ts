import { describe, expect, it } from 'vitest';
import { enemy, foeWorld, steps } from '../../testing-foes';
import { autocastOff, muteAuto } from '../../testing';

describe('Handler enemy_cultist_orb', () => {
  it('feuert Kugeln mit 0,6 s Anzeige auf ein Ziel in Reichweite', () => {
    const { w, heroes } = foeWorld();
    const h = heroes[0]!;
    autocastOff(h);
    muteAuto(h);
    h.hero!.autoDodge = false;
    h.hero!.manualUntil = 1e9;
    enemy(w, 'kultist', h.x + 300, { y: h.y });
    let zoneLife = 0;
    let hits = 0;
    steps(w, 4000, () => {
      if (w.zones.some((z) => z.label === 'kultist_kugel')) zoneLife += w.tickMs;
      hits += w.events.filter((e) => e.e === 'hit' && e.dst === h.id).length;
    });
    expect(hits).toBeGreaterThan(0);
    expect(zoneLife % 600).toBe(0);
  });
});
