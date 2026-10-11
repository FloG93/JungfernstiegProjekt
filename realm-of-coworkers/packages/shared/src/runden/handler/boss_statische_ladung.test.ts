import { describe, expect, it } from 'vitest';
import { boss_statische_ladung } from './boss_statische_ladung';
import { bossVon, inhalt as c, testBossKampf } from '../testhilfe';
import { rundenAusSekunden } from '../umrechnung';
import { schadenAusMult } from '../werte';

const params = { everyS: 30, ms: 8000, dmgDealtPct: 25 };

describe('boss_statische_ladung', () => {
  it('gerät nach der umgerechneten Zeit in Raserei und schlägt dann härter zu', () => {
    const k = testBossKampf('voltrax');
    const boss = bossVon(k);
    boss_statische_ladung.start!({ k, boss, params });
    const runden = rundenAusSekunden(c, params.everyS);
    const vorher = schadenAusMult(k, boss);
    for (let i = 0; i < runden - 1; i++) boss_statische_ladung.runde!({ k, boss, params });
    expect(boss.status.some((s) => s.id === 'raserei')).toBe(false);
    boss_statische_ladung.runde!({ k, boss, params });
    expect(boss.status.some((s) => s.id === 'raserei')).toBe(true);
    expect(schadenAusMult(k, boss)).toBeGreaterThan(vorher);
  });
});
