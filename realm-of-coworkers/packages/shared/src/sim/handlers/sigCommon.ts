// Gemeinsame Hilfen der Signaturangriffe (10.6).
import type { Attack } from '../../content/schemas';
import { bossAttackAmount } from '../boss';
import { foeHit } from '../combat';
import type { Unit, World } from '../types';

export function telegraphMs(w: World, a: Attack): number {
  return a.telegraphMs ?? w.content.balance.combat.telegraphMs;
}

/** Elementarer Treffer des Bosses mit dem Anteil RefLeben des Signaturangriffs. */
export function sigHit(w: World, boss: Unit, hero: Unit, a: Attack): number {
  if (hero.dead || hero.statuses.some((s) => s.id === 'unverwundbar')) return 0;
  return foeHit(w, boss, hero, {
    amount: bossAttackAmount(w, boss, a.pctRefHp), physical: a.dmgType === 'phys', element: boss.element,
    attackerLevel: boss.foe!.level,
  });
}

export function arenaWidth(w: World): number {
  const b = w.scenario.bounds(w);
  return Number.isFinite(b.maxX - b.minX) ? b.maxX - b.minX : w.content.engine.world.viewWidthPx;
}
