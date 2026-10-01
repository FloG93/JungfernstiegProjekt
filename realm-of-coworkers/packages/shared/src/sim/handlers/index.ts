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
import type { HandlerModule, Params } from './types';

export type { CastCtx, HandlerModule, Params } from './types';

const modules: HandlerModule[] = [
  taunt, pierce, trap, barrage, conditionalBonus, teleportBehind, channelSpin, groundDelayed, cleanse, revive,
  overhealShield, cooldownResetOnSwap, buffedDamageReduction, rollCooldown, modifyValue,
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
