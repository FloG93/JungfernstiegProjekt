// Aufbau und Ablauf eines Kampfes (ENTWURF-rundenkampf.md, Abschnitt 1.4).
// Der Server ruft rundeAusfuehren mit den gesammelten Wahlen auf; fehlende Wahlen füllt die KI.
import type { Content } from '../content/loader';
import { chapterOfStage } from '../formulas';
import { Rng } from '../rng';
import { aktionAusfuehren, passiveSetzen } from './aktionen';
import { bossHandeln, bossStarten, phasePruefen } from './boss';
import { bossAnlegen, gegnerAnlegen, heldAnlegen } from './figuren';
import type { BossAufstellung, GegnerAufstellung, HeldAufstellung } from './figuren';
import { autoAktion, gegnerAktion } from './ki';
import { lebende, melde } from './typen';
import type { Aktion, Figur, Kampf, Reihe } from './typen';
import { initiative, werte } from './werte';
import { energieGeben, rundenEndeFigur } from './wirkung';
import { reihenNachruecken } from './ziele';

const PROZENT = 100;

export type { BossAufstellung, GegnerAufstellung, HeldAufstellung };

export interface KampfOptionen {
  content: Content;
  seed: number;
  stage: number;
  helden: HeldAufstellung[];
  gegner: GegnerAufstellung[];
  /** Bosskampf (10): Der Boss steht zusätzlich zu den Gegnern im Feld. */
  boss?: BossAufstellung;
  gegenBoss?: boolean;
  /** Einzelkämpfer-Bonus (4.4) gilt nur, wenn ein Held allein antritt. */
  solo?: boolean;
}

export function kampfAnlegen(o: KampfOptionen): Kampf {
  const c = o.content;
  const k: Kampf = {
    content: c, rng: new Rng(o.seed), runde: 0, figuren: [], reihenfolge: [], ereignisse: [],
    ergebnis: 'laeuft', gegenBoss: o.gegenBoss ?? o.boss !== undefined, kapitel: chapterOfStage(o.stage),
    naechsteId: 1,
    reserve: [],
  };
  const solo = o.solo ?? o.helden.length === 1;
  for (const h of o.helden) k.figuren.push(heldAnlegen(c, k.naechsteId++, h, solo));
  o.gegner.forEach((g, i) => {
    const f = gegnerAnlegen(c, k.naechsteId++, g, c.runden.rundeSekunden);
    if (i < c.runden.gegnerMax) k.figuren.push(f);
    else k.reserve.push(f);
  });
  const boss = o.boss ? bossAnlegen(c, k.naechsteId++, o.boss) : undefined;
  if (boss) k.figuren.push(boss);
  plaetzeAusgleichen(k);
  for (const f of k.figuren) {
    if (f.seite !== 'held') continue;
    f.energie = k.gegenBoss ? c.runden.energie.startBoss : c.runden.energie.start;
    passiveSetzen(k, f);
    f.maxLp = Math.max(1, Math.round(werte(k, f).leb));
    f.lp = Math.min(f.lp, f.maxLp);
  }
  reihenNachruecken(k);
  if (boss) bossStarten(k, boss);
  return k;
}

/** Wartende Gegner rücken nach, sobald ein Platz frei ist (ENTWURF 3.1). */
export function reserveNachruecken(k: Kampf): void {
  const platz = () => k.content.runden.gegnerMax - k.figuren.filter((f) => f.seite === 'gegner' && !f.tot).length;
  while (k.reserve.length > 0 && platz() > 0) {
    const f = k.reserve.shift()!;
    k.figuren.push(f);
    melde(k, { e: 'nachruecken', id: f.id, typ: f.typ ?? '', reihe: f.reihe });
  }
  plaetzeAusgleichen(k);
}

/** Höchstens so viele Figuren je Reihe wie Plätze; überzählige rücken in die andere Reihe. */
function plaetzeAusgleichen(k: Kampf): void {
  const plaetze = k.content.runden.reihe.plaetze;
  for (const seite of ['held', 'gegner'] as const) {
    for (const r of ['vorn', 'hinten'] as Reihe[]) {
      const andere: Reihe = r === 'vorn' ? 'hinten' : 'vorn';
      const inReihe = k.figuren.filter((f) => f.seite === seite && f.reihe === r);
      for (const f of inReihe.slice(plaetze)) f.reihe = andere;
    }
  }
}

/** Reihenfolge der laufenden Runde: Tempo absteigend, bei Gleichstand die kleinere ID (ENTWURF 1.2). */
export function reihenfolgeBestimmen(k: Kampf): number[] {
  return k.figuren
    .filter((f) => !f.tot)
    .map((f) => ({ id: f.id, ini: initiative(k, f) }))
    .sort((a, b) => b.ini - a.ini || a.id - b.id)
    .map((x) => x.id);
}

export function kampfLaeuft(k: Kampf): boolean {
  return k.ergebnis === 'laeuft';
}

function ergebnisPruefen(k: Kampf): void {
  if (!kampfLaeuft(k)) return;
  if (lebende(k, 'gegner').length === 0) k.ergebnis = 'sieg';
  else if (lebende(k, 'held').length === 0) k.ergebnis = 'niederlage';
  else if (k.runde >= k.content.runden.maxRunden) k.ergebnis = 'niederlage';
  if (!kampfLaeuft(k)) melde(k, { e: 'kampfEnde', ergebnis: k.ergebnis as 'sieg' | 'niederlage', runden: k.runde });
}

/**
 * Rechnet eine ganze Runde und liefert ihr Protokoll. `wahlen` enthält die Handlungen der Spieler;
 * wer fehlt, handelt nach den Auto-Regeln. Gegner entscheidet die KI.
 */
export function rundeAusfuehren(k: Kampf, wahlen: ReadonlyMap<number, Aktion> = new Map()): Ereignisse {
  if (!kampfLaeuft(k)) return [];
  k.ereignisse = [];
  k.runde += 1;
  reihenNachruecken(k);
  k.reihenfolge = reihenfolgeBestimmen(k);
  melde(k, { e: 'rundeStart', runde: k.runde, reihenfolge: [...k.reihenfolge] });
  for (const id of k.reihenfolge) {
    const f = k.figuren.find((x) => x.id === id);
    if (!f || f.tot || !kampfLaeuft(k)) continue;
    if (f.art === 'boss') {
      bossHandeln(k, f);
    } else {
      const a = f.seite === 'held' ? (wahlen.get(id) ?? autoAktion(k, f)) : gegnerAktion(k, f);
      if (a) aktionAusfuehren(k, f, a);
    }
    for (const b of k.figuren) if (b.art === 'boss') phasePruefen(k, b);
    reserveNachruecken(k);
    reihenNachruecken(k);
    ergebnisPruefen(k);
    if (!kampfLaeuft(k)) break;
  }
  if (kampfLaeuft(k)) {
    for (const f of k.figuren) {
      if (f.tot) continue;
      rundenEndeFigur(k, f);
      for (const id of Object.keys(f.abkling)) {
        if (f.abkling[id]! > 0) f.abkling[id]! -= 1;
      }
      if (f.trankAbkling > 0) f.trankAbkling -= 1;
    }
    melde(k, { e: 'rundeEnde', runde: k.runde });
    ergebnisPruefen(k);
  }
  return k.ereignisse;
}

type Ereignisse = Kampf['ereignisse'];

/** Energie für eine Handlung gutschreiben; die Oberfläche braucht denselben Wert für die Vorschau. */
export function energieJeAktion(k: Kampf, f: Figur): number {
  return f.seite === 'held' ? k.content.runden.energie.jeAktion : 0;
}

export { energieGeben };

/** Wie viel Prozent des Lebens eine Figur noch hat. */
export function lebensAnteil(f: Figur): number {
  return f.maxLp > 0 ? (f.lp / f.maxLp) * PROZENT : 0;
}
