import { describe, expect, it } from 'vitest';
import { cast, trainingWorld } from '../../testing';
import { killUnit } from '../combat';

describe('Handler revive', () => {
  it('belebt nur gefallene Helden der eigenen Seite', () => {
    const { w, heroes, dummies } = trainingWorld({ heroes: ['kleriker', 'krieger'], dummies: [{ x: 900 }] });
    heroes[0]!.hero!.level = 5;
    killUnit(w, heroes[1]!, null);
    cast(w, heroes[0]!, 'kleriker_wunder');
    expect(heroes[1]!.dead).toBe(false);
    expect(dummies[0]!.dead).toBe(false);
  });
});
