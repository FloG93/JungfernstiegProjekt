// Abnahme M6: Tempo 12.4, Gold 12.5, Ausrüstungskurve 12.9 innerhalb der Grenzen aus 13.9.
import { describe, expect, it } from 'vitest';
import { SLOT_IDS } from './content/ids';
import type { SlotId } from './content/ids';
import { chapterOfStage, itemBudget, xpToNext } from './formulas';
import { rollBossLoot, rollEliteItem, rollStageChest } from './loot';
import {
  applyWeaponXp, applyXp, bossReward, encounterReward, lateJoinerAllowed, unlockedStages, weaponXpShare,
} from './progression';
import { Rng } from './rng';
import { testContent } from './testing';

const c = testContent();

function stageRewards(stage: number): { xp: number; gold: number } {
  const def = c.stages[stage - 1]!;
  let xp = 0;
  let gold = 0;
  def.encounters.forEach((_, i) => {
    const r = encounterReward(c, def, i, 1, false);
    xp += r.xp;
    gold += r.gold;
  });
  if (def.boss) {
    const r = bossReward(c, stage, true, false);
    xp += r.xp;
    gold += r.gold;
  }
  return { xp, gold };
}

describe('Kampagnentempo (12.4) und Gold (12.5)', () => {
  it('kumulierte XP je Kapitel wie 12.4', () => {
    let cum = 0;
    const perChapter: number[] = [];
    for (let s = 1; s <= 30; s++) {
      cum += stageRewards(s).xp;
      if (s % 5 === 0) perChapter.push(Math.round(cum));
    }
    expect(perChapter).toEqual([3268, 15972, 41846, 83692, 143922, 224654]);
  });

  it('Heldenstufe zu Beginn der Stage s ist s (Abweichung höchstens 1), Stufe 30 nach Stage 29', () => {
    let level = 1;
    let xp = 0;
    for (let s = 1; s <= 30; s++) {
      expect(Math.abs(level - s)).toBeLessThanOrEqual(1);
      const r = applyXp(c, level, xp, stageRewards(s).xp);
      level = r.level;
      xp = r.xp;
      if (s === 29) expect(level).toBe(30);
    }
  });

  it('Gold der Kampagne zwischen 25.000 und 32.000 (rund 28.700)', () => {
    let gold = 0;
    for (let s = 1; s <= 30; s++) gold += stageRewards(s).gold;
    expect(gold).toBeGreaterThanOrEqual(25_000);
    expect(gold).toBeLessThanOrEqual(32_000);
    expect(Math.round(gold)).toBe(28674);
  });

  it('Wiederholung: 40 % XP, voller Gold-Topf; Boss-Wiederholung 0,5 XP und 1,0 Gold; Helfer nichts', () => {
    const def = c.stages[11]!;
    const first = encounterReward(c, def, 2, 1, false);
    const rep = encounterReward(c, def, 2, 1, true);
    expect(rep.xp / first.xp).toBeCloseTo(0.4);
    expect(rep.gold).toBeCloseTo(first.gold);
    const b = bossReward(c, 15, false, false);
    expect(b.xp).toBeCloseTo(0.5 * xpToNext(c.balance, 15));
    expect(bossReward(c, 15, false, true)).toEqual({ xp: 0, gold: 0 });
  });
});

describe('Stufen und Waffen-XP (12.1, 8.4)', () => {
  it('Stufenaufstieg über mehrere Stufen, Obergrenze 30', () => {
    const r = applyXp(c, 1, 0, 100 + 280 + 50);
    expect(r).toEqual({ level: 3, xp: 50, levelUps: [2, 3], gained: 430 });
    const top = applyXp(c, 29, 15_000, 10_000);
    expect(top.level).toBe(30);
    expect(top.gained).toBe(620);
    expect(applyXp(c, 30, 0, 999).gained).toBe(0);
  });

  it('Waffe erhält 50 % der Helden-XP, ab Stufe 30 100 %; Stufe 10 ist das Maximum', () => {
    expect(weaponXpShare(c, 29)).toBe(0.5);
    expect(weaponXpShare(c, 30)).toBe(1);
    expect(applyWeaponXp(c, 1, 0, 300 + 790 + 10)).toEqual({ level: 3, xp: 10 });
    expect(applyWeaponXp(c, 9, 6000, 10_000)).toEqual({ level: 10, xp: 0 });
  });
});

describe('Freischaltung (3.4) und Nachzügler-Regel (11.2)', () => {
  it('Stage 1 und jede Stage nach einem Abschluss; Lücken erlaubt', () => {
    expect([...unlockedStages([1, 2, 8], 30)].sort((a, b) => a - b)).toEqual([1, 2, 3, 9]);
  });

  it('Stufe mindestens empfohlene Stufe minus 3', () => {
    expect(lateJoinerAllowed(c, 9, c.stages[11]!)).toBe(true);
    expect(lateJoinerAllowed(c, 8, c.stages[11]!)).toBe(false);
  });
});

describe('Ausrüstungskurve (12.9)', () => {
  it('Mittelwert je Kapitelende innerhalb 0,7 bis 1,1 und nahe am Modell (3.000 Durchläufe)', () => {
    const model = [0.77, 0.89, 0.96, 1.01, 1.05, 1.07];
    const runs = 3000;
    const sums = [0, 0, 0, 0, 0, 0];
    const rng = new Rng(1);
    for (let r = 0; r < runs; r++) {
      const best = Object.fromEntries(SLOT_IDS.map((s) => [s, 0])) as Record<SlotId, number>;
      for (let s = 1; s <= 30; s++) {
        const def = c.stages[s - 1]!;
        if (!def.boss) {
          const chest = rollStageChest(c, rng, 'magier', s);
          const elites = def.encounters.reduce((a, e) => a + e.elites, 0);
          for (let i = 0; i < elites; i++) {
            const it = rollEliteItem(c, rng, 'magier', s);
            if (it) chest.items.push(it);
          }
          for (const it of chest.items) best[it.slot] = Math.max(best[it.slot], it.budget);
          continue;
        }
        const loot = rollBossLoot(c, rng, { classId: 'magier', bossId: def.boss, first: true, beutestufe: 0 });
        for (const it of loot.items) best[it.slot] = Math.max(best[it.slot], it.budget);
        const ch = chapterOfStage(s);
        const ref = SLOT_IDS.reduce((a, sl) => a + itemBudget(c.balance, sl, 5 * ch, 'selten'), 0);
        sums[ch - 1]! += SLOT_IDS.reduce((a, sl) => a + best[sl], 0) / ref;
      }
    }
    const mean = sums.map((x) => x / runs);
    mean.forEach((m, i) => {
      expect(m).toBeGreaterThanOrEqual(0.7);
      expect(m).toBeLessThanOrEqual(1.1);
      expect(Math.abs(m - model[i]!)).toBeLessThanOrEqual(0.03);
    });
  });
});
