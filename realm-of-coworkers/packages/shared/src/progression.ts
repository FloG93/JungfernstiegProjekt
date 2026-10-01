// Fortschritt (8.4, 12): XP und Gold aus Töpfen, Stufenaufstieg, Waffen-XP, Boss-Belohnung, Freischaltung.
import type { Content } from './content/loader';
import type { StageDef } from './content/schemas';
import { goldPot, totalXpForLevel, weaponXpToNext, xpToNext } from './formulas';

export interface Reward {
  xp: number;
  gold: number;
}

/**
 * Anteil `frac` am Topf einer Begegnung (12.3). Normale Stage: xp(s) und G(s) je Basispunkte ÷ 66.
 * Boss-Stage: XP 0,4 × xp(s) je Basispunkte ÷ 18, Gold 18/66 des Stage-Topfs (12.2, 12.5).
 */
export function encounterReward(content: Content, def: StageDef, encounter: number, frac: number, repeat: boolean): Reward {
  const b = content.balance;
  const enc = def.encounters[encounter];
  if (!enc) return { xp: 0, gold: 0 };
  const stagePoints = b.stage.encounterPoints.reduce((a, x) => a + x, 0);
  const xpS = xpToNext(b, def.stage);
  const g = goldPot(b, def.stage);
  if (def.boss) {
    const bossPoints = b.stage.bossStage.encounterPoints.reduce((a, x) => a + x, 0);
    return {
      xp: frac * b.progression.xpFactors.bossStageEncounters * xpS * (enc.points / bossPoints),
      gold: frac * g * (enc.points / stagePoints),
    };
  }
  const xpFactor = repeat ? b.progression.xpFactors.stageRepeat : 1;
  const goldFactor = repeat ? b.gold.stageRepeat : 1;
  return { xp: frac * xpS * xpFactor * (enc.points / stagePoints), gold: frac * g * goldFactor * (enc.points / stagePoints) };
}

/** Belohnung für den Boss selbst (12.2, 12.5): erster Sieg 1,0 × xp(s) und 2 × G(s), Wiederholung 0,5 und 1,0, Helfer 0. */
export function bossReward(content: Content, stage: number, first: boolean, helper: boolean): Reward {
  if (helper) return { xp: 0, gold: 0 };
  const b = content.balance;
  const xpS = xpToNext(b, stage);
  const g = goldPot(b, stage);
  return first
    ? { xp: b.progression.xpFactors.bossFirst * xpS, gold: b.gold.bossFirst * g }
    : { xp: b.progression.xpFactors.bossRepeat * xpS, gold: b.gold.bossRepeat * g };
}

export interface XpResult {
  level: number;
  xp: number;
  /** Erreichte neue Stufen in Reihenfolge. */
  levelUps: number[];
  /** Tatsächlich angerechnete Helden-XP (ab Stufe 30 verfallen sie, 8.8). */
  gained: number;
}

/** XP auf einen Helden anrechnen (12.1). `xp` zählt innerhalb der aktuellen Stufe. */
export function applyXp(content: Content, level: number, xp: number, gain: number): XpResult {
  const max = content.balance.stats.maxLevel;
  let l = level;
  let x = xp;
  let left = gain;
  let gained = 0;
  const ups: number[] = [];
  while (left > 0 && l < max) {
    const need = xpToNext(content.balance, l) - x;
    if (left >= need) {
      left -= need;
      gained += need;
      l++;
      x = 0;
      ups.push(l);
    } else {
      x += left;
      gained += left;
      left = 0;
    }
  }
  return { level: l, xp: l >= max ? 0 : x, levelUps: ups, gained };
}

/** Anteil der Helden-XP, den die aktive Waffe erhält: 50 %, ab Heldenstufe 30 100 % (8.4). */
export function weaponXpShare(content: Content, heroLevel: number): number {
  const w = content.balance.weapon.xp;
  return heroLevel >= content.balance.stats.maxLevel ? w.shareAtMaxLevel : w.share;
}

export function applyWeaponXp(content: Content, weaponLevel: number, weaponXp: number, gain: number): { level: number; xp: number } {
  const max = content.balance.weapon.maxLevel;
  let l = weaponLevel;
  let x = weaponXp + gain;
  while (l < max && x >= weaponXpToNext(content.balance, l)) {
    x -= weaponXpToNext(content.balance, l);
    l++;
  }
  return { level: l, xp: l >= max ? 0 : x };
}

/** Gesamt-XP seit Stufe 1 (für Anzeige und Prüfungen). */
export function totalXp(content: Content, level: number, xp: number): number {
  return totalXpForLevel(content.balance, level) + xp;
}

/** Freie Stages eines Helden (3.4): Stage 1 und jede Stage s mit Abschluss von s − 1. */
export function unlockedStages(cleared: Iterable<number>, stageCount: number): Set<number> {
  const c = new Set(cleared);
  const out = new Set<number>([1]);
  for (let s = 2; s <= stageCount; s++) if (c.has(s - 1)) out.add(s);
  return out;
}

/** Nachzügler-Regel (3.4, 11.2): Stufe mindestens empfohlene Stufe minus 3. */
export function lateJoinerAllowed(content: Content, heroLevel: number, def: StageDef): boolean {
  return heroLevel >= def.recommendedLevel - content.balance.party.lateJoinerLevels;
}

/** Boss-Timer (10.9) in ms, skaliert mit BOSS_TIMER_SCALE. */
export function bossTimerMs(content: Content, chapter: number, scale: number): number {
  const minutes = content.balance.boss.timersMinutes[chapter - 1] ?? 0;
  const msPerMinute = 60_000;
  return minutes * msPerMinute * scale;
}
