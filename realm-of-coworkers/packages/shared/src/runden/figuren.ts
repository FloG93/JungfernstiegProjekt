// Figuren anlegen: Helden, Gegner und Bosse (ENTWURF-rundenkampf.md). Eigene Datei, damit Kampf und
// Bosslogik dieselben Bausteine nutzen, ohne sich gegenseitig zu importieren.
import type { BossId, ClassId, ElementId, EnemyId, HandlerId } from '../content/ids';
import type { Content } from '../content/loader';
import { bossDamageFactor, bossLife, enemyDps, enemyLife, enemyLifeFactor, kampfstufeFactor } from '../formulas';
import type { StatBlock } from '../stats';
import type { Figur } from './typen';
import { rundenAusMs, rundenAusSekunden } from './umrechnung';
import { istNahkampf } from './ziele';

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

export function leereFigur(id: number): Omit<Figur, 'seite' | 'art' | 'name' | 'stufe' | 'grundwerte' | 'element'> {
  return {
    id, reihe: 'vorn', lp: 1, maxLp: 1, tot: false, energie: 0, verteidigt: false, status: [], schilde: [],
    abkling: {}, bedrohung: new Map(), spottBisRunde: 0, spottVon: null, zielId: null, traenke: 0,
    trankAbkling: 0, soloMult: 1, autocast: {}, autoTrank: false, schadenJeAktion: 0, rueMit: 0, resMit: 0,
    fernkampf: false, elite: false, angriffsstufe: 1,
  };
}

export function heldAnlegen(c: Content, id: number, a: HeldAufstellung, solo: boolean): Figur {
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

export function gegnerAnlegen(c: Content, id: number, a: GegnerAufstellung, rundeSekunden: number): Figur {
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

export function kapitelElement(c: Content, kapitel: number): ElementId {
  const boss = c.bosses.find((b) => b.chapter === kapitel);
  return boss?.element ?? 'physisch';
}

export interface BossAufstellung {
  bossId: BossId;
  /** Gruppenstärke n für Leben und Schaden (10.1). */
  n: number;
  kampfstufe: number;
}

/** Boss anlegen (10.1): Leben nach n und Kampfstufe, Element der ersten Phase, Zähler in Runden. */
export function bossAnlegen(c: Content, id: number, a: BossAufstellung): Figur {
  const def = c.bossById[a.bossId];
  const b = c.balance;
  const atk = def.attacks;
  // Das Bossleben ist für Echtzeit bemessen; im Rundenkampf wird es gekürzt, damit ein Kampf
  // 12 bis 18 Runden dauert (OPEN-062)
  const maxLp = Math.max(1, Math.round(bossLife(b, def.hpBase, a.n, a.kampfstufe) * c.runden.boss.lebenMult));
  const f: Figur = {
    ...leereFigur(id),
    seite: 'gegner', art: 'boss', name: def.id, typ: def.id,
    stufe: b.boss.levelPerChapter * def.chapter,
    // Tempo 0: Der Boss handelt als Letzter in der Runde. Nur so wirken Verteidigen, Schilde und
    // Betäubung noch in der Runde, in der die angekündigte Attacke fällt (OPEN-058).
    grundwerte: { leb: maxLp, kra: 0, rue: 0, res: 0, tmp: 0, krt: 0, ksd: 0, ele: 0 },
    element: def.phases[0]!.element, maxLp, lp: maxLp,
    rueMit: def.armorMit, resMit: def.resMit,
    angriffsstufe: b.boss.levelPerChapter * def.chapter,
    boss: {
      bossId: a.bossId, n: a.n, kampfstufe: a.kampfstufe, phase: 1,
      schadenMult: bossDamageFactor(b, a.n) * kampfstufeFactor(b, a.kampfstufe),
      raserei: 0,
      pulsRest: rundenAusMs(c, atk.pulse.intervalMs),
      teleRest: rundenAusMs(c, atk.telegraph.intervalMs),
      sigRest: rundenAusMs(c, atk.signature.intervalMs),
      wutRest: rundenAusSekunden(c, b.boss.rage.everyS),
      wutZielId: null, wutBisRunde: 0,
      addsRest: rundenAusSekunden(c, def.adds.firstAtS),
      rasereiRest: c.runden.boss.raserei.abRunde,
      uebergangBisRunde: 0, ansage: null,
      einMultPhys: 1, einMultElem: 1, passivRest: 0,
    },
  };
  return f;
}
