// Belohnungen eines Runs anrechnen (2.5, 8.4, 10.9, 12): sofort und in einer Transaktion.
import { applyWeaponXp, applyXp, bossTimerMs, weaponXpShare } from '@aethra/shared';
import type { ArtifactSlot, BossId, Content, GemDrop, ItemDTO, ItemData } from '@aethra/shared';
import { getHeroRow, grantItem, itemDto } from './heroes';
import type { GameCtx } from './heroes';

export interface RewardInput {
  xp?: number;
  gold?: number;
  splinters?: number;
  items?: ItemData[];
  gems?: GemDrop[];
  artifactUnlock?: ArtifactSlot | null;
}

export interface RewardResult {
  level: number;
  levelUps: number[];
  xpGained: number;
  gold: number;
  weaponLevelUps: number[];
  weaponXp: number;
  items: ItemDTO[];
  autoSold: { name: string; gold: number }[];
  gems: GemDrop[];
  splinters: number;
  artifactUnlocked: ArtifactSlot | null;
}

/** Schreibt Belohnungen für einen Helden. `activeSet` bestimmt die Waffe, die Waffen-XP erhält (8.4). */
export async function grantRewards(ctx: GameCtx, heroId: number, r: RewardInput, activeSet?: 'A' | 'B'): Promise<RewardResult> {
  const c: Content = ctx.content;
  return ctx.db.transaction().execute(async (trx) => {
    const h = await getHeroRow(trx, heroId);
    const xpRaw = Math.max(0, Math.round(r.xp ?? 0));
    const xp = applyXp(c, h.level, h.xp, xpRaw);
    const gold = Math.max(0, Math.round(r.gold ?? 0));
    const out: RewardResult = {
      level: xp.level, levelUps: xp.levelUps, xpGained: xp.gained, gold, weaponLevelUps: [], weaponXp: 0, items: [],
      autoSold: [], gems: r.gems ?? [], splinters: r.splinters ?? 0, artifactUnlocked: null,
    };
    await trx.updateTable('heroes').set({
      level: xp.level, xp: xp.xp, gold: h.gold + gold, splinters: h.splinters + (r.splinters ?? 0),
    }).where('id', '=', heroId).execute();
    // Waffen-XP: 50 % der Helden-XP, ab Stufe 30 100 % (8.4); nur die aktive Waffe
    const set = activeSet ?? h.active_set;
    const weapon = await trx.selectFrom('items').selectAll().where('hero_id', '=', heroId)
      .where('equip_slot', '=', set === 'A' ? 'Waffe_A' : 'Waffe_B').executeTakeFirst();
    if (weapon && xpRaw > 0) {
      const gain = Math.round(xpRaw * weaponXpShare(c, h.level));
      const wx = applyWeaponXp(c, weapon.weapon_level, weapon.weapon_xp, gain);
      for (let l = weapon.weapon_level + 1; l <= wx.level; l++) out.weaponLevelUps.push(l);
      out.weaponXp = gain;
      await trx.updateTable('items').set({ weapon_level: wx.level, weapon_xp: Math.round(wx.xp) }).where('id', '=', weapon.id).execute();
    }
    for (const it of r.items ?? []) {
      const g = await grantItem(ctx, trx, heroId, it);
      if (g.autoSold) out.autoSold.push(g.autoSold);
      if (g.itemId !== null) {
        const row = await trx.selectFrom('items').selectAll().where('id', '=', g.itemId).executeTakeFirstOrThrow();
        out.items.push(itemDto(c, row));
      }
    }
    for (const g of r.gems ?? []) {
      await trx.insertInto('gems').values({ hero_id: heroId, kind: g.kind, tier: g.tier, socket: null }).execute();
    }
    if (r.artifactUnlock) {
      const exists = await trx.selectFrom('artifacts').select('rank').where('hero_id', '=', heroId).where('slot', '=', r.artifactUnlock).executeTakeFirst();
      if (!exists) {
        await trx.insertInto('artifacts').values({ hero_id: heroId, slot: r.artifactUnlock, rank: 1 }).execute();
        out.artifactUnlocked = r.artifactUnlock;
      }
    }
    return out;
  });
}

/** Stage abgeschlossen: Eintrag in stage_progress (3.4, 15.1). */
export async function recordStageClear(ctx: GameCtx, heroId: number, stage: number, timeMs: number): Promise<void> {
  const row = await ctx.db.selectFrom('stage_progress').selectAll().where('hero_id', '=', heroId).where('stage', '=', stage).executeTakeFirst();
  if (!row) {
    await ctx.db.insertInto('stage_progress').values({ hero_id: heroId, stage, clears: 1, best_time_ms: timeMs }).execute();
    return;
  }
  await ctx.db.updateTable('stage_progress').set({
    clears: row.clears + 1, best_time_ms: row.best_time_ms === null ? timeMs : Math.min(row.best_time_ms, timeMs),
  }).where('hero_id', '=', heroId).where('stage', '=', stage).execute();
}

export async function hasCleared(ctx: GameCtx, heroId: number, stage: number): Promise<boolean> {
  const row = await ctx.db.selectFrom('stage_progress').select('clears').where('hero_id', '=', heroId).where('stage', '=', stage).executeTakeFirst();
  return !!row && row.clears > 0;
}

export interface BossEligibility {
  first: boolean;
  /** Beute-berechtigt: erster Sieg oder Timer abgelaufen (10.9). Sonst Helfer-Modus. */
  eligible: boolean;
  kampfstufe: number;
  readyAt: number | null;
}

export async function bossEligibility(ctx: GameCtx, heroId: number, bossId: BossId): Promise<BossEligibility> {
  const row = await ctx.db.selectFrom('boss_state').selectAll().where('hero_id', '=', heroId).where('boss_id', '=', bossId).executeTakeFirst();
  if (!row?.first_kill_at) return { first: true, eligible: true, kampfstufe: 0, readyAt: null };
  const chapter = ctx.content.bossById[bossId].chapter;
  const readyAt = (row.last_kill_at ?? 0) + bossTimerMs(ctx.content, chapter, ctx.bossTimerScale);
  return { first: false, eligible: ctx.now() >= readyAt, kampfstufe: row.kampfstufe, readyAt };
}

/** Sieg eines beute-berechtigten Helden: Timer starten, Kampfstufe bei Wiederholung +1 (10.9). */
export async function recordBossKill(ctx: GameCtx, heroId: number, bossId: BossId, first: boolean): Promise<number> {
  const now = ctx.now();
  const max = ctx.content.balance.boss.kampfstufeMax;
  const row = await ctx.db.selectFrom('boss_state').selectAll().where('hero_id', '=', heroId).where('boss_id', '=', bossId).executeTakeFirst();
  if (!row) {
    await ctx.db.insertInto('boss_state').values({ hero_id: heroId, boss_id: bossId, first_kill_at: now, last_kill_at: now, kampfstufe: 0 }).execute();
    return 0;
  }
  const k = first ? 0 : Math.min(max, row.kampfstufe + 1);
  await ctx.db.updateTable('boss_state').set({
    first_kill_at: row.first_kill_at ?? now, last_kill_at: now, kampfstufe: k,
  }).where('hero_id', '=', heroId).where('boss_id', '=', bossId).execute();
  return k;
}
