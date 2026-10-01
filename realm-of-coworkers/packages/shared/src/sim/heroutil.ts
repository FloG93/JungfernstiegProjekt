// Kleine Hilfen rund um Helden, die Handler und Fähigkeiten gemeinsam nutzen.
import type { ElementId } from '../content/ids';
import type { SkillDef } from '../content/schemas';
import { rangeBonus } from './effstats';
import type { Unit, World } from './types';

/** Element der aktiven Waffe (4.4). */
export function weaponElement(u: Unit): ElementId {
  const h = u.hero;
  return h ? h.sets[h.activeSet].element : 'physisch';
}

/** Reichweite einer Fähigkeit: eigene Angabe oder Reichweite der Klasse, plus Buffs (Adlerauge). */
export function skillRange(w: World, u: Unit, def: SkillDef): number {
  const base = def.rangePx ?? (u.hero ? w.content.classById[u.hero.classId].rangePx : 0);
  return base + rangeBonus(u);
}

export function numParam(params: Record<string, number | string | boolean>, key: string): number {
  const v = params[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  throw new Error(`Parameter ${key} fehlt oder ist keine Zahl`);
}

export function strParam(params: Record<string, number | string | boolean>, key: string): string {
  const v = params[key];
  if (typeof v !== 'string') throw new Error(`Parameter ${key} fehlt oder ist kein Text`);
  return v;
}
