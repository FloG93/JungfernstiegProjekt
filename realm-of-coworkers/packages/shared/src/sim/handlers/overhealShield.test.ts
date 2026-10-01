import { describe, expect, it } from 'vitest';
import { cast, testContent, testHero, trainingWorld } from '../../testing';

describe('Handler overhealShield', () => {
  it('Gnadenperle (Artefakt) hebt die Grenze auf 15 %', () => {
    const c = testContent();
    const kl = testHero(c, 'kleriker', { level: 30, noCrit: true, artifacts: [{ slot: 'amulett', rank: 1 }] });
    const { w, heroes } = trainingWorld({ heroes: [kl, 'magier'] });
    const mg = heroes[1]!;
    mg.hp = mg.maxHp - 1;
    cast(w, heroes[0]!, 'kleriker_heilendes_licht', { targetId: mg.id });
    const sh = mg.shields.find((s) => s.tag === 'gnade')!;
    expect(sh.amount).toBeLessThanOrEqual(Math.round(mg.maxHp * 0.15));
    expect(sh.amount).toBeGreaterThan(Math.round(mg.maxHp * 0.1));
  });
});
