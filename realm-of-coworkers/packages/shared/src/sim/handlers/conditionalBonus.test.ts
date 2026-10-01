import { describe, expect, it } from 'vitest';
import { autocastOff, cast, damageTo, muteAuto, trainingWorld } from '../../testing';
import { applyStatus } from '../status';

describe('Handler conditionalBonus', () => {
  it('×1,5 auch bei Schwächung (z. B. Blendung), nicht bei anderen Effekten', () => {
    const { w, heroes, dummies } = trainingWorld({ heroes: ['schurke'], dummies: [{ x: 50 }, { x: 60 }, { x: 70 }] });
    const h = heroes[0]!;
    autocastOff(h);
    muteAuto(h);
    applyStatus(w, null, dummies[0]!, 'blendung');
    applyStatus(w, null, dummies[1]!, 'wurzel');
    const dmg = (i: number) => {
      h.hero!.skills[1]!.cdLeft = 0;
      w.events = [];
      cast(w, h, 'schurke_meucheln', { targetId: dummies[i]!.id });
      return damageTo(w.events, dummies[i]!.id);
    };
    const [weak, rooted, plain] = [dmg(0), dmg(1), dmg(2)];
    expect(weak).toBe(Math.round(plain * 1.5));
    expect(rooted).toBe(plain);
  });
});
