import { describe, expect, it } from 'vitest';
import {
  bossDamageFactor, bossLife, countFactor, enemyDps, enemyLife, enemyLifeFactor, gemCombineCost, gemSwapCost,
  goldPot, heroMitigation, itemBudget, itemRequirement, lifeFactor, sellPrice, stageLabel, totalXpForLevel,
  weaponXpToNext, xpToNext, enchantRankCost,
} from './formulas';
import { testContent } from './testing';

const c = testContent();
const b = c.balance;

describe('Formeln Abschnitt 5', () => {
  it('Punktebudget: Waffe, iLvl 30, Episch = 219,0 Punkte (5.3)', () => {
    expect(itemBudget(b, 'waffe', 30, 'episch').toFixed(1)).toBe('219.0');
  });

  it('Mitigation: Krieger mit 246 Rüstung gegen Stufe 30 = 38 % (5.6)', () => {
    expect(Math.round(heroMitigation(b, 246, 30) * 100)).toBe(38);
  });

  it('Verkaufspreis und Anforderung (8.2, 8.9)', () => {
    expect(sellPrice(b, itemBudget(b, 'waffe', 30, 'episch'))).toBe(55);
    expect(itemRequirement(b, 34)).toBe(30);
    expect(itemRequirement(b, 3)).toBe(1);
  });
});

describe('Gegner und Gruppen (9.4, 9.6, 10.3)', () => {
  it('Werte nach Stage', () => {
    expect([1, 5, 10, 15, 20, 25, 30].map((lv) => enemyLife(b, lv))).toEqual([98, 250, 440, 630, 820, 1010, 1200]);
    expect([1, 5, 10, 30].map((lv) => Math.round(enemyDps(b, lv) * 10) / 10)).toEqual([1.4, 2.8, 4.5, 11.5]);
  });

  it('Faktoren F, C, H und M', () => {
    const n = [1, 2, 3, 4, 5, 6];
    expect(n.map((x) => lifeFactor(b, x))).toEqual([1, 1.75, 2.5, 3.25, 4, 4.75]);
    expect(n.map((x) => countFactor(b, x))).toEqual([1, 1.5, 2, 2.5, 3, 3.5]);
    expect(n.map((x) => Math.round(enemyLifeFactor(b, x) * 100) / 100)).toEqual([1, 1.17, 1.25, 1.3, 1.33, 1.36]);
    expect(n.map((x) => Math.round(bossDamageFactor(b, x) * 100) / 100)).toEqual([0.25, 0.4, 0.55, 0.7, 0.85, 1]);
  });

  it('Boss-Leben (10.3, Tabelle auf 100 gerundet aus dem ungerundeten B)', () => {
    const table: Record<string, number[]> = {
      ignarch: [11400, 20000, 28500, 37000, 45600, 54200],
      nyxhara: [51600, 90300, 129000, 167700, 206400, 245100],
    };
    for (const [id, row] of Object.entries(table)) {
      const hp = c.bossById[id as 'ignarch'].hpBase;
      row.forEach((v, i) => expect(Math.abs(bossLife(b, hp, i + 1, 0) - v)).toBeLessThanOrEqual(100));
    }
    expect(bossLife(b, 10000, 1, 4)).toBeCloseTo(12000);
  });
});

describe('Fortschritt (8.4, 12)', () => {
  it('XP-Kurve (12.1)', () => {
    expect([1, 5, 10, 15, 20, 25, 29].map((l) => xpToNext(b, l))).toEqual([100, 1120, 3160, 5810, 8940, 12500, 15620]);
    expect(totalXpForLevel(b, 30)).toBe(189040);
  });

  it('Waffen-XP (8.4)', () => {
    const steps = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => weaponXpToNext(b, i));
    expect(steps).toEqual([300, 790, 1400, 2090, 2860, 3690, 4570, 5510, 6500]);
    expect(steps.reduce((x, y) => x + y, 0)).toBe(27710);
  });

  it('Gold-Topf (12.5)', () => {
    expect([1, 5, 10, 20, 30].map((s) => Math.round(goldPot(b, s)))).toEqual([172, 330, 528, 924, 1320]);
  });

  it('Kosten (7.4, 8.7)', () => {
    expect([1, 2, 3, 4].map((n) => gemCombineCost(c.gems, n))).toEqual([60, 240, 540, 960]);
    expect([1, 2, 3, 4, 5].map((n) => gemSwapCost(c.gems, n))).toEqual([40, 80, 120, 160, 200]);
    expect([1, 2, 3, 4, 5].map((r) => enchantRankCost(b, r))).toEqual([100, 400, 900, 1600, 2500]);
  });

  it('Stage-Schreibweise (9)', () => {
    expect(stageLabel(1)).toBe('1-1');
    expect(stageLabel(12)).toBe('3-2');
    expect(stageLabel(30)).toBe('6-5');
  });
});
