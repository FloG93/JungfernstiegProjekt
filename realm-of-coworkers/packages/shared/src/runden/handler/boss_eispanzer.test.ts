import { describe, expect, it } from 'vitest';
import { boss_eispanzer } from './boss_eispanzer';
import { bossVon, inhalt as c, testBossKampf } from '../testhilfe';
import { rundenAusSekunden } from '../umrechnung';

const params = { pctMaxHp: 2, renewS: 45 };

describe('boss_eispanzer', () => {
  it('schildet zu Beginn in Höhe des Anteils am Boss-Leben', () => {
    const k = testBossKampf('glaciara');
    const boss = bossVon(k);
    boss.schilde = [];
    boss_eispanzer.start!({ k, boss, params });
    expect(boss.schilde[0]!.menge).toBe(Math.round((boss.maxLp * params.pctMaxHp) / 100));
    expect(boss.boss!.passivRest).toBe(rundenAusSekunden(c, params.renewS));
  });

  it('erneuert den Schild erst nach der umgerechneten Zahl von Runden', () => {
    const k = testBossKampf('glaciara');
    const boss = bossVon(k);
    boss_eispanzer.start!({ k, boss, params });
    const runden = rundenAusSekunden(c, params.renewS);
    boss.schilde = [];
    for (let i = 0; i < runden - 1; i++) boss_eispanzer.runde!({ k, boss, params });
    expect(boss.schilde.length).toBe(0);
    boss_eispanzer.runde!({ k, boss, params });
    expect(boss.schilde.length).toBe(1);
  });
});
