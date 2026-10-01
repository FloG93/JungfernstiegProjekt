// Abnahme M6: Beutetabellen aus 12.8 und 10.8 (10.000 Würfe, Abweichung unter 2 Prozentpunkten).
import { describe, expect, it } from 'vitest';
import { RARITY_IDS, SLOT_IDS } from './content/ids';
import type { RarityId, SlotId } from './content/ids';
import { rollBossLoot, rollEliteItem, rollStageChest, rollStageItem } from './loot';
import { Rng } from './rng';
import { testContent } from './testing';

const c = testContent();
const N = 10_000;

function share<K extends string>(values: K[], key: K): number {
  return (values.filter((v) => v === key).length / values.length) * 100;
}

describe('Stage-Truhe (12.8, 7.5)', () => {
  it('Seltenheit je Kapitel, Slots, Waffenelemente', () => {
    for (let chapter = 1; chapter <= 6; chapter++) {
      const rng = new Rng(chapter);
      const items = Array.from({ length: N }, () => rollStageItem(c, rng, 'magier', chapter * 5 - 1));
      const table = c.stageLoot.rarityByChapter[String(chapter)]!;
      for (const r of RARITY_IDS) expect(Math.abs(share(items.map((i) => i.rarity), r) - (table[r] ?? 0))).toBeLessThan(2);
      for (const s of SLOT_IDS) expect(Math.abs(share(items.map((i) => i.slot), s) - c.stageLoot.slotWeights[s])).toBeLessThan(2);
      const weapons = items.filter((i) => i.slot === 'waffe');
      expect(Math.abs(share(weapons.map((i) => i.element!), 'physisch') - 40)).toBeLessThan(3);
      expect(items.every((i) => i.rarity !== 'legendaer' && i.ilvl === chapter * 5 - 1)).toBe(true);
    }
  });

  it('2 Gegenstände, 50 % ein Gem mit Stufe nach Kapitel, 2 Splitter', () => {
    const rng = new Rng(42);
    let gems = 0;
    const tiers: number[] = [];
    for (let i = 0; i < N; i++) {
      const chest = rollStageChest(c, rng, 'krieger', 12);
      expect(chest.items).toHaveLength(2);
      expect(chest.splinters).toBe(2);
      gems += chest.gems.length;
      tiers.push(...chest.gems.map((g) => g.tier));
    }
    expect(Math.abs((gems / N) * 100 - 50)).toBeLessThan(2);
    const probs = c.gems.chestTierByChapter['3']!;
    probs.forEach((p, i) => expect(Math.abs((tiers.filter((t) => t === i + 1).length / tiers.length) * 100 - p)).toBeLessThan(2));
  });

  it('Elite: 25 % Chance auf einen weiteren Gegenstand (9.7)', () => {
    const rng = new Rng(7);
    let n = 0;
    for (let i = 0; i < N; i++) if (rollEliteItem(c, rng, 'schurke', 8)) n++;
    expect(Math.abs((n / N) * 100 - 25)).toBeLessThan(2);
  });
});

describe('Boss-Beute (10.8)', () => {
  it('erster Sieg: Bosswaffe 100 %, Episch 85 % / Legendär 15 %, Gem, 6 Splitter, Artefakt', () => {
    const rng = new Rng(3);
    const rar: RarityId[] = [];
    for (let i = 0; i < N; i++) {
      const l = rollBossLoot(c, rng, { classId: 'krieger', bossId: 'ignarch', first: true, beutestufe: 0 });
      expect(l.items[0]!.name).toBe('Langschwert des Glutkönigs');
      expect(l.items[0]!.ilvl).toBe(5);
      expect(l.gems).toHaveLength(1);
      expect(l.gems[0]!.tier).toBeGreaterThanOrEqual(2);
      expect(l.splinters).toBe(6);
      expect(l.artifactUnlock).toBe('amulett');
      rar.push(l.items[1]!.rarity);
    }
    expect(Math.abs(share(rar, 'episch') - 85)).toBeLessThan(2);
    expect(Math.abs(share(rar, 'legendaer') - 15)).toBeLessThan(2);
  });

  it('Wiederholung: Bosswaffe 20 %, Selten 30 / Episch 60 / Legendär 10, Gem 50 %, 3 Splitter, iLvl + Beutestufe', () => {
    const rng = new Rng(4);
    let weapons = 0;
    let gems = 0;
    const rar: RarityId[] = [];
    const slots: SlotId[] = [];
    for (let i = 0; i < N; i++) {
      const l = rollBossLoot(c, rng, { classId: 'magier', bossId: 'voltrax', first: false, beutestufe: 3 });
      const hasWeapon = l.items.length === 2;
      if (hasWeapon) {
        weapons++;
        expect(l.items[0]!.element).toBe('blitz');
        expect(l.items[0]!.ilvl).toBe(18);
      }
      const item = l.items[l.items.length - 1]!;
      rar.push(item.rarity);
      slots.push(item.slot);
      gems += l.gems.length;
      expect(l.splinters).toBe(3);
      expect(l.artifactUnlock).toBeNull();
    }
    expect(Math.abs((weapons / N) * 100 - 20)).toBeLessThan(2);
    expect(Math.abs((gems / N) * 100 - 50)).toBeLessThan(2);
    for (const r of ['selten', 'episch', 'legendaer'] as const) {
      expect(Math.abs(share(rar, r) - (c.bossDrops.repeat.item[r] ?? 0))).toBeLessThan(2);
    }
    for (const s of SLOT_IDS) expect(Math.abs(share(slots, s) - c.bossDrops.itemSlotWeights[s])).toBeLessThan(2);
  });

  it('Artefakte werden durch Ignarch, Voltrax und Solaris freigeschaltet (7.6)', () => {
    const rng = new Rng(5);
    const unlock = (b: 'ignarch' | 'glaciara' | 'voltrax' | 'gorthul' | 'solaris' | 'nyxhara') =>
      rollBossLoot(c, rng, { classId: 'runenweber', bossId: b, first: true, beutestufe: 0 }).artifactUnlock;
    expect([unlock('ignarch'), unlock('glaciara'), unlock('voltrax'), unlock('gorthul'), unlock('solaris'), unlock('nyxhara')])
      .toEqual(['amulett', null, 'ring', null, 'relikt', null]);
  });
});
