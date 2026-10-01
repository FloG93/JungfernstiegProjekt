// Beute (7.5, 8.2 bis 8.5, 9.7, 10.8, 12.8). Persönlich: jeder Spieler würfelt mit eigenem Zufallszähler.
import { ELEMENT_IDS, GEM_IDS, RARITY_IDS, SLOT_IDS } from './content/ids';
import type { ArtifactSlot, BossId, ClassId, ElementId, GemId, RarityId, SlotId } from './content/ids';
import type { Content } from './content/loader';
import { chapterOfStage } from './formulas';
import { createItem } from './items';
import type { ItemData } from './items';
import type { Rng } from './rng';

const PERCENT = 100;

export interface GemDrop {
  kind: GemId;
  tier: number;
}

export interface LootResult {
  items: ItemData[];
  gems: GemDrop[];
  splinters: number;
  /** Erster Sieg über einen Boss schaltet ein Artefakt frei (7.6). */
  artifactUnlock: ArtifactSlot | null;
}

export function emptyLoot(): LootResult {
  return { items: [], gems: [], splinters: 0, artifactUnlock: null };
}

export function rollRarity(rng: Rng, table: Partial<Record<RarityId, number>>): RarityId {
  return rng.weighted(table, RARITY_IDS);
}

export function rollSlot(rng: Rng, weights: Record<SlotId, number>): SlotId {
  return rng.weighted(weights, SLOT_IDS);
}

export function rollWeaponElement(content: Content, rng: Rng): ElementId {
  return rng.weighted(content.stageLoot.weaponElement, ELEMENT_IDS);
}

/** Gem mit Stufe nach Kapitel (7.5); bei Bossen eine Stufe höher, höchstens V. */
export function rollGem(content: Content, rng: Rng, chapter: number, tierOffset = 0): GemDrop {
  const probs = content.gems.chestTierByChapter[String(chapter)] ?? [PERCENT];
  const tier = Math.min(content.gems.tierPoints.length, rng.weightedIndex(probs) + 1 + tierOffset);
  return { kind: rng.pick(GEM_IDS), tier };
}

/** Gegenstand aus Stage-Truhe oder von einer Elite: Stufe der Stage, Seltenheit nach Kapitel (12.8). */
export function rollStageItem(content: Content, rng: Rng, classId: ClassId, stage: number): ItemData {
  const chapter = chapterOfStage(stage);
  const slot = rollSlot(rng, content.stageLoot.slotWeights);
  const rarity = rollRarity(rng, content.stageLoot.rarityByChapter[String(chapter)] ?? { gewoehnlich: PERCENT });
  const spec: Parameters<typeof createItem>[2] = { classId, slot, ilvl: stage, rarity };
  if (slot === 'waffe') spec.element = rollWeaponElement(content, rng);
  return createItem(content, rng, spec);
}

/** Truhe am Ende einer normalen Stage (12.8): 2 Gegenstände, 50 % ein Gem, 2 Splitter. */
export function rollStageChest(content: Content, rng: Rng, classId: ClassId, stage: number): LootResult {
  const l = content.stageLoot;
  const out = emptyLoot();
  for (let i = 0; i < l.itemsPerChest; i++) out.items.push(rollStageItem(content, rng, classId, stage));
  if (rng.chance(l.gemChance)) out.gems.push(rollGem(content, rng, chapterOfStage(stage)));
  out.splinters = l.splinters;
  return out;
}

/** Elite-Beute (9.7): 25 % Chance auf einen weiteren Gegenstand der Stage. */
export function rollEliteItem(content: Content, rng: Rng, classId: ClassId, stage: number): ItemData | null {
  return rng.chance(content.elite.itemChance) ? rollStageItem(content, rng, classId, stage) : null;
}

export interface BossLootOpts {
  classId: ClassId;
  bossId: BossId;
  first: boolean;
  /** Beutestufe K des Spielers für diesen Boss (8.2, 10.9). */
  beutestufe: number;
}

/** Boss-Beute (10.8): Bosswaffe, Gegenstand (Roll B), Gem, Splitter, Artefakt-Freischaltung. */
export function rollBossLoot(content: Content, rng: Rng, o: BossLootOpts): LootResult {
  const boss = content.bossById[o.bossId];
  const row = o.first ? content.bossDrops.first : content.bossDrops.repeat;
  const ilvl = content.balance.boss.levelPerChapter * boss.chapter + (o.first ? 0 : o.beutestufe);
  const out = emptyLoot();
  if (rng.chance(row.weapon / PERCENT)) {
    out.items.push(createItem(content, rng, { classId: o.classId, slot: 'waffe', ilvl, rarity: 'legendaer', bossWeapon: o.bossId }));
  }
  const slot = rollSlot(rng, content.bossDrops.itemSlotWeights);
  const rarity = rollRarity(rng, row.item);
  const spec: Parameters<typeof createItem>[2] = { classId: o.classId, slot, ilvl, rarity };
  if (slot === 'waffe') spec.element = rollWeaponElement(content, rng);
  out.items.push(createItem(content, rng, spec));
  if (rng.chance(row.gem / PERCENT)) out.gems.push(rollGem(content, rng, boss.chapter, content.gems.bossTierOffset));
  out.splinters = row.splinters;
  if (o.first) {
    const art = content.artifacts.find((a) => a.class === o.classId && a.unlockBoss === o.bossId);
    if (art) out.artifactUnlock = art.slot;
  }
  return out;
}

