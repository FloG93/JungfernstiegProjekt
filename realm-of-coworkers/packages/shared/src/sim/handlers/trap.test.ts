import { describe, expect, it } from 'vitest';
import { autocastOff, cast, collect, muteAuto, trainingWorld } from '../../testing';

describe('Handler trap', () => {
  it('hält höchstens 2 Fallen und läuft nach 15 s ab', () => {
    const { w, heroes, dummies } = trainingWorld({ heroes: ['waldlaeufer'], dummies: [{ x: 400, y: 20 }] });
    const h = heroes[0]!;
    autocastOff(h);
    muteAuto(h);
    h.hero!.level = 2;
    const trapSkill = h.hero!.skills[2]!;
    for (const x of [200, 250, 300]) {
      trapSkill.cdLeft = 0;
      cast(w, h, 'waldlaeufer_fallensteller', { x, y: 200 });
    }
    expect(w.zones.filter((z) => z.kind === 'trap')).toHaveLength(2);
    expect(w.zones.filter((z) => z.kind === 'trap').map((z) => z.x)).toEqual([250, 300]);
    collect(w, 15050);
    expect(w.zones.filter((z) => z.kind === 'trap')).toHaveLength(0);
    expect(dummies[0]!.hp).toBe(dummies[0]!.maxHp);
  });
});
