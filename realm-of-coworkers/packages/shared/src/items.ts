// Erzeugen von Gegenständen (5.3, 5.4, 8.3, 8.5).
import { ITEM_STAT_IDS } from './content/ids';
import type { BossId, ClassId, ElementId, RarityId, SlotId } from './content/ids';
import type { Content } from './content/loader';
import { itemBudget } from './formulas';
import type { Rng } from './rng';
import type { EnchantLine, ItemStats } from './stats';

export interface ItemData {
  classId: ClassId;
  slot: SlotId;
  ilvl: number;
  rarity: RarityId;
  budget: number;
  stats: ItemStats;
  ele: number;
  name: string;
  /** Nur Waffen tragen ein Element (8.4); andere Slots null. */
  element: ElementId | null;
  weaponLevel: number;
  weaponXp: number;
  enchants: EnchantLine[];
  /** Fester Effekt einer Bosswaffe: ID des Bosses (8.5). */
  effectId: BossId | null;
}

export interface ItemSpec {
  classId: ClassId;
  slot: SlotId;
  ilvl: number;
  rarity: RarityId;
  element?: ElementId;
  /** Erzeugt die legendäre Bosswaffe dieses Bosses (8.5). */
  bossWeapon?: BossId;
}

/**
 * Verteilt das Budget nach den Klassenanteilen. Jede Zeile erhält einen Zufallsfaktor aus rollJitter,
 * danach wird die Summe exakt auf das Budget zurückgeführt (5.4). Ohne rng gibt es keinen Zufall.
 */
export function distributeBudget(content: Content, rng: Rng | null, classId: ClassId, budget: number): ItemStats {
  const shares = content.classById[classId].shares;
  const [lo, hi] = content.balance.items.rollJitter;
  const raw = ITEM_STAT_IDS.map((s) => shares[s] * (rng ? rng.range(lo, hi) : 1));
  const total = raw.reduce((a, b) => a + b, 0);
  const pp = content.balance.stats.perPoint;
  const out = {} as ItemStats;
  ITEM_STAT_IDS.forEach((s, i) => {
    out[s] = ((raw[i] ?? 0) / total) * budget * pp[s];
  });
  return out;
}

/** Punkte eines Gegenstands aus seinen Werten zurückrechnen (Summe = Budget). */
export function statsToPoints(content: Content, stats: ItemStats): number {
  const pp = content.balance.stats.perPoint;
  return ITEM_STAT_IDS.reduce((s, k) => s + stats[k] / pp[k], 0);
}

/** Beugt ein Präfix im Nominativ maskulin („Zerschlissener“) nach dem Geschlecht des Typs. */
export function inflectPrefix(prefix: string, gender: 'm' | 'f' | 'n' | 'pl'): string {
  if (!prefix.endsWith('er')) return prefix;
  const stem = prefix.slice(0, -2);
  switch (gender) {
    case 'm':
      return `${stem}er`;
    case 'n':
      return `${stem}es`;
    default:
      return `${stem}e`;
  }
}

/** Name = Präfix + Typ + Suffix (8.3), zum Beispiel „Zerschlissener Lederhelm der Wachsamkeit“. */
export function itemName(content: Content, rng: Rng, classId: ClassId, slot: SlotId, rarity: RarityId): string {
  const type = content.names.types[classId][slot];
  const gender = content.genders[type] ?? 'm';
  const prefix = inflectPrefix(rng.pick(content.names.prefixes[rarity]), gender);
  const suffix = rng.pick(content.names.suffixes);
  return `${prefix} ${type} ${suffix}`;
}

/** „<Klassenwaffe> des <Boss>“ (8.5). */
export function bossWeaponName(content: Content, classId: ClassId, bossId: BossId): string {
  return `${content.names.types[classId].waffe} ${content.names.bossGenitive[bossId]}`;
}

export function createItem(content: Content, rng: Rng, spec: ItemSpec): ItemData {
  const b = content.balance;
  const ilvl = Math.max(1, Math.min(spec.ilvl, b.items.maxIlvl));
  const isBossWeapon = spec.bossWeapon !== undefined;
  const slot: SlotId = isBossWeapon ? 'waffe' : spec.slot;
  const rarity: RarityId = isBossWeapon ? 'legendaer' : spec.rarity;
  const budget = itemBudget(b, slot, ilvl, rarity);
  const stats = distributeBudget(content, rng, spec.classId, budget);
  const ele = rarity === 'legendaer' ? b.items.legendaryElePct : 0;
  let element: ElementId | null = null;
  if (slot === 'waffe') {
    element = isBossWeapon ? content.bossById[spec.bossWeapon!].element : (spec.element ?? 'physisch');
  }
  const name = isBossWeapon
    ? bossWeaponName(content, spec.classId, spec.bossWeapon!)
    : itemName(content, rng, spec.classId, slot, rarity);
  return {
    classId: spec.classId,
    slot,
    ilvl,
    rarity,
    budget,
    stats,
    ele,
    name,
    element,
    weaponLevel: 1,
    weaponXp: 0,
    enchants: [],
    effectId: isBossWeapon ? spec.bossWeapon! : null,
  };
}

/** Startausrüstung für neue Helden: eine gewöhnliche physische Waffe der Stufe 1. OPEN-009 */
export function starterWeapon(content: Content, rng: Rng, classId: ClassId): ItemData {
  return createItem(content, rng, { classId, slot: 'waffe', ilvl: 1, rarity: 'gewoehnlich', element: 'physisch' });
}
