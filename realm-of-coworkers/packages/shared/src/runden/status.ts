// Statuseffekte in Runden (6.3, 6.4). Dauern kommen als Millisekunden aus den Daten und werden
// beim Setzen in Runden umgerechnet (ENTWURF-rundenkampf.md, Abschnitt 2.1).
// Schaden und Heilung über Zeit stehen in den Daten je Sekunde; eine Runde zählt rundeSekunden davon.
import type { StatusId } from '../content/ids';
import { melde } from './typen';
import type { Figur, Kampf, RundenStatus } from './typen';
import { rundenAusMs } from './umrechnung';
import { statusWert } from './werte';

export interface StatusWunsch {
  id: StatusId;
  ms: number;
  stapel?: number;
  wert?: number;
  quelleId?: number;
  mods?: { stat: string; mult?: number; add?: number }[];
  anzeige?: string;
}

/**
 * Setzt einen Status. Bosse sind gegen harte Kontrolle immun (10.3), bei Elite laufen Dauern kürzer.
 * Gibt zurück, ob der Status gesetzt wurde.
 */
export function statusSetzen(k: Kampf, ziel: Figur, w: StatusWunsch): boolean {
  if (ziel.tot) return false;
  const def = k.content.statusById[w.id];
  if (def?.bossImmune && ziel.art === 'boss') return false;
  const dauerhaft = w.ms === 0;
  let ms = w.ms;
  if (def?.eliteDurationMult !== undefined && ziel.elite) ms *= def.eliteDurationMult;
  const runden = dauerhaft ? 0 : rundenAusMs(k.content, ms);
  const maxStapel = def?.maxStacks ?? 1;
  const vorhanden = ziel.status.find((s) => s.id === w.id && s.anzeige === w.anzeige);
  if (vorhanden) {
    vorhanden.stapel = Math.min(maxStapel, vorhanden.stapel + (w.stapel ?? 1));
    vorhanden.runden = Math.max(vorhanden.runden, runden);
    if (w.wert !== undefined) vorhanden.wert = w.wert;
    if (w.quelleId !== undefined) vorhanden.quelleId = w.quelleId;
  } else {
    const inst: RundenStatus = { id: w.id, runden, dauerhaft, stapel: Math.min(maxStapel, w.stapel ?? 1) };
    if (w.wert !== undefined) inst.wert = w.wert;
    if (w.quelleId !== undefined) inst.quelleId = w.quelleId;
    if (w.mods) inst.mods = w.mods;
    if (w.anzeige) inst.anzeige = w.anzeige;
    ziel.status.push(inst);
  }
  melde(k, { e: 'status', an: ziel.id, id: w.id, runden });
  einfrieren(k, ziel, w.id);
  return true;
}

/** Frost friert beim vollen Stapel ein (6.4); Bosse werden stattdessen verlangsamt und bleiben handlungsfähig. */
function einfrieren(k: Kampf, ziel: Figur, id: StatusId): void {
  const ab = statusWert(k.content, id, 'freezeAtStacks');
  if (ab <= 0) return;
  const da = ziel.status.find((s) => s.id === id);
  if (!da || da.stapel < ab) return;
  const ms = statusWert(k.content, id, 'freezeMs');
  if (ms > 0) statusSetzen(k, ziel, { id: 'eingefroren', ms });
}

export function statusEntfernen(k: Kampf, ziel: Figur, id: StatusId): void {
  if (!ziel.status.some((s) => s.id === id)) return;
  ziel.status = ziel.status.filter((s) => s.id !== id);
  melde(k, { e: 'status', an: ziel.id, id, runden: 0, weg: true });
}

/** Reinigung (7.7): entfernt schwächende Effekte in der Reihenfolge aus den Daten. */
export function reinigen(k: Kampf, ziel: Figur, anzahl: number): number {
  const kandidaten = ziel.status
    .filter((s) => (k.content.statusById[s.id]?.cleanseOrder ?? 0) > 0)
    .sort((a, b) => (k.content.statusById[a.id]?.cleanseOrder ?? 0) - (k.content.statusById[b.id]?.cleanseOrder ?? 0));
  let weg = 0;
  for (const s of kandidaten.slice(0, anzahl)) {
    statusEntfernen(k, ziel, s.id);
    weg++;
  }
  return weg;
}

export interface UeberZeit {
  id: StatusId;
  quelleId: number | undefined;
  /** Helden als Quelle: Koeffizient auf die Kraft, je Runde. */
  coef: number;
  /** Gegner als Quelle: Anteil des Referenzlebens in Prozent, je Runde. */
  pctRefLeben: number;
  physisch: boolean;
  heilung: boolean;
}

/** Alle Effekte, die am Rundenende Schaden oder Heilung bewirken, schon auf eine Runde umgerechnet. */
export function ueberZeit(k: Kampf, f: Figur): UeberZeit[] {
  const sek = k.content.runden.rundeSekunden;
  const liste: UeberZeit[] = [];
  for (const s of f.status) {
    const def = k.content.statusById[s.id];
    if (!def) continue;
    const coefJeS = s.wert ?? statusWert(k.content, s.id, 'heroCoefPerS');
    const pctJeS = statusWert(k.content, s.id, 'enemyPctRefHpPerS');
    if (coefJeS <= 0 && pctJeS <= 0) continue;
    liste.push({
      id: s.id,
      quelleId: s.quelleId,
      coef: coefJeS * sek * s.stapel,
      pctRefLeben: pctJeS * sek * s.stapel,
      physisch: statusWert(k.content, s.id, 'physical') > 0,
      heilung: def.kind === 'buff',
    });
  }
  return liste;
}

/** Dauern laufen um eine Runde ab; abgelaufene Effekte und Schilde fallen weg. */
export function dauernAbbauen(k: Kampf, f: Figur): void {
  for (const s of [...f.status]) {
    if (s.dauerhaft) continue;
    s.runden -= 1;
    if (s.runden <= 0) statusEntfernen(k, f, s.id);
  }
  for (const sch of f.schilde) sch.runden -= 1;
  const hatte = f.schilde.length > 0;
  f.schilde = f.schilde.filter((s) => s.runden > 0 && s.menge > 0);
  if (hatte && f.schilde.length === 0) statusEntfernen(k, f, 'schild');
}
