// Wirksame Werte einer Figur (5.1, 5.6, 6.3): Grundwerte plus Buffs, Debuffs und Kappungen.
import { STAT_IDS } from '../content/ids';
import type { ElementId, StatId, StatusId } from '../content/ids';
import type { Content } from '../content/loader';
import { heroMitigation } from '../formulas';
import type { StatBlock } from '../stats';
import type { Figur, Kampf } from './typen';

const PROZENT = 100;

function istStatId(s: string): s is StatId {
  return (STAT_IDS as readonly string[]).includes(s);
}

export function statusWert(c: Content, id: StatusId, name: string): number {
  return c.statusById[id]?.params?.[name] ?? 0;
}

export function hatStatus(f: Figur, id: StatusId): boolean {
  return f.status.some((s) => s.id === id);
}

export function stapel(f: Figur, id: StatusId): number {
  return f.status.filter((s) => s.id === id).reduce((n, s) => n + s.stapel, 0);
}

/** Werte mit allen laufenden Effekten. Kraft-Buffs addieren sich, alles andere multipliziert (5.1). */
export function werte(k: Kampf, f: Figur): StatBlock {
  const caps = k.content.balance.stats.caps;
  const st = { ...f.grundwerte };
  st.krt = Math.min(st.krt, caps.krt);
  let kraftSumme = 0;
  for (const s of f.status) {
    for (const m of s.mods ?? []) {
      if (!istStatId(m.stat)) continue;
      if (m.stat === 'kra' && m.mult !== undefined) kraftSumme += m.mult - 1;
      else if (m.mult !== undefined) st[m.stat] *= m.mult;
      if (m.add !== undefined) st[m.stat] += m.add;
    }
  }
  st.kra *= 1 + kraftSumme;
  const bruch = stapel(f, 'ruestungsbruch');
  if (bruch > 0) {
    const faktor = Math.max(0, 1 - (bruch * statusWert(k.content, 'ruestungsbruch', 'armorResMalusPctPerStack')) / PROZENT);
    st.rue *= faktor;
    st.res *= faktor;
  }
  st.tmp = Math.min(st.tmp, caps.tmp);
  st.krt = Math.min(st.krt, caps.krtBuffed);
  st.ksd = Math.min(st.ksd, caps.ksd);
  st.ele = Math.min(st.ele, caps.ele);
  return st;
}

/**
 * Initiative einer Figur: Tempo, bei Gleichstand entscheidet die kleinere ID (ENTWURF 1.2).
 * Angriffstempo-Mali (Frost) zählen hier, weil es im Rundenkampf kein Angriffstempo gibt (OPEN-060).
 */
export function initiative(k: Kampf, f: Figur): number {
  let tmp = werte(k, f).tmp;
  for (const s of f.status) {
    const pct = statusWert(k.content, s.id, 'attackSpeedMalusPct');
    if (pct > 0) tmp *= Math.max(0, 1 - pct / PROZENT);
  }
  return tmp;
}

function modSumme(f: Figur, stat: string, start: number): number {
  let x = start;
  for (const s of f.status) for (const m of s.mods ?? []) if (m.stat === stat && m.mult !== undefined) x *= m.mult;
  return x;
}

/** Anteil eines Statusparameters über alle Stapel, als Faktor (1 + Prozent/100 je Stapel). */
function paramFaktor(k: Kampf, f: Figur, name: string, vorzeichen: 1 | -1, jeStapel: boolean): number {
  let x = 1;
  for (const s of f.status) {
    const pct = statusWert(k.content, s.id, name);
    if (pct <= 0) continue;
    x *= 1 + (vorzeichen * (pct / PROZENT)) * (jeStapel ? s.stapel : 1);
  }
  return Math.max(0, x);
}

/** Multiplikator auf ausgeteilten Schaden (Buffs wie Adlerauge, Raserei, Blendung). */
export function schadenAusMult(k: Kampf, f: Figur): number {
  return modSumme(f, 'dmgDealt', 1)
    * paramFaktor(k, f, 'dmgDealtPct', 1, true)
    * paramFaktor(k, f, 'dmgDealtMalusPct', -1, false);
}

/**
 * Multiplikator auf erlittenen Schaden (Bollwerk, Spott-Schutz, Verteidigen). Ist bekannt, ob der
 * Treffer physisch ist, zählen auch die Boss-Passiven Steinhaut und Schattenhülle mit (10.6).
 */
export function schadenEinMult(k: Kampf, f: Figur, physisch?: boolean): number {
  const vert = f.verteidigt ? k.content.runden.verteidigen.schadenMult : 1;
  const b = f.boss;
  const passiv = b === undefined || physisch === undefined ? 1 : physisch ? b.einMultPhys : b.einMultElem;
  return modSumme(f, 'dmgTaken', 1) * vert * passiv
    * paramFaktor(k, f, 'dmgTakenPct', 1, false)
    * paramFaktor(k, f, 'dmgTakenPctPerStack', 1, true);
}

/** Elementfaktor des Angriffs gegen das Element des Ziels (6.2). */
export function elementFaktor(k: Kampf, angriff: ElementId, ziel: Figur): number {
  if (angriff === 'physisch' || ziel.element === 'physisch') return 1;
  const def = k.content.elementById[ziel.element];
  const e = k.content.engine.elements;
  if (def.weakTo === angriff) return e.weakMult;
  if (angriff === ziel.element) {
    const ignoriert = hatStatus(ziel, 'runenbruch') && statusWert(k.content, 'runenbruch', 'ignoreElementResist') > 0;
    return ignoriert ? 1 : e.resistMult;
  }
  return 1;
}

/** Anteil, um den ein Treffer beim Ziel gemindert wird (5.6). */
export function minderung(k: Kampf, ziel: Figur, physisch: boolean, angriffsstufe: number): number {
  if (ziel.seite === 'held') {
    const st = werte(k, ziel);
    return heroMitigation(k.content.balance, physisch ? st.rue : st.res, angriffsstufe);
  }
  let m = physisch ? ziel.rueMit : ziel.resMit;
  const bruch = stapel(ziel, 'ruestungsbruch');
  if (bruch > 0) {
    m *= Math.max(0, 1 - (bruch * statusWert(k.content, 'ruestungsbruch', 'armorResMalusPctPerStack')) / PROZENT);
  }
  return m;
}

/** Kann die Figur in dieser Runde handeln? Betäubung und Einfrieren blockieren (6.3). */
export function kannHandeln(k: Kampf, f: Figur): boolean {
  if (f.tot) return false;
  return !f.status.some((s) => statusWert(k.content, s.id, 'blocksActions') > 0);
}
