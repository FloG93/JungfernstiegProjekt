// Register aller Handler (15.5). Je Handler eine Datei in diesem Ordner.
import type { HandlerId } from '../../content/ids';
import type { Unit, World } from '../types';
import { barrage } from './barrage';
import { buffedDamageReduction } from './buffedDamageReduction';
import { channelSpin } from './channelSpin';
import { cleanse } from './cleanse';
import { conditionalBonus } from './conditionalBonus';
import { cooldownResetOnSwap } from './cooldownResetOnSwap';
import { groundDelayed } from './groundDelayed';
import { modifyValue } from './modifyValue';
import { overhealShield } from './overhealShield';
import { pierce } from './pierce';
import { revive } from './revive';
import { rollCooldown } from './rollCooldown';
import { taunt } from './taunt';
import { teleportBehind } from './teleportBehind';
import { trap } from './trap';
import { enemy_priest_heal } from './enemy_priest_heal';
import { enemy_bomber } from './enemy_bomber';
import { enemy_guardian_shield } from './enemy_guardian_shield';
import { enemy_cultist_orb } from './enemy_cultist_orb';
import { elite_slam } from './elite_slam';
import { affix_schild } from './affix_schild';
import { affix_rasend } from './affix_rasend';
import { affix_blutsauger } from './affix_blutsauger';
import { affix_regenerierend } from './affix_regenerierend';
import { hazard_feuersaeule } from './hazard_feuersaeule';
import { hazard_eisbrocken } from './hazard_eisbrocken';
import { hazard_blitz } from './hazard_blitz';
import { hazard_wurzel } from './hazard_wurzel';
import { hazard_lichtstrahl } from './hazard_lichtstrahl';
import { hazard_schattenzone } from './hazard_schattenzone';
import { boss_glutmantel } from './boss_glutmantel';
import { boss_eispanzer } from './boss_eispanzer';
import { boss_statische_ladung } from './boss_statische_ladung';
import { boss_steinhaut } from './boss_steinhaut';
import { boss_sonnenschild } from './boss_sonnenschild';
import { boss_schattenhuelle } from './boss_schattenhuelle';
import { sig_glutregen } from './sig_glutregen';
import { sig_frostnova } from './sig_frostnova';
import { sig_kettenblitz } from './sig_kettenblitz';
import { sig_beben } from './sig_beben';
import { sig_strahlenbuendel } from './sig_strahlenbuendel';
import { sig_stille } from './sig_stille';
import type { HandlerModule, Params } from './types';

export type { CastCtx, HandlerModule, Params } from './types';

const modules: HandlerModule[] = [
  taunt, pierce, trap, barrage, conditionalBonus, teleportBehind, channelSpin, groundDelayed, cleanse, revive,
  overhealShield, cooldownResetOnSwap, buffedDamageReduction, rollCooldown, modifyValue,
  enemy_priest_heal, enemy_bomber, enemy_guardian_shield, enemy_cultist_orb, elite_slam, affix_schild, affix_rasend, affix_blutsauger, affix_regenerierend, hazard_feuersaeule, hazard_eisbrocken, hazard_blitz, hazard_wurzel, hazard_lichtstrahl, hazard_schattenzone, boss_glutmantel, boss_eispanzer, boss_statische_ladung, boss_steinhaut, boss_sonnenschild, boss_schattenhuelle, sig_glutregen, sig_frostnova, sig_kettenblitz, sig_beben, sig_strahlenbuendel, sig_stille,
];

const registry = new Map<HandlerId, HandlerModule>();

export function registerHandlers(list: HandlerModule[]): void {
  for (const m of list) registry.set(m.id, m);
}
registerHandlers(modules);

export function getHandler(id: HandlerId): HandlerModule | undefined {
  return registry.get(id);
}

export function registeredHandlerIds(): HandlerId[] {
  return [...registry.keys()];
}

export interface PassiveHooks {
  onOverheal?: (w: World, healer: Unit, target: Unit, over: number) => void;
  onSwap?: (w: World, hero: Unit) => void;
}

/** Hooks der Passiv-Fähigkeit eines Helden, mit den (ggf. durch Artefakte geänderten) Parametern. */
export function heroPassiveHooks(w: World, u: Unit): PassiveHooks {
  const hooks: PassiveHooks = {};
  const defs = w.heroSkillDefs.get(u.id);
  if (!defs) return hooks;
  for (const def of defs.values()) {
    if (def.slot !== 'passive') continue;
    for (const e of def.effects) {
      if (e.k !== 'handler') continue;
      const m = getHandler(e.id);
      const params: Params = e.params;
      if (m?.onOverheal) hooks.onOverheal = (ww, healer, target, over) => m.onOverheal!(ww, healer, target, over, params);
      if (m?.onSwap) hooks.onSwap = (ww, hero) => m.onSwap!(ww, hero, params);
    }
  }
  return hooks;
}

/** Faktor auf Schaden, den ein Boss durch sein Passiv weniger erleidet (Steinhaut, Schattenhülle, 10.6). */
export function foeIncomingMult(w: World, dst: Unit, physical: boolean): number {
  const bossId = dst.foe?.bossId;
  if (!bossId) return 1;
  const passive = w.content.bossById[bossId].passive;
  const m = getHandler(passive.id);
  return m?.incomingMult ? m.incomingMult(passive.params, physical) : 1;
}
