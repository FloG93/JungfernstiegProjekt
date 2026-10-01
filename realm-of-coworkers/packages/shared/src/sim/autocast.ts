// Auto-Cast (4.4, 15.5): feste Regel je Fähigkeit, Schalter je Fähigkeit. Auto-Trank (E-023).
import type { SkillSlot } from '../content/ids';
import type { AutoCastRule, SkillDef } from '../content/schemas';
import { doPotion } from './actions';
import { skillRange } from './heroutil';
import { castSkill, skillUsable } from './skills';
import { hasCleansableDebuff } from './status';
import type { Unit, World } from './types';
import { PERCENT, alliesOf, dist, enemiesOf, hpFrac, within } from './util';

/** Reihenfolge innerhalb eines Ticks: Vorbereitung vor Schaden (Gift vor Meucheln, Tarnung vor dem Treffer). */
export const AUTOCAST_ORDER: SkillSlot[] = ['ult', 's3', 's2', 's1', 'auto'];

export function ruleMet(w: World, u: Unit, rule: AutoCastRule, def: SkillDef): boolean {
  switch (rule.when) {
    case 'enemyInRange': {
      const r = skillRange(w, u, def);
      return enemiesOf(w, u).some((f) => dist(u, f) <= r);
    }
    case 'inCombat':
      return w.scenario.inCombat(w);
    case 'bossPresent':
      return !!w.boss && !w.boss.dead;
    case 'allyHasDebuff':
      return alliesOf(w, u).some((a) => hasCleansableDebuff(w, a));
    case 'allyDead':
      return w.units.some((a) => a.side === u.side && a.dead && !!a.hero);
    case 'enemiesNear':
      return within(u, enemiesOf(w, u), rule.radiusPx).length >= rule.count;
    case 'allyBelowPct':
      return alliesOf(w, u).some((a) => hpFrac(a) < rule.pct / PERCENT);
    case 'alliesBelowPct':
      return alliesOf(w, u).filter((a) => hpFrac(a) < rule.pct / PERCENT).length >= rule.count;
    case 'selfBelowPct':
      return hpFrac(u) < rule.pct / PERCENT;
    case 'any':
      return rule.rules.some((r) => ruleMet(w, u, r, def));
  }
}

/** Löst alle bereiten Fähigkeiten mit eingeschaltetem Auto-Cast aus. Im Autopilot nur der Automatikangriff (2.4). */
export function runAutocast(w: World, u: Unit): void {
  const h = u.hero;
  if (!h || u.dead) return;
  if (h.reviveTargetId !== null) return; // Kanalisierung (4.4)
  const autopilot = !h.connected;
  for (const slot of AUTOCAST_ORDER) {
    const sk = h.skills.find((s) => s.slot === slot);
    if (!sk) continue;
    if (slot !== 'auto' && (autopilot || !(sk.autocast || w.opts.castAllWhenReady))) continue;
    if (!skillUsable(w, u, sk)) continue;
    const rule = sk.def.autoCast?.rule;
    if (!w.opts.castAllWhenReady && rule && !ruleMet(w, u, rule, sk.def)) continue;
    castSkill(w, u, sk.def.id, { auto: true });
  }
  if (h.autoPotion && !autopilot && hpFrac(u) < w.content.engine.idle.autoPotionBelowPct / PERCENT) doPotion(w, u);
}
