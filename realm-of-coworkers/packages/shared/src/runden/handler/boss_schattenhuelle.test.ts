import { describe, expect, it } from 'vitest';
import { boss_schattenhuelle } from './boss_schattenhuelle';
import { bossVon, testBossKampf } from '../testhilfe';
import { schadenEinMult } from '../werte';

describe('boss_schattenhuelle', () => {
  it('mindert nur elementaren Schaden', () => {
    const k = testBossKampf('nyxhara');
    const boss = bossVon(k);
    boss_schattenhuelle.start!({ k, boss, params: { elemDamageMalusPct: 10 } });
    expect(schadenEinMult(k, boss, false)).toBeCloseTo(0.9, 5);
    expect(schadenEinMult(k, boss, true)).toBeCloseTo(1, 5);
  });
});
