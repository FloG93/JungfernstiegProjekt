// Reihen und Zielwahl (ENTWURF-rundenkampf.md, Abschnitt 1.1 und 2.2) sowie Bedrohung (6.6).
import type { Content } from '../content/loader';
import type { Zielbild } from './umrechnung';
import { gegnerSeite, lebende } from './typen';
import type { Figur, Kampf, Reihe, Seite } from './typen';

/** Ist die Figur auf Nahkampf angewiesen und damit an die vordere Gegnerreihe gebunden? */
export function istNahkampf(c: Content, f: Figur): boolean {
  if (f.seite === 'gegner') return !f.fernkampf;
  return (c.classById[f.klasse!]?.rangePx ?? 0) <= c.runden.reihe.nahkampfBisPx;
}

export function reihe(k: Kampf, seite: Seite, r: Reihe): Figur[] {
  return lebende(k, seite).filter((f) => f.reihe === r);
}

/** Leere vordere Reihen rücken auf: Die hintere Reihe wird zur vorderen (ENTWURF 1.1). */
export function reihenNachruecken(k: Kampf): void {
  for (const seite of ['held', 'gegner'] as Seite[]) {
    if (lebende(k, seite).length === 0) continue;
    if (reihe(k, seite, 'vorn').length > 0) continue;
    for (const f of reihe(k, seite, 'hinten')) f.reihe = 'vorn';
  }
}

/** Welche Figuren der Gegenseite darf diese Figur angreifen? */
export function erreichbareZiele(k: Kampf, von: Figur): Figur[] {
  const seite = gegnerSeite(von.seite);
  const vorn = reihe(k, seite, 'vorn');
  if (!istNahkampf(k.content, von)) return lebende(k, seite);
  return vorn.length > 0 ? vorn : lebende(k, seite);
}

export function istErreichbar(k: Kampf, von: Figur, ziel: Figur): boolean {
  return erreichbareZiele(k, von).some((f) => f.id === ziel.id);
}

/** Verbündete mit dem geringsten Lebensanteil zuerst; bei Gleichstand die kleinere ID. */
export function schwaechste(k: Kampf, seite: Seite, anzahl: number): Figur[] {
  return [...lebende(k, seite)]
    .sort((a, b) => a.lp / a.maxLp - b.lp / b.maxLp || a.id - b.id)
    .slice(0, Math.max(1, anzahl));
}

export interface Wahl {
  zielId?: number;
  reihe?: Reihe;
}

/** Wen eine einzelne Wirkung trifft. */
export function zieleDerWirkung(k: Kampf, von: Figur, bild: Zielbild, wahl: Wahl, anzahl = 1): Figur[] {
  const feind = gegnerSeite(von.seite);
  const gewaehlt = wahl.zielId !== undefined ? k.figuren.find((f) => f.id === wahl.zielId && !f.tot) : undefined;
  switch (bild) {
    case 'selbst':
      return von.tot ? [] : [von];
    case 'party':
      return lebende(k, von.seite);
    case 'schwaechste':
      return schwaechste(k, von.seite, anzahl);
    case 'alleGegner':
      return lebende(k, feind);
    case 'gegnerVorn': {
      const vorn = reihe(k, feind, 'vorn');
      return vorn.length > 0 ? vorn : lebende(k, feind);
    }
    case 'gegnerReihe': {
      const r = wahl.reihe ?? 'vorn';
      const treffer = reihe(k, feind, r);
      return treffer.length > 0 ? treffer : reihe(k, feind, r === 'vorn' ? 'hinten' : 'vorn');
    }
    case 'zielUndReihe':
      return gewaehlt ? reihe(k, feind, gewaehlt.reihe) : [];
    case 'einGegner':
    default:
      return gewaehlt && gewaehlt.seite === feind ? [gewaehlt] : [];
  }
}

/**
 * Zielwahl eines Gegners nach Bedrohung (6.6): höchste Bedrohung, Wechsel erst über der Schwelle
 * aus den Daten. Spott zwingt, solange er läuft. Nahkämpfer bleiben an die vordere Reihe gebunden.
 */
export function bedrohungsZiel(k: Kampf, g: Figur): Figur | undefined {
  const moeglich = erreichbareZiele(k, g);
  if (moeglich.length === 0) return undefined;
  if (g.spottVon !== null && k.runde <= g.spottBisRunde) {
    const spotter = moeglich.find((f) => f.id === g.spottVon);
    if (spotter) return spotter;
  }
  const wert = (f: Figur) => g.bedrohung.get(f.id) ?? 0;
  let bestes = moeglich[0]!;
  for (const f of moeglich) {
    if (wert(f) > wert(bestes) || (wert(f) === wert(bestes) && f.id < bestes.id)) bestes = f;
  }
  const bisher = moeglich.find((f) => f.id === g.zielId);
  if (!bisher) return wert(bestes) > 0 ? bestes : moeglich[0]!;
  if (bestes.id !== bisher.id && wert(bestes) > wert(bisher) * k.content.balance.combat.threatSwitch) return bestes;
  return bisher;
}
