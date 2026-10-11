// Rundenbasierter Kampf (ENTWURF-rundenkampf.md): Datenmodell.
// Die Namen folgen der Spezifikation (Runde, Reihe, Bedrohung), weil der Kampf dort auf Deutsch beschrieben ist.
// Alles hier ist deterministisch: kein Date.now, kein Math.random, Zufall nur über den Run-Zufallsgenerator.
import type { ClassId, ElementId, StatusId } from '../content/ids';
import type { Content } from '../content/loader';
import type { Rng } from '../rng';
import type { StatBlock } from '../stats';

export type Seite = 'held' | 'gegner';
export type Reihe = 'vorn' | 'hinten';
export type Art = 'held' | 'gegner' | 'boss';

/** Ein Statuseffekt mit Restdauer in Runden; 0 Runden heißt dauerhaft (Passive). */
export interface StatusInst {
  id: StatusId;
  runden: number;
  dauerhaft: boolean;
  stapel: number;
  /** Zusatzwert laut Daten, etwa der Giftkoeffizient je Sekunde. */
  wert?: number;
  /** Wer den Effekt gesetzt hat (für Schaden über Zeit). */
  quelleId?: number;
  mods?: { stat: string; mult?: number; add?: number }[];
  /** Name für die Anzeige, falls der Effekt unter eigenem Namen läuft. */
  anzeige?: string;
}

export interface Schild {
  menge: number;
  runden: number;
}

export interface Figur {
  id: number;
  seite: Seite;
  art: Art;
  reihe: Reihe;
  name: string;
  /** Helden: Klasse. Gegner und Bosse: Typ bzw. Boss-ID. */
  klasse?: ClassId;
  typ?: string;
  /** Zugehöriger Spieler, damit der Server Eingaben zuordnen kann. */
  spielerId?: string;
  /** Helden-ID der Datenbank. */
  dbId?: number;
  stufe: number;
  lp: number;
  maxLp: number;
  grundwerte: StatBlock;
  element: ElementId;
  tot: boolean;
  energie: number;
  /** Gilt bis zur nächsten eigenen Handlung. */
  verteidigt: boolean;
  status: StatusInst[];
  schilde: Schild[];
  /** Fähigkeit auf Abklingzeit: Restrunden. */
  abkling: Record<string, number>;
  /** Nur Gegner: Bedrohung je Held. */
  bedrohung: Map<number, number>;
  /** Spott zwingt bis einschließlich dieser Runde auf dieses Ziel. */
  spottBisRunde: number;
  spottVon: number | null;
  zielId: number | null;
  traenke: number;
  trankAbkling: number;
  /** Helden: Einzelkämpfer-Multiplikator auf die Kraft (4.4). */
  soloMult: number;
  /** Helden: Auto-Cast je Fähigkeit und Auto-Trank (4.6). */
  autocast: Record<string, boolean>;
  autoTrank: boolean;
  /** Gegner: Schaden einer Handlung vor Mitigation. */
  schadenJeAktion: number;
  /** Gegner: fester Minderungsanteil gegen physisch bzw. magisch. */
  rueMit: number;
  resMit: number;
  /** Gegner: greift aus der hinteren Reihe an und ignoriert die Reihenregel. */
  fernkampf: boolean;
  /** Gegner: Elite mit Affix. */
  elite: boolean;
  /** Angriffsstufe für die Minderung beim Ziel (5.6). */
  angriffsstufe: number;
}

export type Aktion =
  | { k: 'angriff'; ziel: number }
  | { k: 'faehigkeit'; id: string; ziel?: number; reihe?: Reihe }
  | { k: 'trank' }
  | { k: 'verteidigen' }
  | { k: 'reihe' };

export type Ereignis =
  | { e: 'rundeStart'; runde: number; reihenfolge: number[] }
  | { e: 'aktion'; von: number; art: Aktion['k']; id?: string; ziele: number[] }
  | { e: 'schaden'; von: number; an: number; menge: number; krit?: boolean; element?: ElementId; absorbiert?: number; dot?: boolean }
  | { e: 'heilung'; von: number; an: number; menge: number }
  | { e: 'schild'; an: number; menge: number }
  | { e: 'status'; an: number; id: StatusId; runden: number; weg?: boolean }
  | { e: 'energie'; id: number; wert: number }
  | { e: 'reihe'; id: number; reihe: Reihe }
  | { e: 'nachruecken'; id: number; typ: string; reihe: Reihe }
  | { e: 'verfehlt'; von: number; grund: 'tot' | 'blockiert' | 'keinZiel' | 'nichtBereit' }
  | { e: 'tod'; id: number }
  | { e: 'rundeEnde'; runde: number }
  | { e: 'kampfEnde'; ergebnis: 'sieg' | 'niederlage'; runden: number };

export type Ergebnis = 'laeuft' | 'sieg' | 'niederlage';

export interface Kampf {
  content: Content;
  rng: Rng;
  runde: number;
  figuren: Figur[];
  /** Reihenfolge der laufenden Runde als Figuren-IDs. */
  reihenfolge: number[];
  ereignisse: Ereignis[];
  ergebnis: Ergebnis;
  /** Gegen Bosse beginnt die Energie höher (ENTWURF 1.5). */
  gegenBoss: boolean;
  /** Kapitel der Stage; bestimmt das Referenzleben für Schaden über Zeit (13.3). */
  kapitel: number;
  /** Gegner, die noch warten, weil das Feld voll ist; sie rücken nach, sobald ein Platz frei wird. */
  reserve: Figur[];
  naechsteId: number;
}

export function figur(k: Kampf, id: number | null | undefined): Figur | undefined {
  return id === null || id === undefined ? undefined : k.figuren.find((f) => f.id === id);
}

export function lebende(k: Kampf, seite: Seite): Figur[] {
  return k.figuren.filter((f) => f.seite === seite && !f.tot);
}

export function gegnerSeite(seite: Seite): Seite {
  return seite === 'held' ? 'gegner' : 'held';
}

export function melde(k: Kampf, ev: Ereignis): void {
  k.ereignisse.push(ev);
}
