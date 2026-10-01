import { describe, expect, it } from 'vitest';
import { CLASS_IDS, SLOT_IDS } from './content/ids';
import type { ClassId } from './content/ids';
import { itemBudget } from './formulas';
import { distributeBudget, statsToPoints } from './items';
import { Rng } from './rng';
import { computeStats, gemStats } from './stats';
import type { StatItem } from './stats';
import { testContent } from './testing';

const c = testContent();
const b = c.balance;

/** Referenzheld (13.1): Stufe 5 × Kapitel, 7 Slots Selten mit iLvl 5 × Kapitel, ohne Gems und Artefakte. */
function referenceItems(cls: ClassId, chapter: number): StatItem[] {
  return SLOT_IDS.map((slot) => {
    const budget = itemBudget(b, slot, 5 * chapter, 'selten');
    return { slot, budget, stats: distributeBudget(c, null, cls, budget), ele: 0 };
  });
}

function reference(cls: ClassId, chapter: number) {
  return computeStats(c, { classId: cls, level: 5 * chapter, items: referenceItems(cls, chapter) }, { passives: false });
}

/** K aus 13.2 (Modellwerte, beim Schurken mit Blutdurst, Meucheln-Bonus und Tarnung). */
const K: Record<ClassId, number> = {
  krieger: 1.11, magier: 1.64, waldlaeufer: 1.63, schurke: 1.62, kleriker: 0.65, runenweber: 0.78,
};

const standardDps = (cls: ClassId, chapter: number) => {
  const st = reference(cls, chapter);
  return st.kra * K[cls] * (1 + st.tmp / 100) * (1 + (Math.min(st.krt, 75) / 100) * 0.5) * 0.75;
};

describe('Referenzwerte 13.3', () => {
  const dpsTable: Record<ClassId, number[]> = {
    krieger: [40, 65, 90, 115, 142, 169],
    magier: [79, 129, 182, 238, 296, 358],
    waldlaeufer: [76, 124, 175, 229, 285, 344],
    schurke: [73, 119, 168, 220, 274, 331],
    kleriker: [25, 40, 56, 73, 90, 107],
    runenweber: [32, 52, 73, 95, 119, 143],
  };
  const hpTable: Record<ClassId, number[]> = {
    krieger: [556, 836, 1116, 1396, 1677, 1957],
    magier: [304, 455, 605, 756, 907, 1057],
    waldlaeufer: [354, 529, 703, 878, 1053, 1227],
    schurke: [369, 553, 738, 922, 1107, 1292],
    kleriker: [465, 701, 936, 1172, 1408, 1643],
    runenweber: [392, 590, 788, 986, 1185, 1383],
  };

  for (const cls of CLASS_IDS) {
    it(`Standard-DPS und Max-Leben ${cls}`, () => {
      expect([1, 2, 3, 4, 5, 6].map((ch) => Math.round(standardDps(cls, ch)))).toEqual(dpsTable[cls]);
      expect([1, 2, 3, 4, 5, 6].map((ch) => Math.round(reference(cls, ch).leb))).toEqual(hpTable[cls]);
    });
  }

  it('RefLeben ist der Mittelwert und steht in balance.json', () => {
    const ref = [1, 2, 3, 4, 5, 6].map((ch) => Math.round(CLASS_IDS.reduce((s, cl) => s + reference(cl, ch).leb, 0) / 6));
    expect(ref).toEqual([407, 611, 815, 1019, 1223, 1427]);
    expect(b.boss.refLife).toEqual(ref);
  });

  it('Boss-Leben B = 150 s × Mittelwert der Schadensklassen (13.4)', () => {
    const B = [1, 2, 3, 4, 5, 6].map((ch) =>
      Math.round((150 * (standardDps('magier', ch) + standardDps('waldlaeufer', ch) + standardDps('schurke', ch))) / 3 / 100) * 100,
    );
    expect(B).toEqual(c.bosses.map((x) => x.hpBase));
  });
});

describe('Verteilung der Punkte (5.4)', () => {
  it('Magier-Waffe mit 219 Punkten', () => {
    const s = distributeBudget(c, null, 'magier', 219);
    expect(Math.round(s.kra)).toBe(46);
    expect(Math.round(s.leb)).toBe(184);
    expect(Math.round(s.rue)).toBe(13);
    expect(Math.round(s.res)).toBe(22);
    expect(s.tmp.toFixed(1)).toBe('4.6');
    expect(s.krt.toFixed(1)).toBe('3.1');
  });

  it('der Zufallsfaktor ändert die Werte, das Budget bleibt exakt', () => {
    const rng = new Rng(3);
    for (let i = 0; i < 200; i++) {
      const cls = CLASS_IDS[i % 6]!;
      const budget = 50 + i;
      const plain = distributeBudget(c, null, cls, budget);
      const rolled = distributeBudget(c, rng, cls, budget);
      expect(statsToPoints(c, rolled)).toBeCloseTo(budget, 9);
      expect(rolled.kra / plain.kra).toBeGreaterThan(0.84);
      expect(rolled.kra / plain.kra).toBeLessThan(1.18);
    }
  });
});

describe('Gems, Waffenstufe, Verzauberung, Passive und Obergrenzen', () => {
  const items = referenceItems('magier', 3);

  it('Gem-Werte (7.2) und Obergrenze Krit-Schaden mit 9 Smaragden V', () => {
    expect(gemStats(c, 'granat', 1)['leb']).toBe(30);
    expect(gemStats(c, 'rubin', 5)['kra']).toBe(12.5);
    expect(gemStats(c, 'topas', 3)['tmp']).toBeCloseTo(2.1);
    expect(gemStats(c, 'smaragd', 4)['ksd']).toBeCloseTo(7.6);
    const gems = Array.from({ length: 9 }, () => ({ kind: 'smaragd' as const, tier: 5 }));
    const st = computeStats(c, { classId: 'magier', level: 30, items: [], gems });
    expect(st.ksd).toBeCloseTo(240);
  });

  it('Waffenstufe 10 erhöht das Waffenbudget um 27 % (8.4)', () => {
    const w = items[0]!;
    const lvl1 = computeStats(c, { classId: 'magier', level: 15, items: [{ ...w, weaponLevel: 1 }] }, { passives: false });
    const lvl10 = computeStats(c, { classId: 'magier', level: 15, items: [{ ...w, weaponLevel: 10 }] }, { passives: false });
    const base = computeStats(c, { classId: 'magier', level: 15, items: [] }, { passives: false });
    expect((lvl10.kra - base.kra) / (lvl1.kra - base.kra)).toBeCloseTo(1.27);
  });

  it('Verzauberung Kraft Rang 5 gibt +5 % Gesamtkraft (8.7)', () => {
    const w = { ...items[0]!, enchants: [{ id: 'kraft' as const, rank: 5 }, { id: 'waffenschaden' as const, rank: 3 }] };
    const plain = computeStats(c, { classId: 'magier', level: 15, items: [items[0]!] });
    const ench = computeStats(c, { classId: 'magier', level: 15, items: [w] });
    expect(ench.kra / plain.kra).toBeCloseTo(1.05);
    expect(ench.ele).toBe(6);
  });

  it('Klassenpassive: Krieger +15 % Rüstung, Schurke +10 Prozentpunkte Krit (5.5)', () => {
    const kr = computeStats(c, { classId: 'krieger', level: 10, items: [] });
    const krNo = computeStats(c, { classId: 'krieger', level: 10, items: [] }, { passives: false });
    expect(kr.rue / krNo.rue).toBeCloseTo(1.15);
    const sc = computeStats(c, { classId: 'schurke', level: 10, items: [] });
    expect(sc.krt).toBe(15);
  });

  it('Obergrenzen greifen (8.8)', () => {
    const gems = Array.from({ length: 20 }, () => ({ kind: 'topas' as const, tier: 5 }));
    const st = computeStats(c, { classId: 'runenweber', level: 30, items: [], gems });
    expect(st.tmp).toBe(40);
  });
});
