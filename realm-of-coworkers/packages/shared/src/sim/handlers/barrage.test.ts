import { describe, expect, it } from 'vitest';
import { autocastOff, cast, collect, hitsTo, muteAuto, trainingWorld } from '../../testing';

describe('Handler barrage', () => {
  it('verteilt 5 Pfeile auf Gegner im Zielkreis, keinen außerhalb', () => {
    const { w, heroes, dummies } = trainingWorld({ heroes: ['waldlaeufer'], dummies: [{ x: 400 }, { x: 450 }, { x: 700 }] });
    const h = heroes[0]!;
    autocastOff(h);
    muteAuto(h);
    h.hero!.level = 3;
    cast(w, h, 'waldlaeufer_pfeilhagel', { targetId: dummies[0]!.id });
    const ev = collect(w, 1600);
    const total = hitsTo(ev, dummies[0]!.id).length + hitsTo(ev, dummies[1]!.id).length;
    expect(total).toBe(5);
    expect(hitsTo(ev, dummies[2]!.id)).toHaveLength(0);
  });
});
