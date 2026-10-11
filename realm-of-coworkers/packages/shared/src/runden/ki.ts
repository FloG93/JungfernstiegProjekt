// Wahl der Handlung ohne Spieler: Gegner handeln nach Bedrohung, Helden nach ihren Auto-Cast-Regeln (4.6).
// Dieselbe Wahl greift, wenn ein Spieler das Planungsfenster verstreichen lässt (ENTWURF 4).
import type { SkillDef } from '../content/schemas';
import { bereiteFaehigkeiten, faehigkeitBereit } from './aktionen';
import type { Aktion, Figur, Kampf } from './typen';
import { auswahlDerFaehigkeit } from './umrechnung';
import { erreichbareZiele, bedrohungsZiel, reihe, schwaechste } from './ziele';
import { gegnerSeite } from './typen';

const PROZENT = 100;

/** Handlung eines Gegners: Ziel nach Bedrohung, sonst angreifen. */
export function gegnerAktion(k: Kampf, g: Figur): Aktion | null {
  const ziel = bedrohungsZiel(k, g);
  if (!ziel) return null;
  return { k: 'angriff', ziel: ziel.id };
}

/** Lohnt sich ein Trank? Nur wenn er nicht verfällt und das Leben gesunken ist. */
function trankNoetig(k: Kampf, h: Figur): boolean {
  if (!h.autoTrank || h.traenke <= 0 || h.trankAbkling > 0) return false;
  const schwelle = k.content.balance.combat.potion.pct;
  return (h.lp / h.maxLp) * PROZENT <= PROZENT - schwelle;
}

function zielFuer(k: Kampf, h: Figur, s: SkillDef): Aktion | null {
  switch (auswahlDerFaehigkeit(s)) {
    case 'gegner': {
      const moeglich = erreichbareZiele(k, h);
      if (moeglich.length === 0) return null;
      // Das schwächste erreichbare Ziel zuerst, damit Gegner schneller ausfallen
      const ziel = [...moeglich].sort((a, b) => a.lp - b.lp || a.id - b.id)[0]!;
      return { k: 'faehigkeit', id: s.id, ziel: ziel.id };
    }
    case 'gegnerReihe': {
      const feind = gegnerSeite(h.seite);
      const vorn = reihe(k, feind, 'vorn').length;
      const hinten = reihe(k, feind, 'hinten').length;
      if (vorn === 0 && hinten === 0) return null;
      return { k: 'faehigkeit', id: s.id, reihe: hinten > vorn ? 'hinten' : 'vorn' };
    }
    case 'verbuendeter': {
      const ziel = schwaechste(k, h.seite, 1)[0];
      return ziel ? { k: 'faehigkeit', id: s.id, ziel: ziel.id } : null;
    }
    default:
      return { k: 'faehigkeit', id: s.id };
  }
}

/**
 * Handlung eines Helden ohne Eingabe. Reihenfolge: Trank, dann Ultimate, dann Fähigkeiten in
 * Slot-Reihenfolge, zuletzt der Grundangriff.
 */
export function autoAktion(k: Kampf, h: Figur): Aktion | null {
  if (trankNoetig(k, h)) return { k: 'trank' };
  const erlaubt = (s: SkillDef) => h.autocast[s.id] ?? s.autoCast?.default ?? false;
  const bereit = bereiteFaehigkeiten(k, h).filter(erlaubt);
  const ult = bereit.find((s) => s.slot === 'ult');
  const reihenfolge = ['s1', 's2', 's3'];
  const gewaehlt = ult ?? reihenfolge
    .map((slot) => bereit.find((s) => s.slot === slot))
    .find((s): s is SkillDef => !!s);
  if (gewaehlt) {
    const a = zielFuer(k, h, gewaehlt);
    if (a) return a;
  }
  const moeglich = erreichbareZiele(k, h);
  if (moeglich.length === 0) return null;
  const ziel = [...moeglich].sort((a, b) => a.lp - b.lp || a.id - b.id)[0]!;
  return { k: 'angriff', ziel: ziel.id };
}

/** Ist die Fähigkeit für diese Figur gerade wählbar? Für die Oberfläche. */
export function waehlbar(k: Kampf, f: Figur, id: string): boolean {
  const s = k.content.skillById.get(id);
  return !!s && faehigkeitBereit(k, f, s);
}
