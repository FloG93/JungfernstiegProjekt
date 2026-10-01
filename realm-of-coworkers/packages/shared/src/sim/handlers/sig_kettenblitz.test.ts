import { describe, expect, it } from 'vitest';
import { boss, foeWorld, steps } from '../../testing-foes';
import { autocastOff, muteAuto, testContent } from '../../testing';
import { getHandler } from '../handlers';

describe('Handler sig_kettenblitz', () => {
  it('springt zwischen Helden im Radius 300 px, ferne Helden bleiben verschont, danach Schock', () => {
    const c = testContent();
    const { w, heroes } = foeWorld({ heroes: ['krieger', 'magier', 'kleriker'], chapter: 3 });
    const b = boss(w, 'voltrax', 1000);
    for (const h of heroes) {
      autocastOff(h);
      muteAuto(h);
      h.hero!.autoDodge = false;
      h.hero!.manualUntil = 1e9;
    }
    heroes[0]!.x = 0; heroes[1]!.x = 200; heroes[2]!.x = 900;
    for (const h of heroes) h.y = 120;
    const sig = c.bossById.voltrax.attacks.signature;
    let ev: typeof w.events = [];
    // Kettenblitz trifft einen zufälligen Helden zuerst; wiederholen, bis der Krieger der Startpunkt ist
    for (let i = 0; i < 20; i++) {
      getHandler('sig_kettenblitz')!.signature!(w, b, sig);
      const z = w.zones.find((x) => x.label === 'kettenblitz')!;
      if (z.followId === heroes[0]!.id) break;
      w.zones = [];
    }
    steps(w, 1500, () => ev.push(...w.events));
    const hits = ev.filter((e) => e.e === 'hit' && e.src === b.id).map((e) => (e.e === 'hit' ? e.dst : 0));
    expect(hits.length).toBe(5);
    expect(hits).not.toContain(heroes[2]!.id);
    expect(heroes[0]!.statuses.some((s) => s.id === 'schock')).toBe(true);
    expect(heroes[1]!.statuses.some((s) => s.id === 'schock')).toBe(true);
    ev = [];
  });
});
