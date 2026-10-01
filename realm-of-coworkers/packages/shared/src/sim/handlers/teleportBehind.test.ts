import { describe, expect, it } from 'vitest';
import { autocastOff, cast, collect, muteAuto, trainingWorld } from '../../testing';

describe('Handler teleportBehind', () => {
  it('springt hinter das Ziel, Tarnung verfällt nach 2 s ohne Treffer', () => {
    const { w, heroes, dummies } = trainingWorld({ heroes: ['schurke'], dummies: [{ x: 70, y: 90 }] });
    const h = heroes[0]!;
    autocastOff(h);
    muteAuto(h);
    h.hero!.level = 3;
    cast(w, h, 'schurke_schattenschritt');
    expect(h.x).toBeGreaterThan(dummies[0]!.x);
    expect(h.y).toBe(90);
    expect(h.face).toBe(-1);
    collect(w, 2050);
    expect(h.statuses.some((s) => s.id === 'tarnung')).toBe(false);
  });
});
