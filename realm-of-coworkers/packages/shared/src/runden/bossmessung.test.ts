// Messung R3: Ein Bosskampf soll 12 bis 18 Runden dauern (ENTWURF-rundenkampf.md Abschnitt 6).
// Die Werte gelten für die vorgesehene Party aus sechs Helden; kleinere Gruppen sind kürzer (OPEN-055).
import { describe, expect, it } from 'vitest';
import { rundeAusfuehren } from './kampf';
import { inhalt as c, testBossKampf } from './testhilfe';
import type { BossId } from '../content/ids';

function kampflaenge(bossId: BossId, n: number, seed: number, kampfstufe = 0): { runden: number; sieg: boolean } {
  const k = testBossKampf(bossId, n, seed, kampfstufe);
  let runden = 0;
  while (k.ergebnis === 'laeuft' && runden < c.runden.maxRunden) {
    rundeAusfuehren(k);
    runden++;
  }
  return { runden, sieg: k.ergebnis === 'sieg' };
}

describe('Länge eines Bosskampfes', () => {
  it('liegt für jeden Boss im Zielbereich von 12 bis 18 Runden', () => {
    for (const b of c.bosses) {
      for (const seed of [1, 2, 3]) {
        const { runden, sieg } = kampflaenge(b.id, 6, seed);
        expect(sieg, `${b.id} Seed ${seed}`).toBe(true);
        expect(runden, `${b.id} Seed ${seed}`).toBeGreaterThanOrEqual(12);
        expect(runden, `${b.id} Seed ${seed}`).toBeLessThanOrEqual(18);
      }
    }
  });

  it('die Kampfstufe verlängert den Kampf (10.1)', () => {
    const ohne = kampflaenge('glaciara', 6, 1);
    const mit = kampflaenge('glaciara', 6, 1, c.balance.boss.kampfstufeMax);
    expect(mit.runden).toBeGreaterThan(ohne.runden);
  });
});
