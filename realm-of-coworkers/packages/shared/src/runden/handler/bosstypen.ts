// Passive und Signaturangriffe der Bosse (10.6) im Rundenkampf: je Handler eine Datei und ein Test.
// Anders als Fähigkeits-Handler hängen sie am Boss und werden zu festen Zeitpunkten gerufen.
import type { Attack } from '../../content/schemas';
import type { Figur, Kampf } from '../typen';

export interface BossKontext {
  k: Kampf;
  boss: Figur;
  params: Record<string, number>;
}

export interface BossHandler {
  /** Einmal zu Kampfbeginn. */
  start?: (c: BossKontext) => void;
  /** Zu Beginn jeder Bossrunde, vor dem Angriff. */
  runde?: (c: BossKontext) => void;
  /** Zu Beginn jeder Phase, einschließlich der ersten. */
  phase?: (c: BossKontext & { phase: number }) => void;
  /** Ausführung des Signaturangriffs, eine Runde nach der Ansage. */
  signatur?: (c: BossKontext & { angriff: Attack }) => Figur[];
}

/** Zahl aus den Handler-Parametern; fehlt sie, gilt 0. */
export function zahl(params: Record<string, number>, name: string): number {
  return params[name] ?? 0;
}
