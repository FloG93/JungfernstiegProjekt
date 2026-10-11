import { describe, expect, it } from 'vitest';
import { boss_steinhaut } from './boss_steinhaut';
import { bossVon, testBossKampf } from '../testhilfe';
import { schadenEinMult } from '../werte';

describe('boss_steinhaut', () => {
  it('mindert nur physischen Schaden', () => {
    const k = testBossKampf('gorthul');
    const boss = bossVon(k);
    boss_steinhaut.start!({ k, boss, params: { physDamageMalusPct: 25 } });
    expect(schadenEinMult(k, boss, true)).toBeCloseTo(0.75, 5);
    expect(schadenEinMult(k, boss, false)).toBeCloseTo(1, 5);
  });
});
