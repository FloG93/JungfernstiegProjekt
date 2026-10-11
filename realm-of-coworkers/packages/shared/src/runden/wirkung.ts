// Schaden, Heilung, Schilde, Tod und Bedrohung (5.6, 6.6, 6.8). Die Formeln sind dieselben wie im
// Echtzeitkampf; nur die Zeitbezüge sind weg: ein Treffer gehört zu einer Handlung, nicht zu einer Sekunde.
import type { ElementId } from '../content/ids';
import { refLife } from '../formulas';
import { dauernAbbauen, statusEntfernen, ueberZeit } from './status';
import { melde } from './typen';
import type { Figur, Kampf } from './typen';
import { elementFaktor, hatStatus, minderung, schadenAusMult, schadenEinMult, werte } from './werte';

const PROZENT = 100;

export interface TrefferOpt {
  element?: ElementId;
  krit?: boolean;
  dot?: boolean;
}

export function unverwundbar(f: Figur): boolean {
  return hatStatus(f, 'unverwundbar');
}

/** Bedrohung eintragen (6.6). Heilung zählt mit dem Faktor aus den Daten. */
export function bedrohungAddieren(k: Kampf, gegner: Figur, heldId: number, menge: number): void {
  if (gegner.seite !== 'gegner' || menge <= 0) return;
  gegner.bedrohung.set(heldId, (gegner.bedrohung.get(heldId) ?? 0) + menge);
}

/** Zieht Schaden ab, nachdem Schilde ihn aufgefangen haben. Gibt den gesamten Schaden zurück. */
export function schadenZufuegen(k: Kampf, von: Figur | null, an: Figur, roh: number, opt: TrefferOpt = {}): number {
  if (an.tot) return 0;
  if (unverwundbar(an)) {
    melde(k, { e: 'schaden', von: von?.id ?? 0, an: an.id, menge: 0, ...(opt.element ? { element: opt.element } : {}) });
    return 0;
  }
  let offen = Math.max(1, Math.round(roh));
  const gesamt = offen;
  let absorbiert = 0;
  for (let i = an.schilde.length - 1; i >= 0 && offen > 0; i--) {
    const sch = an.schilde[i]!;
    const a = Math.min(sch.menge, offen);
    sch.menge -= a;
    offen -= a;
    absorbiert += a;
  }
  if (absorbiert > 0) {
    an.schilde = an.schilde.filter((s) => s.menge > 0);
    if (an.schilde.length === 0) statusEntfernen(k, an, 'schild');
  }
  an.lp -= offen;
  melde(k, {
    e: 'schaden', von: von?.id ?? 0, an: an.id, menge: gesamt,
    ...(opt.krit ? { krit: true } : {}), ...(opt.element ? { element: opt.element } : {}),
    ...(absorbiert ? { absorbiert } : {}), ...(opt.dot ? { dot: true } : {}),
  });
  if (von?.seite === 'held' && an.seite === 'gegner') {
    bedrohungAddieren(k, an, von.id, gesamt * k.content.classById[von.klasse!].threat);
  }
  if (an.lp <= 0) toeten(k, an);
  return gesamt;
}

export function toeten(k: Kampf, f: Figur): void {
  if (f.tot) return;
  f.tot = true;
  f.lp = 0;
  f.status = [];
  f.schilde = [];
  melde(k, { e: 'tod', id: f.id });
  // Verbündete schöpfen Kraft aus dem Fall eines Gefährten (ENTWURF 1.5)
  for (const a of k.figuren) {
    if (a.seite === f.seite && !a.tot) energieGeben(k, a, k.content.runden.energie.jeGefallenerVerbuendeter);
  }
}

export function heilen(k: Kampf, von: Figur | null, an: Figur, menge: number): number {
  if (an.tot || menge <= 0) return 0;
  const malus = hatStatus(an, 'gift')
    ? 1 - (k.content.statusById['gift']?.params?.['healingReceivedMalusPct'] ?? 0) / PROZENT
    : 1;
  const wirksam = Math.round(menge * malus);
  const vorher = an.lp;
  an.lp = Math.min(an.maxLp, an.lp + wirksam);
  const getan = an.lp - vorher;
  if (getan <= 0) return 0;
  melde(k, { e: 'heilung', von: von?.id ?? 0, an: an.id, menge: getan });
  if (von?.seite === 'held') {
    const anteil = k.content.balance.combat.healThreat;
    for (const g of k.figuren) if (g.seite === 'gegner' && !g.tot) bedrohungAddieren(k, g, von.id, getan * anteil);
  }
  return getan;
}

export function schildGeben(k: Kampf, an: Figur, menge: number, runden: number): void {
  if (an.tot || menge <= 0) return;
  an.schilde.push({ menge: Math.round(menge), runden });
  melde(k, { e: 'schild', an: an.id, menge: Math.round(menge) });
}

export function energieGeben(k: Kampf, f: Figur, menge: number): void {
  if (f.tot || f.seite !== 'held') return;
  const max = k.content.runden.energie.max;
  const neu = Math.min(max, f.energie + menge);
  if (neu === f.energie) return;
  f.energie = neu;
  melde(k, { e: 'energie', id: f.id, wert: neu });
}

/** Treffer eines Helden über einen Koeffizienten (5.6). */
export function heldTrifft(k: Kampf, von: Figur, an: Figur, coef: number, element: ElementId,
  o: { kritErlaubt?: boolean; bonusMult?: number } = {}): number {
  if (an.tot || von.seite === an.seite) return 0;
  const st = werte(k, von);
  const physisch = element === 'physisch';
  let kritFaktor = 1;
  let krit = false;
  if (o.kritErlaubt !== false && k.rng.chance(st.krt / PROZENT)) {
    krit = true;
    kritFaktor = st.ksd / PROZENT;
  }
  const mit = minderung(k, an, physisch, von.stufe);
  const mult = schadenAusMult(von) * schadenEinMult(k, an) * (o.bonusMult ?? 1);
  const roh = coef * st.kra * von.soloMult * (1 + st.ele / PROZENT) * elementFaktor(k, element, an) * kritFaktor * (1 - mit) * mult;
  return schadenZufuegen(k, von, an, roh, { element, krit });
}

/** Treffer eines Gegners: fester Schaden je Handlung, beim Ziel gemindert. */
export function gegnerTrifft(k: Kampf, von: Figur, an: Figur, menge = von.schadenJeAktion): number {
  if (an.tot) return 0;
  const physisch = von.element === 'physisch';
  const mit = minderung(k, an, physisch, von.angriffsstufe);
  const mult = schadenAusMult(von) * schadenEinMult(k, an);
  const roh = menge * (1 - mit) * mult * elementFaktor(k, von.element, an);
  const getan = schadenZufuegen(k, von, an, roh, { element: von.element });
  if (getan > 0) energieGeben(k, an, k.content.runden.energie.jeTreffer);
  return getan;
}

/** Rundenende einer Figur: erst Schaden und Heilung über Zeit, dann laufen die Dauern ab. */
export function rundenEndeFigur(k: Kampf, f: Figur): void {
  if (f.tot) return;
  for (const u of ueberZeit(k, f)) {
    const quelle = k.figuren.find((x) => x.id === u.quelleId) ?? null;
    if (u.heilung) {
      const basis = quelle ? werte(k, quelle).kra : 0;
      heilen(k, quelle, f, u.coef * basis);
      continue;
    }
    if (quelle && quelle.seite === 'held') {
      const st = werte(k, quelle);
      const mit = minderung(k, f, u.physisch, quelle.stufe);
      schadenZufuegen(k, quelle, f, u.coef * st.kra * (1 - mit), { dot: true });
    } else if (u.pctRefLeben > 0) {
      const ref = refLife(k.content.balance, k.kapitel);
      const mit = minderung(k, f, u.physisch, quelle?.angriffsstufe ?? f.stufe);
      schadenZufuegen(k, quelle, f, (u.pctRefLeben / PROZENT) * ref * (1 - mit), { dot: true });
    }
  }
  dauernAbbauen(k, f);
}
