// Formeln aus den Abschnitten 5, 7, 8, 9, 10 und 12. Alle Zahlen kommen aus den Inhaltsdateien.
import type { Balance, GemFile } from './content/schemas';
import type { RarityId, SlotId } from './content/ids';
import { STAGES_PER_CHAPTER } from './content/loader';

const PERCENT = 100;

/** Auf ein Vielfaches von step runden („auf 10 gerundet“, 8.4 und 12.1). */
export function roundTo(x: number, step: number): number {
  return Math.round(x / step) * step;
}

export function chapterOfStage(stage: number): number {
  return Math.ceil(stage / STAGES_PER_CHAPTER);
}

export function isBossStage(stage: number): boolean {
  return stage % STAGES_PER_CHAPTER === 0;
}

/** Schreibweise Kapitel-Stage, zum Beispiel 3-2 (9). */
export function stageLabel(stage: number): string {
  const c = chapterOfStage(stage);
  return `${c}-${stage - (c - 1) * STAGES_PER_CHAPTER}`;
}

// ---------- Abschnitt 5 ----------

/** Punktebudget eines Items (5.3). */
export function itemBudget(b: Balance, slot: SlotId, ilvl: number, rarity: RarityId): number {
  return b.items.slotWeights[slot] * (b.items.budget.base + b.items.budget.perIlvl * ilvl) * b.items.rarity[rarity];
}

/** Mitigation eines Helden gegen einen Angreifer der Stufe L (5.6). */
export function heroMitigation(b: Balance, w: number, attackerLevel: number): number {
  const ww = Math.max(0, w);
  return ww / (ww + b.combat.mitigation.base + b.combat.mitigation.perLevel * attackerLevel);
}

/** Item-Anforderung: Heldenstufe mindestens iLvl − 4, mindestens 1 (8.2). */
export function itemRequirement(b: Balance, ilvl: number): number {
  return Math.max(1, ilvl - b.items.reqOffset);
}

/** Verkaufspreis = Budget ÷ 4, gerundet (8.9). */
export function sellPrice(b: Balance, budget: number): number {
  return Math.round(budget / b.items.sellDivisor);
}

// ---------- Abschnitt 8 (Waffen) ----------

/** Waffen-XP von Stufe i nach i + 1 (8.4). */
export function weaponXpToNext(b: Balance, weaponLevel: number): number {
  const x = b.weapon.xp;
  return roundTo(x.mult * weaponLevel ** x.exp, x.round);
}

/** Budget-Bonus der Waffenstufe als Anteil (Stufe 10: 0,27). */
export function weaponBonus(b: Balance, weaponLevel: number): number {
  return b.weapon.bonusPerLevel * (Math.min(weaponLevel, b.weapon.maxLevel) - 1);
}

export function elementChangeCost(b: Balance, ilvl: number): number {
  return b.weapon.elementChangeGoldPerIlvl * ilvl;
}

export function transferCost(b: Balance, weaponLevel: number): number {
  return b.weapon.transferGoldPerLevel * weaponLevel;
}

/** Kosten für Rang r einer Verzauberungszeile: 100 × r² (8.7). */
export function enchantRankCost(b: Balance, rank: number): number {
  return b.weapon.enchant.goldPerRankSq * rank * rank;
}

// ---------- Abschnitt 7 (Gems) ----------

/** Kombinieren: 60 × n² (n = Stufe der Quelle, 7.4). */
export function gemCombineCost(g: GemFile, tier: number): number {
  return g.combineCostMult * tier * tier;
}

/** Tauschen: 40 × n (7.4). */
export function gemSwapCost(g: GemFile, tier: number): number {
  return g.swapCostMult * tier;
}

/** Zahl der freien Gem-Slots bei Heldenstufe L (7.3). */
export function freeGemSlots(g: GemFile, level: number): number {
  return g.slotUnlockLevels.filter((l) => level >= l).length;
}

// ---------- Abschnitt 9 (Gegner) ----------

export function enemyLife(b: Balance, level: number): number {
  return b.enemy.life.base + b.enemy.life.perLevel * level;
}

export function enemyDps(b: Balance, level: number): number {
  return b.enemy.damage.base + b.enemy.damage.perLevel * level;
}

/** Anzahlfaktor C(n) (9.6). */
export function countFactor(b: Balance, n: number): number {
  return 1 + b.party.spawnCount.perExtra * (n - 1);
}

/** Lebensfaktor F(n) (10.3, 9.6). */
export function lifeFactor(b: Balance, n: number): number {
  return 1 + b.party.life.perExtra * (n - 1);
}

/** Lebensfaktor je Gegner H(n) = F(n) ÷ C(n) (9.6). */
export function enemyLifeFactor(b: Balance, n: number): number {
  return lifeFactor(b, n) / countFactor(b, n);
}

/** Einführungsfaktor der Stages 1-1 bis 1-4 (4.3, 9.4). */
export function introFactor(b: Balance, stage: number): number {
  return b.stage.intro.stages.includes(stage) ? b.stage.intro.mult : 1;
}

// ---------- Abschnitt 10 (Bosse) ----------

/** Schadensfaktor M(n) (10.3). */
export function bossDamageFactor(b: Balance, n: number): number {
  return b.boss.damage.base + b.boss.damage.perExtra * (n - 1);
}

/** Faktor der Kampfstufe K: 1 + 0,05 × K (10.3). */
export function kampfstufeFactor(b: Balance, k: number): number {
  return 1 + (b.boss.kampfstufeProzent / PERCENT) * Math.min(k, b.boss.kampfstufeMax);
}

export function bossLife(b: Balance, hpBase: number, n: number, k: number): number {
  return hpBase * lifeFactor(b, n) * kampfstufeFactor(b, k);
}

export function refLife(b: Balance, chapter: number): number {
  const v = b.boss.refLife[chapter - 1];
  if (v === undefined) throw new Error(`RefLeben für Kapitel ${chapter} fehlt`);
  return v;
}

/** Angreiferstufe für die Mitigation: Stage-Nummer bei normalen Gegnern, 5 × Kapitel bei Bossen (5.6). */
export function bossAttackerLevel(b: Balance, chapter: number): number {
  return b.boss.levelPerChapter * chapter;
}

// ---------- Abschnitt 12 (Fortschritt) ----------

/** XP bis zur nächsten Stufe: auf 10 gerundet von 100 × L^1,5 (12.1). */
export function xpToNext(b: Balance, level: number): number {
  const c = b.progression.xpCurve;
  return roundTo(c.mult * level ** c.exp, c.round);
}

/** Summe der XP von Stufe 1 bis zur Stufe `level`. */
export function totalXpForLevel(b: Balance, level: number): number {
  let s = 0;
  for (let l = 1; l < level; l++) s += xpToNext(b, l);
  return s;
}

/** Gold-Topf einer Stage G(s) = 66 × (2 + 0,6 × s) (12.5). */
export function goldPot(b: Balance, stage: number): number {
  const g = b.gold.stage;
  return g.perPoint * (g.base + g.perStage * stage);
}
