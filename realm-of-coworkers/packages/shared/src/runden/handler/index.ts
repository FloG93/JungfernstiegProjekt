// Mechaniken außerhalb des Effekt-Schemas (15.5): je Handler eine Datei und ein Test.
// Noch nicht umgesetzte Handler stehen in OFFEN und werden beim Einsetzen übersprungen,
// damit nichts still verschluckt wird (OPEN-054).
import type { HandlerId } from '../../content/ids';
import type { Figur, Kampf } from '../typen';
import type { Wahl } from '../ziele';
import type { BossHandler } from './bosstypen';
import { boss_eispanzer } from './boss_eispanzer';
import { boss_glutmantel } from './boss_glutmantel';
import { boss_schattenhuelle } from './boss_schattenhuelle';
import { boss_sonnenschild } from './boss_sonnenschild';
import { boss_statische_ladung } from './boss_statische_ladung';
import { boss_steinhaut } from './boss_steinhaut';
import { sig_beben } from './sig_beben';
import { sig_frostnova } from './sig_frostnova';
import { sig_glutregen } from './sig_glutregen';
import { sig_kettenblitz } from './sig_kettenblitz';
import { sig_stille } from './sig_stille';
import { sig_strahlenbuendel } from './sig_strahlenbuendel';
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

/** Passive und Signaturangriffe der Bosse (10.6). */
const BOSS_REGISTRIERT: Record<string, BossHandler> = {
  boss_glutmantel, boss_eispanzer, boss_statische_ladung, boss_steinhaut, boss_sonnenschild,
  boss_schattenhuelle, sig_glutregen, sig_frostnova, sig_kettenblitz, sig_beben, sig_strahlenbuendel,
  sig_stille,
};

export function bossHandler(id: string): BossHandler | undefined {
  return BOSS_REGISTRIERT[id];
}

export type { BossHandler, BossKontext } from './bosstypen';

/** Handler, die erst mit den späteren Schritten kommen (Bosse, Stages). */
export const OFFEN: readonly string[] = [
  'groundDelayed', 'trap', 'barrage', 'teleportBehind', 'channelSpin',
  'cooldownResetOnSwap', 'rollCooldown', 'overhealShield', 'buffedDamageReduction',
];

export function handler(id: string): Handler | undefined {
  return REGISTRIERT[id as HandlerId];
}
