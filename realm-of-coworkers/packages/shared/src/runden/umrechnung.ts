// Umrechnung der vorhandenen Inhaltsdaten auf Runden (ENTWURF-rundenkampf.md, Abschnitt 2).
// Die Dateien in packages/content bleiben unverändert; sie werden hier gelesen, nicht umgeschrieben.
import type { Content } from '../content/loader';
import type { SkillDef } from '../content/schemas';

/** Millisekunden je Sekunde; reine Einheitenumrechnung, keine Spielzahl. */
export const MS_PRO_S = 1000;

/** Wie viele Runden eine Zeitangabe in Sekunden entspricht; mindestens eine. */
export function rundenAusSekunden(c: Content, sekunden: number): number {
  if (sekunden <= 0) return 0;
  return Math.max(1, Math.round(sekunden / c.runden.rundeSekunden));
}

/** Wie viele Runden eine Zeitangabe in Millisekunden entspricht; mindestens eine. */
export function rundenAusMs(c: Content, ms: number): number {
  if (ms <= 0) return 0;
  return Math.max(1, Math.round(ms / (c.runden.rundeSekunden * MS_PRO_S)));
}

/**
 * Wen eine Wirkung trifft. Ersetzt die Radien in Pixeln, die ohne Bewegung keinen Sinn mehr ergeben.
 * Die Zuordnung steht in ENTWURF-rundenkampf.md, Abschnitt 2.2.
 */
export type Zielbild =
  | 'einGegner'
  | 'alleGegner'
  | 'gegnerVorn'
  | 'zielUndReihe'
  | 'gegnerReihe'
  | 'selbst'
  | 'party'
  | 'schwaechste';

/** Was der Spieler auswählt, bevor er die Fähigkeit einsetzt. */
export type Auswahl = 'gegner' | 'gegnerReihe' | 'verbuendeter' | 'nichts';

export function auswahlDerFaehigkeit(s: SkillDef): Auswahl {
  if (s.target === 'ground') return 'gegnerReihe';
  if (s.target === 'nearest' || s.target === 'focus') return 'gegner';
  if (s.target === 'lowestAlly') return 'verbuendeter';
  return 'nichts';
}

/** Zielbild einer einzelnen Wirkung einer Fähigkeit. */
export function zielbildDerWirkung(c: Content, s: SkillDef, w: { to?: string; radiusPx?: number }): Zielbild {
  const to = w.to;
  if (to === 'allies') return 'party';
  if (to === 'lowestAllies') return 'schwaechste';
  if (to === 'self') return 'selbst';
  if (to === 'enemiesAroundSelf') {
    return (w.radiusPx ?? 0) >= c.runden.zielbild.alleGegnerAbRadiusPx ? 'alleGegner' : 'gegnerVorn';
  }
  if (to === 'enemiesAroundTarget') return 'zielUndReihe';
  // Ohne eigene Angabe gilt das Ziel der Fähigkeit
  if (s.target === 'ground') return 'gegnerReihe';
  if (s.target === 'self') return 'selbst';
  if (s.target === 'lowestAlly') return 'schwaechste';
  return 'einGegner';
}

/** Abklingzeit einer Fähigkeit in Runden. Ultimates laufen über Energie und haben keine (ENTWURF 1.5). */
export function abklingRunden(c: Content, s: SkillDef): number {
  if (s.slot === 'ult' || s.slot === 'passive' || s.slot === 'auto') return 0;
  return rundenAusSekunden(c, s.cooldownS);
}
