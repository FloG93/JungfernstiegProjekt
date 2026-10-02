// Angaben eines Helden für Party, Online-Liste und Start (3.4, 10.9, 11.1). Zwischengespeichert, neu geladen nach Änderungen.
import { STAGE_COUNT, bossTimerMs, lateJoinerAllowed, unlockedStages } from '@aethra/shared';
import type { BossId, ClassId, Content, ElementId, StageDef } from '@aethra/shared';
import { getHeroRow, parseJson } from '../game/heroes';
import type { GameCtx } from '../game/heroes';

export interface BossTimer {
  kampfstufe: number;
  readyAt: number;
}

export interface HeroInfo {
  heroId: number;
  accountId: number;
  name: string;
  classId: ClassId;
  level: number;
  element: ElementId;
  cleared: Set<number>;
  unlocked: Set<number>;
  /** Nur Bosse mit erstem Sieg; ohne Eintrag ist der nächste Sieg ein erster Sieg. */
  bosses: Map<BossId, BossTimer>;
  /** Einstellung Auto-Weiter des Helden (E-023), gilt für eine neue Party dieses Anführers. */
  autoContinue: boolean;
}

export async function loadHeroInfo(ctx: GameCtx, heroId: number): Promise<HeroInfo> {
  const h = await getHeroRow(ctx.db, heroId);
  const weapons = await ctx.db.selectFrom('items').select(['equip_slot', 'element']).where('hero_id', '=', heroId)
    .where('equip_slot', 'in', ['Waffe_A', 'Waffe_B']).execute();
  const active = weapons.find((x) => x.equip_slot === (h.active_set === 'A' ? 'Waffe_A' : 'Waffe_B')) ?? weapons[0];
  const prog = await ctx.db.selectFrom('stage_progress').select(['stage', 'clears']).where('hero_id', '=', heroId).execute();
  const cleared = new Set(prog.filter((p) => p.clears > 0).map((p) => p.stage));
  const rows = await ctx.db.selectFrom('boss_state').selectAll().where('hero_id', '=', heroId).execute();
  const bosses = new Map<BossId, BossTimer>();
  for (const r of rows) {
    if (!r.first_kill_at) continue;
    const id = r.boss_id as BossId;
    const chapter = ctx.content.bossById[id].chapter;
    bosses.set(id, { kampfstufe: r.kampfstufe, readyAt: (r.last_kill_at ?? 0) + bossTimerMs(ctx.content, chapter, ctx.bossTimerScale) });
  }
  return {
    heroId, accountId: h.account_id, name: h.name, classId: h.class as ClassId, level: h.level,
    element: (active?.element as ElementId | null | undefined) ?? 'physisch',
    cleared, unlocked: unlockedStages(cleared, STAGE_COUNT), bosses,
    autoContinue: parseJson<{ autoContinue?: boolean }>(h.settings, {}).autoContinue ?? false,
  };
}

/** Stage betreten (3.4): frei für den Helden oder Nachzügler-Regel, wenn ein Mitglied sie frei hat. */
export function stageAllowed(content: Content, info: HeroInfo, def: StageDef, unlockedByAnyone: boolean): boolean {
  if (info.unlocked.has(def.stage)) return true;
  return unlockedByAnyone && lateJoinerAllowed(content, info.level, def);
}

export interface BossStatus {
  first: boolean;
  /** Beute-berechtigt: erster Sieg oder Timer abgelaufen (10.9), sonst Helfer. */
  eligible: boolean;
  kampfstufe: number;
  readyAt: number | null;
}

export function bossStatus(info: HeroInfo, bossId: BossId, now: number): BossStatus {
  const b = info.bosses.get(bossId);
  if (!b) return { first: true, eligible: true, kampfstufe: 0, readyAt: null };
  return { first: false, eligible: now >= b.readyAt, kampfstufe: b.kampfstufe, readyAt: b.readyAt };
}
