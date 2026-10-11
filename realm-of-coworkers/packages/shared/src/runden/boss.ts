// Bosskampf in Runden (10, ENTWURF-rundenkampf.md Abschnitt 3.2).
// Der Boss handelt einmal je Runde. Große Angriffe kündigt er eine Runde vorher an; die Party hat
// genau diese Runde Zeit zu reagieren. Alle Zähler stehen in Runden, umgerechnet nach 2.1.
import { countFactor } from '../formulas';
import { bossDef, bossSchaden, bossTrifft, lebendeHelden } from './bosswirkung';
import { bossHandler } from './handler';
import { gegnerAnlegen } from './figuren';
import { statusSetzen, statusEntfernen } from './status';
import { melde } from './typen';
import type { BossAnsage, Figur, Kampf } from './typen';
import { rundenAusMs, rundenAusSekunden } from './umrechnung';
import { kannHandeln } from './werte';
import { heilen } from './wirkung';
import { bedrohungsZiel } from './ziele';

const PROZENT = 100;

export { bossDef, bossSchaden };

function params(roh: Record<string, number | string | boolean> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, wert] of Object.entries(roh ?? {})) if (typeof wert === 'number') out[name] = wert;
  return out;
}

function passive(k: Kampf, boss: Figur) {
  const def = bossDef(k, boss);
  return { h: bossHandler(def.passive.id), p: params(def.passive.params) };
}

/** Zu Kampfbeginn: Passive einrichten und die erste Phase ansagen. */
export function bossStarten(k: Kampf, boss: Figur): void {
  const { h, p } = passive(k, boss);
  h?.start?.({ k, boss, params: p });
  phaseBeginnen(k, boss, 1, false);
}

/** Ziel des Bosses: Spott, sonst Wutwechsel-Ziel, sonst höchste Bedrohung (6.6, 10.2). */
export function bossZiel(k: Kampf, boss: Figur): Figur | undefined {
  const z = boss.boss!;
  if (z.wutZielId !== null && k.runde <= z.wutBisRunde) {
    const t = k.figuren.find((f) => f.id === z.wutZielId && !f.tot);
    if (t) return t;
  }
  return bedrohungsZiel(k, boss);
}

/** Wutwechsel (10.4): zufaelliger Held für die umgerechnete Dauer, Spott hat Vorrang. */
function wutwechsel(k: Kampf, boss: Figur): void {
  const z = boss.boss!;
  const r = k.content.balance.boss.rage;
  z.wutRest -= 1;
  if (z.wutRest > 0) return;
  z.wutRest = rundenAusSekunden(k.content, r.everyS);
  if (boss.spottVon !== null && k.runde <= boss.spottBisRunde) return;
  const lebend = lebendeHelden(k);
  if (lebend.length === 0) return;
  const ziel = k.rng.pick(lebend);
  z.wutZielId = ziel.id;
  z.wutBisRunde = k.runde + Math.max(1, rundenAusMs(k.content, r.ms));
  melde(k, { e: 'wutwechsel', id: boss.id, ziel: ziel.id });
}

/**
 * Raserei (10.4). Der Zeitwert aus den Daten ergäbe umgerechnet 160 Runden und könnte in einem
 * Bosskampf von 12 bis 18 Runden nie greifen; deshalb stehen die Rundenwerte in runden.json (OPEN-059).
 */
function raserei(k: Kampf, boss: Figur): void {
  const z = boss.boss!;
  const e = k.content.balance.boss.enrage;
  const r = k.content.runden.boss.raserei;
  z.rasereiRest -= 1;
  if (z.rasereiRest > 0) return;
  z.rasereiRest = r.alleRunden;
  z.raserei = z.raserei === 0 ? e.bonus : z.raserei + e.stepBonus;
  melde(k, { e: 'bossRaserei', id: boss.id, stufe: z.raserei });
}

/** Adds (10.4): eine Welle Schwarmlinge nach C(n); sie fallen beim Phasenwechsel. */
function adds(k: Kampf, boss: Figur): void {
  const z = boss.boss!;
  const def = bossDef(k, boss);
  z.addsRest -= 1;
  if (z.addsRest > 0) return;
  z.addsRest = rundenAusSekunden(k.content, def.adds.everyS);
  const typ = def.adds.enemy;
  const anzahl = Math.max(1, Math.round(
    def.adds.groupsPerWave * k.content.enemyById[typ].groupSize * countFactor(k.content.balance, z.n),
  ));
  for (let i = 0; i < anzahl; i++) {
    const f = gegnerAnlegen(k.content, k.naechsteId++, {
      typ, stufe: k.content.balance.boss.levelPerChapter * def.chapter, n: z.n, kapitel: def.chapter,
    }, k.content.runden.rundeSekunden);
    f.typ = typ;
    k.reserve.push(f);
  }
}

/** Phasenwechsel bei den Schwellen aus den Daten (10.5). Keine Phase wird übersprungen. */
export function phasePruefen(k: Kampf, boss: Figur): void {
  const z = boss.boss!;
  const def = bossDef(k, boss);
  if (boss.tot || z.phase >= def.phases.length) return;
  const naechste = def.phases[z.phase]!;
  const schwelle = (naechste.fromPct / PROZENT) * boss.maxLp;
  if (boss.lp > schwelle) return;
  boss.lp = Math.max(1, Math.ceil(schwelle));
  phaseBeginnen(k, boss, z.phase + 1, true);
}

function phaseBeginnen(k: Kampf, boss: Figur, phase: number, uebergang: boolean): void {
  const z = boss.boss!;
  const def = bossDef(k, boss);
  const b = k.content.balance.boss.phaseTransition;
  z.phase = phase;
  boss.element = def.phases[phase - 1]!.element;
  if (uebergang) {
    // Der Übergang kostet den Boss seine Angriffe, solange er unverwundbar ist (10.5)
    const runden = Math.max(1, rundenAusMs(k.content, b.invulnMs));
    statusSetzen(k, boss, { id: 'unverwundbar', ms: b.invulnMs });
    z.uebergangBisRunde = k.runde + runden - 1;
    z.ansage = null;
    for (const h of k.figuren) {
      if (h.seite !== 'held') continue;
      if (h.tot) {
        h.tot = false;
        h.lp = Math.max(1, Math.round((h.maxLp * b.revivePct) / PROZENT));
        h.status = [];
        h.schilde = [];
      } else {
        heilen(k, null, h, (h.maxLp * b.healPct) / PROZENT);
      }
    }
    for (const a of k.figuren) if (a.seite === 'gegner' && a.art === 'gegner' && !a.tot) a.tot = true;
    k.reserve = [];
  }
  melde(k, { e: 'bossPhase', id: boss.id, phase, element: boss.element });
  const { h, p } = passive(k, boss);
  h?.phase?.({ k, boss, params: p, phase });
}

function ansagen(k: Kampf, boss: Figur, art: BossAnsage['art'], text: string): void {
  const runde = k.runde + k.content.runden.boss.ansageRunden;
  boss.boss!.ansage = { art, text, runde };
  melde(k, { e: 'bossAnsage', id: boss.id, art, text, runde });
}

function standard(k: Kampf, boss: Figur): void {
  const ziel = bossZiel(k, boss);
  if (!ziel) {
    melde(k, { e: 'verfehlt', von: boss.id, grund: 'keinZiel' });
    return;
  }
  boss.zielId = ziel.id;
  melde(k, { e: 'bossAngriff', id: boss.id, art: 'standard', ziele: [ziel.id] });
  bossTrifft(k, boss, ziel, bossDef(k, boss).attacks.standard);
}

function puls(k: Kampf, boss: Figur): void {
  const atk = bossDef(k, boss).attacks.pulse;
  const ziele = lebendeHelden(k);
  melde(k, { e: 'bossAngriff', id: boss.id, art: 'puls', ziele: ziele.map((f) => f.id) });
  for (const h of ziele) bossTrifft(k, boss, h, atk);
}

/** Angekündigter Flächenangriff: trifft einen Helden samt seiner Reihe und setzt den Boss-Debuff (10.4). */
function telegraph(k: Kampf, boss: Figur): void {
  const def = bossDef(k, boss);
  const atk = def.attacks.telegraph;
  const lebend = lebendeHelden(k);
  if (lebend.length === 0) return;
  const mitte = k.rng.pick(lebend);
  const ziele = lebend.filter((f) => f.reihe === mitte.reihe);
  melde(k, { e: 'bossAngriff', id: boss.id, art: 'telegraph', ziele: ziele.map((f) => f.id) });
  for (const h of ziele) {
    if (bossTrifft(k, boss, h, atk) > 0) statusSetzen(k, h, { id: def.debuff, ms: 0, quelleId: boss.id });
  }
}

function signatur(k: Kampf, boss: Figur): void {
  const def = bossDef(k, boss);
  const atk = def.attacks.signature;
  const h = atk.handler ? bossHandler(atk.handler) : undefined;
  if (!h?.signatur) {
    melde(k, { e: 'verfehlt', von: boss.id, grund: 'nichtBereit' });
    return;
  }
  const getroffen = h.signatur({ k, boss, params: params(atk.params), angriff: atk });
  melde(k, { e: 'bossAngriff', id: boss.id, art: 'signatur', ziele: getroffen.map((f) => f.id) });
}

/**
 * Handlung des Bosses in dieser Runde. Reihenfolge: angekündigter Angriff, sonst neue Ansage für
 * Signatur oder Flächenangriff, sonst Puls, sonst Standardschlag.
 */
export function bossHandeln(k: Kampf, boss: Figur): void {
  const z = boss.boss!;
  const def = bossDef(k, boss);
  const { h, p } = passive(k, boss);
  raserei(k, boss);
  if (k.runde <= z.uebergangBisRunde) return;
  if (z.uebergangBisRunde > 0) {
    z.uebergangBisRunde = 0;
    statusEntfernen(k, boss, 'unverwundbar');
  }
  h?.runde?.({ k, boss, params: p });
  if (boss.tot) return;
  adds(k, boss);
  wutwechsel(k, boss);
  if (!kannHandeln(k, boss)) {
    melde(k, { e: 'verfehlt', von: boss.id, grund: 'blockiert' });
    return;
  }
  const faellig = z.ansage && z.ansage.runde <= k.runde ? z.ansage : null;
  if (faellig) {
    z.ansage = null;
    if (faellig.art === 'signatur') signatur(k, boss);
    else telegraph(k, boss);
    return;
  }
  z.pulsRest -= 1;
  z.teleRest -= 1;
  const sigAb = def.attacks.signature.fromPhase ?? 1;
  if (z.phase >= sigAb) z.sigRest -= 1;
  if (z.sigRest <= 0) {
    z.sigRest = rundenAusMs(k.content, def.attacks.signature.intervalMs);
    ansagen(k, boss, 'signatur', def.attacks.signature.handler ?? 'signatur');
    return;
  }
  if (z.teleRest <= 0) {
    z.teleRest = rundenAusMs(k.content, def.attacks.telegraph.intervalMs);
    ansagen(k, boss, 'telegraph', 'telegraph');
    return;
  }
  if (z.pulsRest <= 0) {
    z.pulsRest = rundenAusMs(k.content, def.attacks.pulse.intervalMs);
    puls(k, boss);
    return;
  }
  standard(k, boss);
}
