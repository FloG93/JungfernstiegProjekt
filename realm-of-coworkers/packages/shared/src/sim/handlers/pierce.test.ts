import { describe, expect, it } from 'vitest';
import { autocastOff, cast, damageTo, muteAuto, trainingWorld } from '../../testing';

describe('Handler pierce', () => {
  it('trifft nur den ersten Gegner in der Linie dahinter, nicht seitlich oder davor', () => {
    const { w, heroes, dummies } = trainingWorld({
      heroes: ['waldlaeufer'],
      dummies: [{ x: 200, y: 120 }, { x: 260, y: 120 }, { x: 330, y: 120 }, { x: 100, y: 120 }, { x: 260, y: 230 }],
    });
    autocastOff(heroes[0]!);
    muteAuto(heroes[0]!);
    cast(w, heroes[0]!, 'waldlaeufer_gezielter_schuss', { targetId: dummies[0]!.id });
    const d = dummies.map((x) => damageTo(w.events, x.id));
    expect(d[0]).toBeGreaterThan(0);
    expect(d[1]).toBe(Math.round(d[0]! / 2));
    expect(d.slice(2)).toEqual([0, 0, 0]);
  });
});
