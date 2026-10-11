// Aufbau und Ablauf eines Kampfes (ENTWURF-rundenkampf.md, Abschnitt 1.4).
// Der Server ruft rundeAusfuehren mit den gesammelten Wahlen auf; fehlende Wahlen füllt die KI.
import type { ClassId, ElementId, EnemyId, HandlerId } from '../content/ids';
import type { Content } from '../content/loader';
import { chapterOfStage, enemyDps, enemyLife, enemyLifeFactor } from '../formulas';
import { Rng } from '../rng';
import type { StatBlock } from '../stats';
import { aktionAusfuehren, passiveSetzen } from './aktionen';
import { autoAktion, gegnerAktion } from './ki';
import { lebende, melde } from './typen';
import type { Aktion, Figur, Kampf, Reihe } from './typen';
import { initiative, werte } from './werte';
import { energieGeben, rundenEndeFigur } from './wirkung';
import { istNahkampf, reihenNachruecken } from './ziele';

const PROZENT = 100;

export interface HeldAufstellung {
  dbId: number;
  spielerId: string;
  name: string;
  klasse: ClassId;
  stufe: number;
  werte: StatBlock;
  element: ElementId;
  autocast: Record<string, boolean>;
  autoTrank: boolean;
  /** Anteil des Lebens beim Start, 1 = voll. */
  lebensAnteil?: number;
}

export interface GegnerAufstellung {
  typ: EnemyId;
  stufe: number;
  /** Gruppenstärke für den Lebensfaktor H(n) (9.6). */
  n: number;
  kapitel: number;
  elite?: HandlerId;
  /** Einführungsfaktor der ersten Stages (4.3). */
  introMult?: number;
  /** Ausgleich, wenn die Begegnung auf weniger Gegner eingedampft wurde (OPEN-056). */
  schadenMult?: number;
}

export interface KampfOptionen {
  content: Content;
  seed: number;
  stage: number;
  helden: HeldAufstellung[];
  gegner: GegnerAufstellung[];
  gegenBoss?: boolean;
  /** Einzelkämpfer-Bonus (4.4) gilt nur, wenn ein Held allein antritt. */
  solo?: boolean;
}

function leereFigur(id: number): Omit<Figur, 'seite' | 'art' | 'name' | 'stufe' | 'grundwerte' | 'element'> {
  return {
    id, reihe: 'vorn', lp: 1, maxLp: 1, tot: false, energie: 0, verteidigt: false, status: [], schilde: [],
    abkling: {}, bedrohung: new Map(), spottBisRunde: 0, spottVon: null, zielId: null, traenke: 0,
    trankAbkling: 0, soloMult: 1, autocast: {}, autoTrank: false, schadenJeAktion: 0, rueMit: 0, resMit: 0,
    fernkampf: false, elite: false, angriffsstufe: 1,
  };
}

function heldAnlegen(c: Content, id: number, a: HeldAufstellung, solo: boolean): Figur {
  const maxLp = Math.max(1, Math.round(a.werte.leb));
  const f: Figur = {
    ...leereFigur(id),
    seite: 'held', art: 'held', name: a.name, klasse: a.klasse, spielerId: a.spielerId, dbId: a.dbId,
    stufe: a.stufe, grundwerte: { ...a.werte }, element: a.element,
    maxLp, lp: Math.max(1, Math.round(maxLp * (a.lebensAnteil ?? 1))),
    traenke: c.balance.combat.potion.charges, autocast: { ...a.autocast }, autoTrank: a.autoTrank,
    soloMult: solo ? c.classById[a.klasse].solo : 1,
  };
  f.reihe = istNahkampf(c, f) ? 'vorn' : 'hinten';
  return f;
}

function gegnerAnlegen(c: Content, id: number, a: GegnerAufstellung, rundeSekunden: number): Figur {
  const def = c.enemyById[a.typ];
  const elite = a.elite !== undefined;
  const ed = c.elite;
  const intro = a.introMult ?? 1;
  const lpMult = elite ? ed.hpMult : def.hpMult;
  const schadenMult = elite ? ed.dmgMult : def.dmgMult;
  const maxLp = Math.max(1, Math.round(enemyLife(c.balance, a.stufe) * lpMult * enemyLifeFactor(c.balance, a.n) * intro));
  const element: ElementId = def.element === 'kapitel' ? kapitelElement(c, a.kapitel) : 'physisch';
  const fern = def.ai === 'ranged' || def.ai === 'support';
  const f: Figur = {
    ...leereFigur(id),
    seite: 'gegner', art: 'gegner', name: def.id, typ: def.id, stufe: a.stufe,
    grundwerte: { leb: maxLp, kra: 0, rue: 0, res: 0, tmp: def.speed, krt: 0, ksd: 0, ele: 0 },
    element, maxLp, lp: maxLp,
    // Der Schaden je Handlung entspricht dem bisherigen Schaden einer Runde Spielzeit (ENTWURF 2.1)
    schadenJeAktion: enemyDps(c.balance, a.stufe) * schadenMult * rundeSekunden * intro * (a.schadenMult ?? 1),
    rueMit: elite ? ed.armorMit : def.armorMit,
    resMit: elite ? ed.resMit : def.resMit,
    fernkampf: fern, elite, angriffsstufe: a.stufe,
    reihe: fern ? 'hinten' : 'vorn',
  };
  return f;
}

function kapitelElement(c: Content, kapitel: number): ElementId {
  const boss = c.bosses.find((b) => b.chapter === kapitel);
  return boss?.element ?? 'physisch';
}

export function kampfAnlegen(o: KampfOptionen): Kampf {
  const c = o.content;
  const k: Kampf = {
    content: c, rng: new Rng(o.seed), runde: 0, figuren: [], reihenfolge: [], ereignisse: [],
    ergebnis: 'laeuft', gegenBoss: o.gegenBoss ?? false, kapitel: chapterOfStage(o.stage), naechsteId: 1,
    reserve: [],
  };
  const solo = o.solo ?? o.helden.length === 1;
  for (const h of o.helden) k.figuren.push(heldAnlegen(c, k.naechsteId++, h, solo));
  o.gegner.forEach((g, i) => {
    const f = gegnerAnlegen(c, k.naechsteId++, g, c.runden.rundeSekunden);
    if (i < c.runden.gegnerMax) k.figuren.push(f);
    else k.reserve.push(f);
  });
  plaetzeAusgleichen(k);
  for (const f of k.figuren) {
    if (f.seite !== 'held') continue;
    f.energie = k.gegenBoss ? c.runden.energie.startBoss : c.runden.energie.start;
    passiveSetzen(k, f);
    f.maxLp = Math.max(1, Math.round(werte(k, f).leb));
    f.lp = Math.min(f.lp, f.maxLp);
  }
  reihenNachruecken(k);
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
    const a = f.seite === 'held' ? (wahlen.get(id) ?? autoAktion(k, f)) : gegnerAktion(k, f);
    if (a) aktionAusfuehren(k, f, a);
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
