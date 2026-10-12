// Eine Stage als Folge von Rundenkämpfen (9.1 bis 9.7, ENTWURF-rundenkampf.md Abschnitt 3.1).
// Zwischen den Begegnungen wird nicht gelaufen: Es geht direkt weiter, Checkpoints merken den Fortschritt.
import type { Content } from '../content/loader';
import type { StageDef } from '../content/schemas';
import { introFactor } from '../formulas';
import { Rng, SEED_RANGE } from '../rng';
import { planEncounter } from '../spawn';
import { kampfAnlegen, rundeAusfuehren } from './kampf';
import type { HeldAufstellung, GegnerAufstellung } from './kampf';
import type { Aktion, Ereignis, Figur, Kampf } from './typen';

const PROZENT = 100;

export type LaufPhase = 'kampf' | 'tor' | 'boss' | 'gewonnen' | 'verloren';

export interface LaufEreignis {
  e: 'begegnungStart' | 'begegnungEnde' | 'checkpoint' | 'wipe' | 'stageEnde' | 'tor' | 'bossStart';
  index?: number;
  anteil?: number;
  ergebnis?: 'sieg' | 'niederlage';
}

export interface LaufOptionen {
  content: Content;
  seed: number;
  stage: number;
  helden: HeldAufstellung[];
  /** Gruppenstärke für Budget und Lebensfaktor; voreingestellt die Zahl der Helden. */
  n?: number;
  /** Kampfstufe des Bosses (10.1); 0 heißt ohne Zuschlag. */
  kampfstufe?: number;
}

export interface Lauf {
  content: Content;
  rng: Rng;
  def: StageDef;
  helden: HeldAufstellung[];
  n: number;
  /** Index der laufenden Begegnung. */
  index: number;
  erledigt: Set<number>;
  /** Zuletzt erreichter Checkpoint; −1 bedeutet Stage-Anfang. */
  checkpoint: number;
  wipes: number;
  kampfstufe: number;
  phase: LaufPhase;
  kampf: Kampf;
  /** Lebensanteil je Held, damit Schaden über die Begegnungen hinweg bleibt. */
  anteile: Map<number, number>;
  /** Verbrauchte Tränke je Held. */
  traenke: Map<number, number>;
  protokoll: (Ereignis | LaufEreignis)[];
}

/** Wie viele Begegnungen vor dem Checkpoint liegen; danach beginnt ein Neustart dort. */
function checkpointBis(def: StageDef, checkpointIndex: number): number {
  if (checkpointIndex < 0) return 0;
  const x = def.checkpoints[checkpointIndex] ?? 0;
  return def.encounters.filter((e) => e.x <= x).length;
}

function checkpointNach(def: StageDef, index: number): number {
  const x = def.encounters[index]?.x ?? 0;
  let erreicht = -1;
  def.checkpoints.forEach((cx, i) => {
    if (cx <= x) erreicht = i;
  });
  return erreicht;
}

/** Plant die Gegner einer Begegnung und bringt sie in die Form des Rundenkampfes. */
export function begegnungGegner(c: Content, rng: Rng, def: StageDef, index: number, n: number): GegnerAufstellung[] {
  const plan = planEncounter(c, rng, def, index, n);
  const intro = introFactor(c.balance, def.stage);
  const alle: GegnerAufstellung[] = [];
  for (const gruppe of plan.groups) {
    for (const g of gruppe.enemies) {
      alle.push({
        typ: g.type, stufe: def.stage, n, kapitel: def.chapter, introMult: intro,
        ...(g.eliteAffix ? { elite: g.eliteAffix } : {}),
      });
    }
  }
  // Das Budget aus 9.5 ist für Wellen über Zeit gedacht und ergibt 35 bis 88 Gegner. Im Rundenkampf
  // handelt jeder nur einmal je Runde; deshalb weniger, dafür stärkere Gegner (OPEN-056).
  const b = c.runden.begegnung;
  const anzahl = Math.max(1, Math.round(alle.length * b.gegnerMult));
  // Elite zuerst behalten, damit die besonderen Gegner nicht wegfallen
  const sortiert = [...alle].sort((x, y) => Number(!!y.elite) - Number(!!x.elite));
  return sortiert.slice(0, anzahl).map((g) => ({ ...g, schadenMult: b.schadenMult }));
}

/** Der Bosskampf hinter dem Tor (10.1). Die Party geht mit dem Zustand des letzten Kampfes hinein. */
function bossKampf(l: Lauf): Kampf {
  if (!l.def.boss) throw new Error(`Stage ${l.def.stage} hat keinen Boss`);
  const helden = l.helden.map((h) => ({ ...h, lebensAnteil: (l.anteile.get(h.dbId) ?? PROZENT) / PROZENT }));
  const k = kampfAnlegen({
    content: l.content, seed: l.rng.int(SEED_RANGE), stage: l.def.stage, helden, gegner: [],
    boss: { bossId: l.def.boss, n: l.n, kampfstufe: l.kampfstufe },
  });
  for (const f of k.figuren) {
    if (f.seite !== 'held' || f.dbId === undefined) continue;
    f.traenke = Math.max(0, f.traenke - (l.traenke.get(f.dbId) ?? 0));
  }
  return k;
}

/** Hinter dem Tor beginnt der Bosskampf; die Spieler müssen ihn selbst auslösen (10.1, OPEN-063). */
export function bossBeginnen(l: Lauf): void {
  if (l.phase !== 'tor') return;
  l.phase = 'boss';
  l.kampf = bossKampf(l);
  l.protokoll.push({ e: 'bossStart' });
}

function kampfFuer(l: Lauf, index: number): Kampf {
  const helden = l.helden.map((h) => ({
    ...h,
    lebensAnteil: (l.anteile.get(h.dbId) ?? PROZENT) / PROZENT,
  }));
  const k = kampfAnlegen({
    content: l.content, seed: l.rng.int(SEED_RANGE), stage: l.def.stage, helden,
    gegner: begegnungGegner(l.content, l.rng, l.def, index, l.n),
  });
  for (const f of k.figuren) {
    if (f.seite !== 'held' || f.dbId === undefined) continue;
    f.traenke = Math.max(0, f.traenke - (l.traenke.get(f.dbId) ?? 0));
  }
  return k;
}

export function laufAnlegen(o: LaufOptionen): Lauf {
  const def = o.content.stages[o.stage - 1];
  if (!def) throw new Error(`Stage ${o.stage} gibt es nicht`);
  const l: Lauf = {
    content: o.content, rng: new Rng(o.seed), def, helden: o.helden, n: o.n ?? o.helden.length,
    index: 0, erledigt: new Set(), checkpoint: -1, wipes: 0, phase: 'kampf',
    kampfstufe: o.kampfstufe ?? 0,
    kampf: null as unknown as Kampf, anteile: new Map(), traenke: new Map(), protokoll: [],
  };
  for (const h of o.helden) {
    l.anteile.set(h.dbId, PROZENT);
    l.traenke.set(h.dbId, 0);
  }
  l.kampf = kampfFuer(l, 0);
  l.protokoll.push({ e: 'begegnungStart', index: 0 });
  return l;
}

/** Zustand der Helden aus dem beendeten Kampf übernehmen (Leben, Tränke). */
function zustandSichern(l: Lauf): void {
  for (const f of l.kampf.figuren) {
    if (f.seite !== 'held' || f.dbId === undefined) continue;
    l.anteile.set(f.dbId, f.tot ? 0 : (f.lp / f.maxLp) * PROZENT);
    l.traenke.set(f.dbId, l.content.balance.combat.potion.charges - f.traenke);
  }
}

/** Nach einer gewonnenen Begegnung: Gefallene stehen wieder auf, alle regenerieren etwas (9.2). */
function zwischenErholung(l: Lauf): void {
  const b = l.content.balance.stage;
  for (const h of l.helden) {
    const anteil = l.anteile.get(h.dbId) ?? 0;
    const neu = anteil <= 0 ? b.reviveAtEncounterEndPct : Math.min(PROZENT, anteil + b.regenBetweenPct);
    l.anteile.set(h.dbId, neu);
  }
}

/** Am Checkpoint füllen sich die Tränke wieder (9.2). */
function checkpointErreicht(l: Lauf, index: number): void {
  const cp = checkpointNach(l.def, index);
  if (cp <= l.checkpoint) return;
  l.checkpoint = cp;
  for (const h of l.helden) l.traenke.set(h.dbId, 0);
  l.protokoll.push({ e: 'checkpoint', index: cp });
}

/** Wipe: Neustart am letzten Checkpoint; die Begegnungen davor bleiben erledigt (9.2). */
function neustartAmCheckpoint(l: Lauf): void {
  l.wipes += 1;
  l.protokoll.push({ e: 'wipe', index: l.index });
  const ab = checkpointBis(l.def, l.checkpoint);
  for (const i of [...l.erledigt]) if (i >= ab) l.erledigt.delete(i);
  for (const h of l.helden) {
    l.anteile.set(h.dbId, PROZENT);
    l.traenke.set(h.dbId, 0);
  }
  l.index = ab;
  l.kampf = kampfFuer(l, l.index);
  l.protokoll.push({ e: 'begegnungStart', index: l.index });
}

function naechsteBegegnung(l: Lauf): void {
  l.index += 1;
  if (l.index >= l.def.encounters.length) {
    // Boss-Stages enden am Tor; weiter geht es mit bossBeginnen (10.1)
    l.phase = l.def.boss ? 'tor' : 'gewonnen';
    l.protokoll.push(l.def.boss ? { e: 'tor' } : { e: 'stageEnde', ergebnis: 'sieg' });
    return;
  }
  l.kampf = kampfFuer(l, l.index);
  l.protokoll.push({ e: 'begegnungStart', index: l.index });
}

/**
 * Rechnet eine Runde der laufenden Begegnung und schaltet weiter, wenn sie entschieden ist.
 * Gibt alle Ereignisse dieser Runde zurück, Kampf- wie Laufereignisse.
 */
export function laufRunde(l: Lauf, wahlen: ReadonlyMap<number, Aktion> = new Map()): (Ereignis | LaufEreignis)[] {
  if (l.phase !== 'kampf' && l.phase !== 'boss') return [];
  const vorher = l.protokoll.length;
  const ereignisse = rundeAusfuehren(l.kampf, wahlen);
  l.protokoll.push(...ereignisse);
  if (l.phase === 'boss') {
    if (l.kampf.ergebnis === 'sieg') {
      zustandSichern(l);
      l.phase = 'gewonnen';
      l.protokoll.push({ e: 'stageEnde', ergebnis: 'sieg' });
    } else if (l.kampf.ergebnis === 'niederlage') {
      // Das Tor ist der Checkpoint des Bosskampfes: Es geht frisch gegen den Boss weiter (OPEN-063)
      l.wipes += 1;
      l.protokoll.push({ e: 'wipe', index: l.def.encounters.length });
      for (const h of l.helden) {
        l.anteile.set(h.dbId, PROZENT);
        l.traenke.set(h.dbId, 0);
      }
      l.kampf = bossKampf(l);
      l.protokoll.push({ e: 'bossStart' });
    }
    return l.protokoll.slice(vorher);
  }
  if (l.kampf.ergebnis === 'sieg') {
    zustandSichern(l);
    l.erledigt.add(l.index);
    // Topf-Regel (12.3): Jede Begegnung zahlt genau ihren vollen Anteil
    l.protokoll.push({ e: 'begegnungEnde', index: l.index, anteil: 1 });
    zwischenErholung(l);
    checkpointErreicht(l, l.index);
    naechsteBegegnung(l);
  } else if (l.kampf.ergebnis === 'niederlage') {
    // Ein Wipe beendet den Lauf nicht: Es geht am letzten Checkpoint weiter (9.2), wie im Echtzeitspiel
    neustartAmCheckpoint(l);
  }
  return l.protokoll.slice(vorher);
}

/** Spielt die Stage ohne Eingaben durch; für Tests und Messungen. */
export function laufDurchspielen(l: Lauf, maxRunden = l.content.runden.maxRunden): number {
  let runden = 0;
  while ((l.phase === 'kampf' || l.phase === 'boss') && runden < maxRunden) {
    laufRunde(l);
    runden++;
  }
  return runden;
}

/** Der Lauf wird abgebrochen, etwa weil alle Spieler aufgeben. */
export function laufAufgeben(l: Lauf): void {
  if (l.phase === 'gewonnen' || l.phase === 'verloren') return;
  l.phase = 'verloren';
  l.protokoll.push({ e: 'stageEnde', ergebnis: 'niederlage' });
}

/**
 * Ein Held steigt wieder ein (11.5). Er zählt ab der nächsten Begegnung mit, nicht mitten im Kampf:
 * Reihen und Initiative einer laufenden Runde bleiben damit unverändert (OPEN-066).
 */
export function heldHinzufuegen(l: Lauf, h: HeldAufstellung): void {
  if (l.helden.some((x) => x.dbId === h.dbId)) return;
  l.helden.push(h);
  l.anteile.set(h.dbId, PROZENT);
  l.traenke.set(h.dbId, 0);
}

/** Ein Held verlässt den Lauf (11.5). Seine Figur fällt sofort aus dem laufenden Kampf. */
export function heldEntfernen(l: Lauf, dbId: number): void {
  l.helden = l.helden.filter((h) => h.dbId !== dbId);
  l.anteile.delete(dbId);
  l.traenke.delete(dbId);
  l.kampf.figuren = l.kampf.figuren.filter((f) => f.dbId !== dbId);
  l.kampf.reihenfolge = l.kampf.reihenfolge.filter((id) => l.kampf.figuren.some((f) => f.id === id));
}

/**
 * Die laufende Begegnung neu aufstellen, nachdem Helden dazugekommen sind (11.5). Die Gegner werden
 * neu geplant, damit die Begegnung zur neuen Gruppenstärke passt; der Fortschritt bleibt.
 */
export function begegnungNeuStarten(l: Lauf): void {
  if (l.phase !== 'kampf') return;
  l.kampf = kampfFuer(l, l.index);
  l.protokoll.push({ e: 'begegnungStart', index: l.index });
}

/** Gruppenstärke ändern (11.4): wirkt auf Budget und Lebensfaktor der nächsten Begegnung. */
export function staerkeSetzen(l: Lauf, n: number): void {
  l.n = Math.max(1, n);
}

export function heldenImLauf(l: Lauf): Figur[] {
  return l.kampf.figuren.filter((f) => f.seite === 'held');
}
