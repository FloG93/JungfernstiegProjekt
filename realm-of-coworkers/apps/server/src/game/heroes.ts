// Helden, Ausrüstung, Gems, Schmiede, Archiv (4.1, 7, 8, 15.1, 15.2). Jede Änderung in einer Transaktion (2.5).
import {
  ARTIFACT_SLOTS, BOSS_IDS, EQUIP_SLOTS, EQUIP_SLOT_OF, Rng, applyCaps, computeStats, elementChangeCost,
  enchantRankCost, freeGemSlots, gemCombineCost, gemSwapCost, itemRequirement, sellPrice, starterWeapon,
  transferCost, unlockedStages, xpToNext, bossTimerMs,
} from '@aethra/shared';
import type {
  Appearance, ArtifactDTO, ArtifactSlot, BossBoardEntry, ClassId, Content, ElementId, EquipSlot, GemDTO, GemId,
  HeroSettings, HeroSetup, HeroStateDTO, HeroSummaryDTO, ItemDTO, ItemData, StatInput, StatItem, WeaponInfo,
} from '@aethra/shared';
import type { Transaction, Selectable } from 'kysely';
import type { Db } from '../db/db';
import type { DB, HeroesTable, ItemsTable } from '../db/schema';
import { fail } from '../http/errors';

type Tx = Transaction<DB> | Db;
export type HeroRow = Selectable<HeroesTable>;
export type ItemRow = Selectable<ItemsTable>;

const NAME_PATTERN = /^[A-Za-z0-9ÄÖÜäöüß ]+$/;
const DEFAULT_SETTINGS: HeroSettings = { autoPotion: true, autoDodge: true, autoContinue: false };

export interface GameCtx {
  db: Db;
  content: Content;
  bossTimerScale: number;
  isHeroInRun: (heroId: number) => boolean;
  now: () => number;
}

// ---------- Hilfen ----------

export function parseJson<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function itemDto(content: Content, r: ItemRow): ItemDTO {
  return {
    id: r.id,
    slot: r.slot as ItemDTO['slot'],
    ilvl: r.ilvl,
    rarity: r.rarity as ItemDTO['rarity'],
    budget: r.budget,
    stats: parseJson(r.stats, { leb: 0, kra: 0, rue: 0, res: 0, tmp: 0, krt: 0 }),
    ele: r.ele,
    name: r.name,
    element: (r.element as ElementId | null) ?? null,
    weaponLevel: r.weapon_level,
    weaponXp: r.weapon_xp,
    enchants: parseJson(r.enchants, []),
    effectId: (r.effect_id as ItemDTO['effectId']) ?? null,
    equipSlot: (r.equip_slot as EquipSlot | null) ?? null,
    stash: r.stash === 1,
    locked: r.locked === 1,
    requirement: itemRequirement(content.balance, r.ilvl),
    sellPrice: sellPrice(content.balance, r.budget),
  };
}

function statItem(r: ItemRow): StatItem {
  return {
    slot: r.slot as StatItem['slot'],
    budget: r.budget,
    stats: parseJson(r.stats, { leb: 0, kra: 0, rue: 0, res: 0, tmp: 0, krt: 0 }),
    ele: r.ele,
    weaponLevel: r.weapon_level,
    enchants: parseJson(r.enchants, []),
  };
}

export async function getHeroRow(db: Tx, heroId: number): Promise<HeroRow> {
  const h = await db.selectFrom('heroes').selectAll().where('id', '=', heroId).executeTakeFirst();
  if (!h) fail('NOT_FOUND', 'Held nicht gefunden.');
  return h;
}

/** Held muss dem Konto gehören (403) und darf nicht in einem Run stecken (409, 15.2). */
export async function ownHero(ctx: GameCtx, accountId: number, heroId: number, mutation: boolean): Promise<HeroRow> {
  const h = await getHeroRow(ctx.db, heroId);
  if (h.account_id !== accountId) fail('FORBIDDEN', 'Dieser Held gehört einem anderen Konto.');
  if (mutation && ctx.isHeroInRun(heroId)) fail('HERO_IN_RUN', 'Der Held ist gerade in einem Run.');
  return h;
}

async function heroItems(db: Tx, heroId: number): Promise<ItemRow[]> {
  return db.selectFrom('items').selectAll().where('hero_id', '=', heroId).orderBy('id').execute();
}

function summary(h: HeroRow): HeroSummaryDTO {
  return { id: h.id, name: h.name, classId: h.class as ClassId, level: h.level, appearance: parseJson<Appearance>(h.appearance, { body: 0, portrait: 0, palette: 0 }) };
}

// ---------- Werte ----------

export async function statInputs(db: Tx, h: HeroRow, set: 'A' | 'B'): Promise<{ input: StatInput; weapon: ItemRow | undefined }> {
  const items = await heroItems(db, h.id);
  const gems = await db.selectFrom('gems').selectAll().where('hero_id', '=', h.id).where('socket', 'is not', null).execute();
  const arts = await db.selectFrom('artifacts').selectAll().where('hero_id', '=', h.id).execute();
  const weaponSlot = set === 'A' ? 'Waffe_A' : 'Waffe_B';
  const weapon = items.find((i) => i.equip_slot === weaponSlot);
  const armor = items.filter((i) => i.equip_slot !== null && !i.equip_slot.startsWith('Waffe_'));
  return {
    weapon,
    input: {
      classId: h.class as ClassId,
      level: h.level,
      items: [...armor, ...(weapon ? [weapon] : [])].map(statItem),
      gems: gems.map((g) => ({ kind: g.kind as GemId, tier: g.tier })),
      artifacts: arts.filter((a) => a.rank > 0).map((a) => ({ slot: a.slot as ArtifactSlot, rank: a.rank })),
    },
  };
}

/** Aufbau eines Helden für die Simulation (Werte je Waffensatz, Element, Bosswaffen-Effekt). */
export async function heroSetup(ctx: GameCtx, heroId: number, playerId: string): Promise<HeroSetup> {
  const h = await getHeroRow(ctx.db, heroId);
  const sets = {} as Record<'A' | 'B', WeaponInfo>;
  for (const set of ['A', 'B'] as const) {
    const { input, weapon } = await statInputs(ctx.db, h, set);
    const info: WeaponInfo = {
      stats: computeStats(ctx.content, input, { caps: false }),
      hasWeapon: !!weapon,
      element: (weapon?.element as ElementId | undefined) ?? 'physisch',
      effectBoss: (weapon?.effect_id as WeaponInfo['effectBoss']) ?? null,
    };
    if (weapon) info.itemId = weapon.id;
    sets[set] = info;
  }
  const arts = await ctx.db.selectFrom('artifacts').selectAll().where('hero_id', '=', heroId).execute();
  const settings = { ...DEFAULT_SETTINGS, ...parseJson<Partial<HeroSettings>>(h.settings, {}) };
  return {
    dbId: h.id,
    playerId,
    name: h.name,
    classId: h.class as ClassId,
    level: h.level,
    appearance: parseJson(h.appearance, {}),
    sets,
    activeSet: sets[h.active_set].hasWeapon || !sets[h.active_set === 'A' ? 'B' : 'A'].hasWeapon ? h.active_set : (h.active_set === 'A' ? 'B' : 'A'),
    artifacts: arts.filter((a) => a.rank > 0).map((a) => ({ slot: a.slot as ArtifactSlot, rank: a.rank })),
    autocast: parseJson(h.autocast, {}),
    autoPotion: settings.autoPotion,
    autoDodge: settings.autoDodge,
  };
}

// ---------- Zustand ----------

export async function bossBoard(ctx: GameCtx, heroId: number): Promise<BossBoardEntry[]> {
  const rows = await ctx.db.selectFrom('boss_state').selectAll().where('hero_id', '=', heroId).execute();
  const c = ctx.content;
  return BOSS_IDS.map((id) => {
    const def = c.bossById[id];
    const r = rows.find((x) => x.boss_id === id);
    const readyAt = r?.last_kill_at ? r.last_kill_at + bossTimerMs(c, def.chapter, ctx.bossTimerScale) : null;
    return {
      bossId: id,
      name: def.name,
      chapter: def.chapter,
      defeated: !!r?.first_kill_at,
      readyAt: readyAt !== null && readyAt > ctx.now() ? readyAt : null,
      kampfstufe: r?.kampfstufe ?? 0,
      phases: def.phases.map((p) => ({ element: p.element, weakTo: c.elementById[p.element].weakTo })),
    };
  });
}

export async function heroState(ctx: GameCtx, heroId: number): Promise<HeroStateDTO> {
  const c = ctx.content;
  const h = await getHeroRow(ctx.db, heroId);
  const items = (await heroItems(ctx.db, heroId)).map((r) => itemDto(c, r));
  const gems = await ctx.db.selectFrom('gems').selectAll().where('hero_id', '=', heroId).orderBy('id').execute();
  const arts = await ctx.db.selectFrom('artifacts').selectAll().where('hero_id', '=', heroId).execute();
  const progress = await ctx.db.selectFrom('stage_progress').selectAll().where('hero_id', '=', heroId).orderBy('stage').execute();
  const story = await ctx.db.selectFrom('story_seen').select('text_id').where('hero_id', '=', heroId).execute();
  const stats = {} as HeroStateDTO['stats'];
  for (const set of ['A', 'B'] as const) {
    const { input } = await statInputs(ctx.db, h, set);
    stats[set] = applyCaps(c, computeStats(c, input, { caps: false }), false);
  }
  const equipped: HeroStateDTO['equipped'] = {};
  for (const it of items) if (it.equipSlot) equipped[it.equipSlot] = it;
  const classId = h.class as ClassId;
  const artifacts: ArtifactDTO[] = ARTIFACT_SLOTS.map((slot) => {
    const def = c.artifactById.get(`${classId}_${slot}`)!;
    const r = arts.find((a) => a.slot === slot);
    return { slot, id: def.id, name: def.name, rank: r?.rank ?? 0, unlocked: (r?.rank ?? 0) > 0 };
  });
  return {
    hero: {
      ...summary(h),
      xp: h.xp,
      xpToNext: h.level >= c.balance.stats.maxLevel ? 0 : xpToNext(c.balance, h.level),
      gold: h.gold,
      splinters: h.splinters,
      activeSet: h.active_set,
      autocast: parseJson(h.autocast, {}),
      settings: { ...DEFAULT_SETTINGS, ...parseJson<Partial<HeroSettings>>(h.settings, {}) },
    },
    stats,
    equipped,
    inventory: items.filter((i) => !i.equipSlot && !i.stash),
    stash: items.filter((i) => i.stash),
    gems: gems.map((g): GemDTO => ({ id: g.id, kind: g.kind as GemId, tier: g.tier, socket: g.socket })),
    freeSockets: freeGemSlots(c.gems, h.level),
    artifacts,
    bosses: await bossBoard(ctx, heroId),
    cleared: progress.map((p) => ({ stage: p.stage, clears: p.clears, bestTimeMs: p.best_time_ms })),
    unlockedStages: [...unlockedStages(progress.map((p) => p.stage), c.stages.length)].sort((a, b) => a - b),
    storySeen: story.map((s) => s.text_id),
    inRun: ctx.isHeroInRun(heroId),
  };
}

// ---------- Helden anlegen und löschen (4.1) ----------

export async function listHeroes(ctx: GameCtx, accountId: number): Promise<HeroSummaryDTO[]> {
  const rows = await ctx.db.selectFrom('heroes').selectAll().where('account_id', '=', accountId).orderBy('id').execute();
  return rows.map(summary);
}

export function validateHeroName(content: Content, name: string): string {
  const n = name.trim().replace(/\s+/g, ' ');
  const l = content.engine.limits;
  if (n.length < l.heroNameMin || n.length > l.heroNameMax || !NAME_PATTERN.test(n)) {
    fail('BAD_REQUEST', `Name: ${l.heroNameMin} bis ${l.heroNameMax} Zeichen, nur Buchstaben, Ziffern und Leerzeichen.`);
  }
  return n;
}

export function validateAppearance(content: Content, a: Appearance): void {
  const l = content.engine.appearance;
  if (a.body >= l.bodies || a.portrait >= l.portraits || a.palette >= l.palettes) fail('BAD_REQUEST', 'Aussehen ungültig.');
}

export async function createHero(ctx: GameCtx, accountId: number, name: string, classId: ClassId, appearance: Appearance): Promise<HeroSummaryDTO> {
  const c = ctx.content;
  const n = validateHeroName(c, name);
  validateAppearance(c, appearance);
  return ctx.db.transaction().execute(async (trx) => {
    const existing = await trx.selectFrom('heroes').select(['name', 'class']).where('account_id', '=', accountId).execute();
    if (existing.some((e) => e.class === classId)) fail('CONFLICT', 'Für diese Klasse gibt es bereits einen Helden.');
    if (existing.some((e) => e.name.toLowerCase() === n.toLowerCase())) fail('NAME_TAKEN', 'Diesen Namen gibt es schon.');
    const now = ctx.now();
    const autocast: Record<string, boolean> = {};
    for (const sid of c.classById[classId].skills) {
      const def = c.skillById.get(sid);
      if (def?.autoCast) autocast[sid] = def.autoCast.default;
    }
    const res = await trx.insertInto('heroes').values({
      account_id: accountId, name: n, class: classId, appearance: JSON.stringify(appearance), level: 1, xp: 0, gold: 0,
      splinters: 0, active_set: 'A', autocast: JSON.stringify(autocast), settings: JSON.stringify(DEFAULT_SETTINGS), created_at: now,
    }).returning('id').executeTakeFirstOrThrow();
    // OPEN-009: Startwaffe in Satz A
    const weapon = starterWeapon(c, new Rng((now ^ res.id) >>> 0), classId);
    await insertItem(trx, res.id, weapon, now, 'Waffe_A');
    const h = await getHeroRow(trx, res.id);
    return summary(h);
  });
}

export async function deleteHero(ctx: GameCtx, accountId: number, heroId: number, confirmName: string): Promise<void> {
  const h = await ownHero(ctx, accountId, heroId, true);
  if (h.name.trim().toLowerCase() !== confirmName.trim().toLowerCase()) fail('BAD_REQUEST', 'Der eingegebene Name stimmt nicht.');
  await ctx.db.deleteFrom('heroes').where('id', '=', heroId).execute();
}

export async function setAppearance(ctx: GameCtx, accountId: number, heroId: number, a: Appearance): Promise<void> {
  await ownHero(ctx, accountId, heroId, true);
  validateAppearance(ctx.content, a);
  await ctx.db.updateTable('heroes').set({ appearance: JSON.stringify(a) }).where('id', '=', heroId).execute();
}

export async function setSettings(
  ctx: GameCtx, accountId: number, heroId: number,
  s: { autocast?: Record<string, boolean>; autoPotion?: boolean; autoDodge?: boolean; autoContinue?: boolean; activeSet?: 'A' | 'B' },
): Promise<void> {
  const h = await ownHero(ctx, accountId, heroId, false);
  const skills = new Set(ctx.content.classById[h.class as ClassId].skills);
  const autocast = parseJson<Record<string, boolean>>(h.autocast, {});
  for (const [k, v] of Object.entries(s.autocast ?? {})) {
    if (!skills.has(k)) fail('BAD_REQUEST', `Unbekannte Fähigkeit ${k}.`);
    autocast[k] = v;
  }
  const settings = { ...DEFAULT_SETTINGS, ...parseJson<Partial<HeroSettings>>(h.settings, {}) };
  if (s.autoPotion !== undefined) settings.autoPotion = s.autoPotion;
  if (s.autoDodge !== undefined) settings.autoDodge = s.autoDodge;
  if (s.autoContinue !== undefined) settings.autoContinue = s.autoContinue;
  const upd: { autocast: string; settings: string; active_set?: 'A' | 'B' } = { autocast: JSON.stringify(autocast), settings: JSON.stringify(settings) };
  if (s.activeSet) {
    if (ctx.isHeroInRun(heroId)) fail('HERO_IN_RUN', 'Waffensatz im Run nur mit Waffenwechsel.');
    upd.active_set = s.activeSet;
  }
  await ctx.db.updateTable('heroes').set(upd).where('id', '=', heroId).execute();
}

// ---------- Gegenstände (8.1, 8.9) ----------

export async function insertItem(trx: Tx, heroId: number, it: ItemData, now: number, equipSlot: EquipSlot | null = null, stash = false): Promise<number> {
  const r = await trx.insertInto('items').values({
    hero_id: heroId, slot: it.slot, ilvl: it.ilvl, rarity: it.rarity, budget: it.budget, stats: JSON.stringify(it.stats),
    ele: it.ele, name: it.name, element: it.element, weapon_level: it.weaponLevel, weapon_xp: it.weaponXp,
    enchants: JSON.stringify(it.enchants), effect_id: it.effectId, equip_slot: equipSlot, stash: stash ? 1 : 0, locked: 0, created_at: now,
  }).returning('id').executeTakeFirstOrThrow();
  return r.id;
}

async function getItem(trx: Tx, heroId: number, itemId: number): Promise<ItemRow> {
  const it = await trx.selectFrom('items').selectAll().where('id', '=', itemId).executeTakeFirst();
  if (!it) fail('NOT_FOUND', 'Gegenstand nicht gefunden.');
  if (it.hero_id !== heroId) fail('FORBIDDEN', 'Dieser Gegenstand gehört einem anderen Helden.');
  return it;
}

async function counts(trx: Tx, heroId: number): Promise<{ inventory: number; stash: number }> {
  const rows = await trx.selectFrom('items').select(['equip_slot', 'stash']).where('hero_id', '=', heroId).execute();
  return {
    inventory: rows.filter((r) => r.equip_slot === null && r.stash === 0).length,
    stash: rows.filter((r) => r.stash === 1).length,
  };
}

export async function equip(ctx: GameCtx, accountId: number, heroId: number, itemId: number, slot?: EquipSlot): Promise<void> {
  const h = await ownHero(ctx, accountId, heroId, true);
  await ctx.db.transaction().execute(async (trx) => {
    const it = await getItem(trx, heroId, itemId);
    if (h.level < itemRequirement(ctx.content.balance, it.ilvl)) fail('REQUIREMENT_NOT_MET', `Benötigt Heldenstufe ${itemRequirement(ctx.content.balance, it.ilvl)}.`);
    let target: EquipSlot;
    if (it.slot === 'waffe') {
      target = slot && slot.startsWith('Waffe_') ? slot : (h.active_set === 'A' ? 'Waffe_A' : 'Waffe_B');
    } else {
      target = EQUIP_SLOT_OF[it.slot as keyof typeof EQUIP_SLOT_OF];
      if (slot && slot !== target) fail('BAD_REQUEST', 'Dieser Gegenstand passt nicht in diesen Platz.');
    }
    if (it.equip_slot === target) return;
    const current = await trx.selectFrom('items').select(['id']).where('hero_id', '=', heroId).where('equip_slot', '=', target).executeTakeFirst();
    const from = it.equip_slot;
    await trx.updateTable('items').set({ equip_slot: null }).where('id', '=', it.id).execute();
    if (current) {
      // Tausch zwischen Satz A und B oder zurück ins Inventar
      await trx.updateTable('items').set({ equip_slot: from && from.startsWith('Waffe_') ? from : null, stash: 0 }).where('id', '=', current.id).execute();
    }
    await trx.updateTable('items').set({ equip_slot: target, stash: 0 }).where('id', '=', it.id).execute();
    const c = await counts(trx, heroId);
    if (c.inventory > ctx.content.balance.items.inventory) fail('INVENTORY_FULL', 'Das Inventar ist voll.');
  });
}

export async function unequip(ctx: GameCtx, accountId: number, heroId: number, slot: EquipSlot): Promise<void> {
  await ownHero(ctx, accountId, heroId, true);
  await ctx.db.transaction().execute(async (trx) => {
    const c = await counts(trx, heroId);
    if (c.inventory >= ctx.content.balance.items.inventory) fail('INVENTORY_FULL', 'Das Inventar ist voll.');
    await trx.updateTable('items').set({ equip_slot: null }).where('hero_id', '=', heroId).where('equip_slot', '=', slot).execute();
  });
}

export async function sell(ctx: GameCtx, accountId: number, heroId: number, itemIds: number[], confirm: boolean): Promise<{ sold: number[]; gold: number }> {
  await ownHero(ctx, accountId, heroId, true);
  return ctx.db.transaction().execute(async (trx) => {
    let gold = 0;
    for (const id of itemIds) {
      const it = await getItem(trx, heroId, id);
      if (it.locked) fail('CONFLICT', `${it.name} ist gesperrt.`);
      const enchanted = parseJson<unknown[]>(it.enchants, []).length > 0;
      if ((it.equip_slot || enchanted) && !confirm) fail('CONFLICT', `${it.name} ist angelegt oder verzaubert. Verkauf bitte bestätigen.`);
      gold += sellPrice(ctx.content.balance, it.budget);
      await trx.deleteFrom('items').where('id', '=', id).execute();
    }
    await trx.updateTable('heroes').set((eb) => ({ gold: eb('gold', '+', gold) })).where('id', '=', heroId).execute();
    return { sold: itemIds, gold };
  });
}

export async function lockItem(ctx: GameCtx, accountId: number, heroId: number, itemId: number, locked: boolean): Promise<void> {
  await ownHero(ctx, accountId, heroId, false);
  await getItem(ctx.db, heroId, itemId);
  await ctx.db.updateTable('items').set({ locked: locked ? 1 : 0 }).where('id', '=', itemId).execute();
}

export async function stashItem(ctx: GameCtx, accountId: number, heroId: number, itemId: number, stash: boolean): Promise<void> {
  await ownHero(ctx, accountId, heroId, true);
  await ctx.db.transaction().execute(async (trx) => {
    const it = await getItem(trx, heroId, itemId);
    if (it.equip_slot) fail('CONFLICT', 'Angelegte Gegenstände können nicht in die Truhe.');
    const c = await counts(trx, heroId);
    const b = ctx.content.balance.items;
    if (stash && !it.stash && c.stash >= b.stash) fail('INVENTORY_FULL', 'Die Überlauftruhe ist voll.');
    if (!stash && it.stash && c.inventory >= b.inventory) fail('INVENTORY_FULL', 'Das Inventar ist voll.');
    await trx.updateTable('items').set({ stash: stash ? 1 : 0 }).where('id', '=', itemId).execute();
  });
}

/**
 * Beute ablegen (8.9): erst Inventar, dann Überlauftruhe. Ist beides voll, wird der Gegenstand mit dem
 * niedrigsten Budget verkauft (nicht gesperrt, verzaubert, legendär oder angelegt); sonst der neue.
 */
export async function grantItem(ctx: GameCtx, trx: Tx, heroId: number, it: ItemData): Promise<{ itemId: number | null; autoSold: { name: string; gold: number } | null }> {
  const b = ctx.content.balance.items;
  const c = await counts(trx, heroId);
  const now = ctx.now();
  if (c.inventory < b.inventory) return { itemId: await insertItem(trx, heroId, it, now), autoSold: null };
  if (c.stash < b.stash) return { itemId: await insertItem(trx, heroId, it, now, null, true), autoSold: null };
  const candidates = (await trx.selectFrom('items').selectAll().where('hero_id', '=', heroId).where('equip_slot', 'is', null).execute())
    .filter((r) => !r.locked && r.rarity !== 'legendaer' && parseJson<unknown[]>(r.enchants, []).length === 0)
    .sort((a, z) => a.budget - z.budget || a.id - z.id);
  const victim = candidates[0];
  if (!victim || victim.budget >= it.budget) {
    const gold = sellPrice(ctx.content.balance, it.budget);
    await trx.updateTable('heroes').set((eb) => ({ gold: eb('gold', '+', gold) })).where('id', '=', heroId).execute();
    return { itemId: null, autoSold: { name: it.name, gold } };
  }
  const gold = sellPrice(ctx.content.balance, victim.budget);
  await trx.deleteFrom('items').where('id', '=', victim.id).execute();
  await trx.updateTable('heroes').set((eb) => ({ gold: eb('gold', '+', gold) })).where('id', '=', heroId).execute();
  return { itemId: await insertItem(trx, heroId, it, now, null, victim.stash === 1), autoSold: { name: victim.name, gold } };
}

async function spendGold(trx: Tx, heroId: number, gold: number): Promise<void> {
  const h = await getHeroRow(trx, heroId);
  if (h.gold < gold) fail('NOT_ENOUGH_GOLD', `Benötigt ${gold} Gold.`);
  await trx.updateTable('heroes').set({ gold: h.gold - gold }).where('id', '=', heroId).execute();
}

// ---------- Juwelier (7.3, 7.4) ----------

export async function socketGem(ctx: GameCtx, accountId: number, heroId: number, gemId: number, socket: number): Promise<void> {
  const h = await ownHero(ctx, accountId, heroId, true);
  if (socket >= freeGemSlots(ctx.content.gems, h.level)) {
    fail('REQUIREMENT_NOT_MET', `Slot frei ab Stufe ${ctx.content.gems.slotUnlockLevels[socket]}.`);
  }
  await ctx.db.transaction().execute(async (trx) => {
    const g = await trx.selectFrom('gems').selectAll().where('id', '=', gemId).executeTakeFirst();
    if (!g || g.hero_id !== heroId) fail('NOT_FOUND', 'Gem nicht gefunden.');
    const old = g.socket;
    if (old === socket) return;
    const occupant = await trx.selectFrom('gems').select('id').where('hero_id', '=', heroId).where('socket', '=', socket).executeTakeFirst();
    await trx.updateTable('gems').set({ socket: null }).where('id', '=', gemId).execute();
    // Ein Gem im Ziel-Slot wandert dorthin, wo das neue herkam (anderer Slot oder Beutel)
    if (occupant) await trx.updateTable('gems').set({ socket: old }).where('id', '=', occupant.id).execute();
    await trx.updateTable('gems').set({ socket }).where('id', '=', gemId).execute();
  });
}

export async function unsocketGem(ctx: GameCtx, accountId: number, heroId: number, socket: number): Promise<void> {
  await ownHero(ctx, accountId, heroId, true);
  await ctx.db.updateTable('gems').set({ socket: null }).where('hero_id', '=', heroId).where('socket', '=', socket).execute();
}

export async function combineGems(ctx: GameCtx, accountId: number, heroId: number, kind: GemId, tier: number): Promise<GemDTO> {
  await ownHero(ctx, accountId, heroId, true);
  if (tier >= ctx.content.gems.tierPoints.length) fail('BAD_REQUEST', 'Stufe V lässt sich nicht weiter kombinieren.');
  return ctx.db.transaction().execute(async (trx) => {
    const bag = await trx.selectFrom('gems').select('id').where('hero_id', '=', heroId).where('kind', '=', kind)
      .where('tier', '=', tier).where('socket', 'is', null).orderBy('id').limit(3).execute();
    if (bag.length < 3) fail('CONFLICT', 'Dafür braucht es 3 gleiche Gems im Beutel.');
    await spendGold(trx, heroId, gemCombineCost(ctx.content.gems, tier));
    await trx.deleteFrom('gems').where('id', 'in', bag.map((b) => b.id)).execute();
    const r = await trx.insertInto('gems').values({ hero_id: heroId, kind, tier: tier + 1, socket: null }).returning('id').executeTakeFirstOrThrow();
    return { id: r.id, kind, tier: tier + 1, socket: null };
  });
}

export async function swapGem(ctx: GameCtx, accountId: number, heroId: number, gemId: number, kind: GemId): Promise<void> {
  await ownHero(ctx, accountId, heroId, true);
  await ctx.db.transaction().execute(async (trx) => {
    const g = await trx.selectFrom('gems').selectAll().where('id', '=', gemId).executeTakeFirst();
    if (!g || g.hero_id !== heroId) fail('NOT_FOUND', 'Gem nicht gefunden.');
    if (g.kind === kind) fail('BAD_REQUEST', 'Das Gem hat diese Art bereits.');
    await spendGold(trx, heroId, gemSwapCost(ctx.content.gems, g.tier));
    await trx.updateTable('gems').set({ kind }).where('id', '=', gemId).execute();
  });
}

// ---------- Schmiede (8.4, 8.7) ----------

export async function changeElement(ctx: GameCtx, accountId: number, heroId: number, itemId: number, element: ElementId): Promise<void> {
  await ownHero(ctx, accountId, heroId, true);
  await ctx.db.transaction().execute(async (trx) => {
    const it = await getItem(trx, heroId, itemId);
    if (it.slot !== 'waffe') fail('BAD_REQUEST', 'Nur Waffen tragen ein Element.');
    if (it.rarity === 'legendaer') fail('BAD_REQUEST', 'Legendäre Waffen behalten ihr Element.');
    if (it.element === element) fail('BAD_REQUEST', 'Die Waffe hat dieses Element bereits.');
    await spendGold(trx, heroId, elementChangeCost(ctx.content.balance, it.ilvl));
    await trx.updateTable('items').set({ element }).where('id', '=', itemId).execute();
  });
}

export async function transferLevel(ctx: GameCtx, accountId: number, heroId: number, fromId: number, toId: number): Promise<void> {
  await ownHero(ctx, accountId, heroId, true);
  if (fromId === toId) fail('BAD_REQUEST', 'Quelle und Ziel müssen verschieden sein.');
  await ctx.db.transaction().execute(async (trx) => {
    const from = await getItem(trx, heroId, fromId);
    const to = await getItem(trx, heroId, toId);
    if (from.slot !== 'waffe' || to.slot !== 'waffe') fail('BAD_REQUEST', 'Übertragen geht nur zwischen Waffen.');
    if (from.locked) fail('CONFLICT', 'Die alte Waffe ist gesperrt.');
    if (from.weapon_level <= to.weapon_level) fail('BAD_REQUEST', 'Die alte Waffe hat keine höhere Waffenstufe.');
    await spendGold(trx, heroId, transferCost(ctx.content.balance, from.weapon_level));
    await trx.updateTable('items').set({ weapon_level: from.weapon_level, weapon_xp: from.weapon_xp }).where('id', '=', toId).execute();
    await trx.deleteFrom('items').where('id', '=', fromId).execute();
  });
}

export async function enchant(
  ctx: GameCtx, accountId: number, heroId: number, itemId: number, line: number, action: 'rank' | 'type', type?: string,
): Promise<void> {
  await ownHero(ctx, accountId, heroId, true);
  const e = ctx.content.balance.weapon.enchant;
  await ctx.db.transaction().execute(async (trx) => {
    const it = await getItem(trx, heroId, itemId);
    if (it.slot !== 'waffe') fail('BAD_REQUEST', 'Nur Waffen lassen sich verzaubern.');
    if (it.weapon_level < ctx.content.balance.weapon.maxLevel) fail('REQUIREMENT_NOT_MET', 'Verzaubern ab Waffenstufe 10.');
    const lines = parseJson<{ id: string; rank: number }[]>(it.enchants, []);
    const cur = lines[line];
    if (action === 'type') {
      if (!type || !ctx.content.enchants.some((x) => x.id === type)) fail('BAD_REQUEST', 'Unbekannte Verzauberung.');
      if (lines.some((l, i) => i !== line && l.id === type)) fail('CONFLICT', 'Jede Art darf nur einmal vorkommen.');
      if (cur && cur.id === type) fail('BAD_REQUEST', 'Diese Zeile hat die Art bereits.');
      if (cur) await spendGold(trx, heroId, e.changeTypeGold);
      if (line > lines.length) fail('BAD_REQUEST', 'Bitte die Zeilen der Reihe nach belegen.');
      lines[line] = { id: type, rank: 0 };
    } else {
      if (!cur) fail('BAD_REQUEST', 'Zuerst eine Art wählen.');
      if (cur.rank >= e.maxRank) fail('CONFLICT', 'Höchster Rang erreicht.');
      await spendGold(trx, heroId, enchantRankCost(ctx.content.balance, cur.rank + 1));
      cur.rank++;
    }
    if (lines.length > e.lines) fail('BAD_REQUEST', `Höchstens ${e.lines} Zeilen.`);
    await trx.updateTable('items').set({ enchants: JSON.stringify(lines) }).where('id', '=', itemId).execute();
  });
}

// ---------- Archiv (7.6) ----------

export async function upgradeArtifact(ctx: GameCtx, accountId: number, heroId: number, slot: ArtifactSlot): Promise<void> {
  const h = await ownHero(ctx, accountId, heroId, true);
  const def = ctx.content.artifactById.get(`${h.class}_${slot}`);
  if (!def) fail('NOT_FOUND', 'Artefakt nicht gefunden.');
  await ctx.db.transaction().execute(async (trx) => {
    const a = await trx.selectFrom('artifacts').selectAll().where('hero_id', '=', heroId).where('slot', '=', slot).executeTakeFirst();
    if (!a || a.rank < 1) fail('REQUIREMENT_NOT_MET', `Freigeschaltet durch ${ctx.content.bossById[def.unlockBoss].name}.`);
    if (a.rank >= def.rankPoints.length) fail('CONFLICT', 'Höchster Rang erreicht.');
    const cost = def.rankCost[a.rank] ?? 0;
    const hero = await getHeroRow(trx, heroId);
    if (hero.splinters < cost) fail('NOT_ENOUGH_SPLINTERS', `Benötigt ${cost} Artefaktsplitter.`);
    await trx.updateTable('heroes').set({ splinters: hero.splinters - cost }).where('id', '=', heroId).execute();
    await trx.updateTable('artifacts').set({ rank: a.rank + 1 }).where('hero_id', '=', heroId).where('slot', '=', slot).execute();
  });
}

export async function markStorySeen(ctx: GameCtx, heroId: number, textId: string): Promise<void> {
  await ctx.db.insertInto('story_seen').values({ hero_id: heroId, text_id: textId }).onConflict((oc) => oc.doNothing()).execute();
}

export { EQUIP_SLOTS };
