import { describe, expect, it } from 'vitest';
import { trainingWorld } from '../../testing';
import { doRoll } from '../actions';

describe('Handler rollCooldown', () => {
  it('Waldläufer rollt alle 7 s, andere Klassen alle 8 s', () => {
    const { w, heroes } = trainingWorld({ heroes: ['waldlaeufer', 'magier'] });
    doRoll(w, heroes[0]!, { x: 1, y: 0 });
    doRoll(w, heroes[1]!, { x: 1, y: 0 });
    expect(heroes[0]!.hero!.rollReadyAt - w.t).toBe(7000);
    expect(heroes[1]!.hero!.rollReadyAt - w.t).toBe(8000);
  });
});
