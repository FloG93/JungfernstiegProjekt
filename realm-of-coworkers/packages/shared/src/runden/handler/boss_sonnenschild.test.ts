import { describe, expect, it } from 'vitest';
import { boss_sonnenschild } from './boss_sonnenschild';
import { bossVon, testBossKampf } from '../testhilfe';

describe('boss_sonnenschild', () => {
  it('schildet zu Beginn jeder Phase neu', () => {
    const k = testBossKampf('solaris');
    const boss = bossVon(k);
    const erwartet = Math.round((boss.maxLp * 3) / 100);
    boss_sonnenschild.phase!({ k, boss, params: { pctMaxHp: 3, onPhaseStart: 1 }, phase: 1 });
    expect(boss.schilde.length).toBe(1);
    expect(boss.schilde[0]!.menge).toBe(erwartet);
    boss.schilde[0]!.menge = 1;
    boss_sonnenschild.phase!({ k, boss, params: { pctMaxHp: 3, onPhaseStart: 1 }, phase: 2 });
    expect(boss.schilde.length).toBe(1);
    expect(boss.schilde[0]!.menge).toBe(erwartet);
  });
});
