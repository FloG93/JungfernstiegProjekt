import { describe, expect, it } from 'vitest';
import { autocastOff, cast, muteAuto, trainingWorld } from '../../testing';
import { addThreat } from '../combat';

describe('Handler taunt', () => {
  it('setzt beim Boss die Bedrohung auf das Maximum plus 10 % und hält ihn 4 s', () => {
    const { w, heroes, dummies } = trainingWorld({ heroes: ['krieger', 'magier'], dummies: [{ x: 100, kind: 'boss' }] });
    const [kr, mg] = heroes;
    autocastOff(kr!);
    muteAuto(kr!);
    addThreat(dummies[0]!, mg!.id, 1000);
    cast(w, kr!, 'krieger_spott');
    expect(dummies[0]!.foe!.threat.get(kr!.id)).toBeGreaterThanOrEqual(1100);
    expect(dummies[0]!.foe!.tauntById).toBe(kr!.id);
    expect(dummies[0]!.statuses.some((s) => s.id === 'verspottet')).toBe(true);
  });
});
