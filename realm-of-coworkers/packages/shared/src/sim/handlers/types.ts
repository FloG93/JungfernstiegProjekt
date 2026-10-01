// Schnittstelle der Handler (15.5): Mechaniken außerhalb des Effekt-Schemas.
import type { HandlerId } from '../../content/ids';
import type { Attack, HazardDef, SkillDef } from '../../content/schemas';
import type { Unit, Vec, World } from '../types';

export type Params = Record<string, number | string | boolean>;

export interface CastCtx {
  w: World;
  caster: Unit;
  skill: SkillDef;
  params: Params;
  target: Unit | null;
  point: Vec | null;
  recipients: Unit[];
}

export interface HandlerModule {
  id: HandlerId;
  /** Aktive Wirkung einer Fähigkeit. */
  cast?(ctx: CastCtx): void;
  /** Passiv: Waffenwechsel (Elementarfluss). */
  onSwap?(w: World, hero: Unit, params: Params): void;
  /** Passiv: Überheilung (Gnade). */
  onOverheal?(w: World, healer: Unit, target: Unit, over: number, params: Params): void;
  /** Passiv: Abklingzeit der Ausweichrolle in Sekunden (Fährtenleser). */
  rollCooldownS?(params: Params): number;
  /** Boss-Passiv: Faktor auf erlittenen Schaden (Steinhaut, Schattenhülle). */
  incomingMult?(params: Params, physical: boolean): number;
  /** Boss-Passiv oder Gegner/Affix: Einrichtung beim Erscheinen. */
  setup?(w: World, u: Unit, params: Params): void;
  /** Boss-Passiv oder Gegner/Affix: je Tick. */
  update?(w: World, u: Unit, params: Params): void;
  /** Boss-Passiv: Beginn einer Phase (Sonnenschild). */
  onPhaseStart?(w: World, boss: Unit, phase: number, params: Params): void;
  /** Gegner: Tod (Bomber). */
  onDeath?(w: World, u: Unit, params: Params): void;
  /** Gegner: eigener Angriff statt des Standardangriffs (Kultist). Gibt true zurück, wenn er angegriffen hat. */
  attack?(w: World, u: Unit, target: Unit, params: Params): boolean;
  /** Boss: Signaturangriff (10.6). */
  signature?(w: World, boss: Unit, attack: Attack): void;
  /** Umgebungsgefahr erzeugen (9.8). */
  hazard?(w: World, def: HazardDef, x: number, y: number): void;
}
