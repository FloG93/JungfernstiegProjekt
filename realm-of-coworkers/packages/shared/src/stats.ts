// Werteberechnung eines Helden (5.2, 5.4, 5.5, 7, 8.4, 8.7).
// Reihenfolge: Basis + Items + Gems + Artefakte, dann Verzauberung und Klassenpassive, zuletzt Obergrenzen.
import { ITEM_STAT_IDS, STAT_IDS } from './content/ids';
import type { ArtifactSlot, ClassId, GemId, ItemStatId, SlotId, StatId } from './content/ids';
import type { Content } from './content/loader';
import type { EnchantId } from './content/schemas';
import { weaponBonus } from './formulas';

export type StatBlock = Record<StatId, number>;
export type ItemStats = Record<ItemStatId, number>;

export interface EnchantLine {
  id: EnchantId;
  rank: number;
}

export interface StatItem {
  slot: SlotId;
  budget: number;
  stats: ItemStats;
  ele: number;
  weaponLevel?: number;
  enchants?: EnchantLine[];
}

export interface StatInput {
  classId: ClassId;
  level: number;
  /** Zählende Gegenstände: aktive Waffe und die sechs übrigen Plätze. */
  items: StatItem[];
  gems?: { kind: GemId; tier: number }[];
  artifacts?: { slot: ArtifactSlot; rank: number }[];
}

const PERCENT = 100;

export function emptyStats(): StatBlock {
  return { leb: 0, kra: 0, rue: 0, res: 0, tmp: 0, krt: 0, ksd: 0, ele: 0 };
}

export function addStats(a: StatBlock, b: Partial<StatBlock>): StatBlock {
  const out = { ...a };
  for (const k of STAT_IDS) out[k] += b[k] ?? 0;
  return out;
}

/** Basiswerte nach Heldenstufe (5.2). */
export function baseStats(content: Content, classId: ClassId, level: number): StatBlock {
  const b = content.balance.stats.base;
  const cls = content.classById[classId];
  const l1 = level - 1;
  return {
    leb: (b.leb[0] + b.leb[1] * l1) * cls.hpFactor,
    kra: b.kra[0] + b.kra[1] * l1,
    rue: b.rue[0] + b.rue[1] * l1,
    res: b.res[0] + b.res[1] * l1,
    tmp: b.tmp,
    krt: b.krt,
    ksd: b.ksd,
    ele: 0,
  };
}

/** Punkte nach den Klassenanteilen auf die Werte verteilen, ohne Zufall (7.6, 8.4). */
export function pointsToStats(content: Content, classId: ClassId, points: number): StatBlock {
  const shares = content.classById[classId].shares;
  const pp = content.balance.stats.perPoint;
  const out = emptyStats();
  for (const s of ITEM_STAT_IDS) out[s] = points * shares[s] * pp[s];
  return out;
}

/** Werte eines Gems (7.2). */
export function gemStats(content: Content, kind: GemId, tier: number): Partial<StatBlock> {
  const stat = content.gemStat[kind] as StatId;
  const points = content.gems.tierPoints[tier - 1] ?? 0;
  const pp = content.balance.stats.perPoint as Record<string, number>;
  return { [stat]: points * (pp[stat] ?? 0) };
}

/** Zusatzwerte aus der Waffenstufe (8.4): +3 % Budget je Stufe über 1, nach Klassenanteilen. */
export function weaponLevelStats(content: Content, classId: ClassId, item: StatItem): StatBlock {
  if (item.slot !== 'waffe' || !item.weaponLevel) return emptyStats();
  return pointsToStats(content, classId, item.budget * weaponBonus(content.balance, item.weaponLevel));
}

export interface StatsOptions {
  /** Klassenpassive (dauerhafte Buffs aus skills.json) einrechnen. Standard: ja. */
  passives?: boolean;
  /** Obergrenzen anwenden (8.8). Standard: ja. */
  caps?: boolean;
}

/** Gesamtwerte vor zeitlich begrenzten Buffs (5.5). */
export function computeStats(content: Content, input: StatInput, opts: StatsOptions = {}): StatBlock {
  let st = baseStats(content, input.classId, input.level);
  for (const it of input.items) {
    st = addStats(st, it.stats);
    st.ele += it.ele;
    st = addStats(st, weaponLevelStats(content, input.classId, it));
  }
  for (const g of input.gems ?? []) st = addStats(st, gemStats(content, g.kind, g.tier));
  for (const a of input.artifacts ?? []) {
    const def = content.artifactById.get(`${input.classId}_${a.slot}`);
    const points = def?.rankPoints[a.rank - 1] ?? 0;
    st = addStats(st, pointsToStats(content, input.classId, points));
  }

  // Verzauberungen der aktiven Waffe (8.7)
  const weapon = input.items.find((i) => i.slot === 'waffe');
  for (const line of weapon?.enchants ?? []) {
    const def = content.enchants.find((e) => e.id === line.id);
    if (!def || line.rank <= 0) continue;
    for (const stat of def.stats) {
      if (def.mode === 'add') st[stat] += def.perRank * line.rank;
      else st[stat] *= 1 + (def.perRank * line.rank) / PERCENT;
    }
  }

  // Klassenpassive (5.5): dauerhafte Buffs mit ms 0 auf sich selbst
  if (opts.passives !== false) st = applyPermanentBuffs(content, input.classId, st);
  return opts.caps === false ? st : applyCaps(content, st, false);
}

/** Dauerhafte Buffs der Passiv-Fähigkeit einer Klasse (z. B. Standhaft, Blutdurst). */
export function applyPermanentBuffs(content: Content, classId: ClassId, stats: StatBlock): StatBlock {
  const out = { ...stats };
  for (const id of content.classById[classId].skills) {
    const sk = content.skillById.get(id);
    if (!sk || sk.slot !== 'passive') continue;
    for (const e of sk.effects) {
      if (e.k !== 'buff' || e.ms !== 0 || !(STAT_IDS as readonly string[]).includes(e.stat)) continue;
      const stat = e.stat as StatId;
      if (e.mult !== undefined) out[stat] *= e.mult;
      if (e.add !== undefined) out[stat] += e.add;
    }
  }
  return out;
}

/** Obergrenzen (5.1, 8.8). Krit-Chance 60 %, mit Buffs 75 %. */
export function applyCaps(content: Content, stats: StatBlock, buffed: boolean): StatBlock {
  const c = content.balance.stats.caps;
  return {
    ...stats,
    tmp: Math.min(stats.tmp, c.tmp),
    krt: Math.min(stats.krt, buffed ? c.krtBuffed : c.krt),
    ksd: Math.min(stats.ksd, c.ksd),
    ele: Math.min(stats.ele, c.ele),
  };
}
