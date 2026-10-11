// Mechaniken außerhalb des Effekt-Schemas (15.5): je Handler eine Datei und ein Test.
// Noch nicht umgesetzte Handler stehen in OFFEN und werden beim Einsetzen übersprungen,
// damit nichts still verschluckt wird (OPEN-054).
import type { HandlerId } from '../../content/ids';
import type { Figur, Kampf } from '../typen';
import type { Wahl } from '../ziele';
import { cleanse } from './cleanse';
import { conditionalBonus } from './conditionalBonus';
import { pierce } from './pierce';
import { revive } from './revive';
import { taunt } from './taunt';

export interface HandlerKontext {
  k: Kampf;
  von: Figur;
  ziele: Figur[];
  wahl: Wahl;
  params: Record<string, number | string | boolean>;
}

export type Handler = (ctx: HandlerKontext) => void;

const REGISTRIERT: Partial<Record<HandlerId, Handler>> = {
  taunt, pierce, conditionalBonus, cleanse, revive,
};

/** Handler, die erst mit den späteren Schritten kommen (Bosse, Stages). */
export const OFFEN: readonly string[] = [
  'groundDelayed', 'trap', 'barrage', 'teleportBehind', 'channelSpin',
  'cooldownResetOnSwap', 'rollCooldown', 'overhealShield', 'buffedDamageReduction',
];

export function handler(id: string): Handler | undefined {
  return REGISTRIERT[id as HandlerId];
}
