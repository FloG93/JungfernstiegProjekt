// Wirksame Werte mit Buffs und Debuffs (5.5, 6.3). Obergrenzen zuletzt (5.1).
import { STAT_IDS } from '../content/ids';
import type { ElementId, StatId, StatusId } from '../content/ids';
import type { StatBlock } from '../stats';
import type { Unit, World } from './types';
import { PERCENT, statusStacks } from './util';

export function statusParam(w: World, id: StatusId, key: string): number {
  return w.content.statusById[id].params[key] ?? 0;
}

/** Wert eines Status-Parameters, den `value` einer Fähigkeit überschreiben kann (E-009). */
export function statusValue(w: World, u: Unit, id: StatusId, key: string): number {
  const st = u.statuses.find((s) => s.id === id);
  if (!st) return 0;
  return st.value ?? statusParam(w, id, key);
}

function isStatId(s: string): s is StatId {
  return (STAT_IDS as readonly string[]).includes(s);
}

/** Werte eines Helden mit allen aktiven Buffs und Debuffs, mit Obergrenzen. */
export function heroStats(w: World, u: Unit): StatBlock {
  const h = u.hero;
  if (!h) throw new Error('heroStats: keine Heldeneinheit');
  const caps = w.content.balance.stats.caps;
  const st = { ...h.sets[h.activeSet].stats };
  // Der statische Anteil der Krit-Chance bleibt bei 60 %, Buffs heben bis 75 % (5.1).
  st.krt = Math.min(st.krt, caps.krt);
  let kraSum = 0;
  for (const s of u.statuses) {
    for (const m of s.mods ?? []) {
      if (!isStatId(m.stat)) continue;
      if (m.stat === 'kra' && m.mult !== undefined) kraSum += m.mult - 1;
      else if (m.mult !== undefined) st[m.stat] *= m.mult;
      if (m.add !== undefined) st[m.stat] += m.add;
    }
  }
  st.kra *= 1 + kraSum;
  const rb = statusStacks(u, 'ruestungsbruch');
  if (rb > 0) {
    const f = 1 - (rb * statusParam(w, 'ruestungsbruch', 'armorResMalusPctPerStack')) / PERCENT;
    st.rue *= Math.max(0, f);
    st.res *= Math.max(0, f);
  }
  st.tmp = Math.min(st.tmp, caps.tmp);
  st.krt = Math.min(st.krt, caps.krtBuffed);
  st.ksd = Math.min(st.ksd, caps.ksd);
  st.ele = Math.min(st.ele, caps.ele);
  return st;
}

/** Kraft_eff = Kraft × (1 + Kraft-Buffs) × Einzelkämpfer-Multiplikator (5.6). */
export function kraftEff(w: World, u: Unit): number {
  return heroStats(w, u).kra * (u.hero?.soloMult ?? 1);
}

/** Summierter Abzug der Verlangsamungen (Frost, Malus), bei Bossen höchstens 40 % (6.4). */
function slowFactor(w: World, u: Unit, kind: 'attack' | 'move'): number {
  let f = 1;
  if (u.statuses.some((s) => s.id === 'frost')) {
    f *= 1 - statusParam(w, 'frost', kind === 'attack' ? 'attackSpeedMalusPct' : 'moveSpeedMalusPct') / PERCENT;
  }
  const malusId: StatusId = kind === 'attack' ? 'angriffstempo_malus' : 'bewegung_malus';
  if (u.statuses.some((s) => s.id === malusId)) {
    f *= 1 - statusValue(w, u, malusId, kind === 'attack' ? 'attackSpeedMalusPct' : 'moveSpeedMalusPct') / PERCENT;
  }
  if (u.kind === 'boss') f = Math.max(f, 1 - w.content.balance.boss.slowCapPct / PERCENT);
  return Math.max(0, f);
}

/** Tempo-Faktor (1 + TMP ÷ 100) für Automatikangriff und Abklingzeiten (4.4). */
export function tempoFactor(w: World, u: Unit): number {
  return u.hero ? 1 + heroStats(w, u).tmp / PERCENT : 1;
}

/** Wie schnell der Automatikangriff bzw. das Angriffsintervall abläuft. */
export function attackRate(w: World, u: Unit): number {
  let r = tempoFactor(w, u) * slowFactor(w, u, 'attack');
  if (u.foe?.affix === 'affix_rasend' && u.hp / u.maxHp < (u.foe.hs['rasendBelow'] ?? 0)) {
    r *= 1 + (u.foe.hs['rasendSpeed'] ?? 0);
  }
  return r;
}

/** Wie schnell Abklingzeiten ablaufen: Tempo, Schock 25 % langsamer (6.3). */
export function cooldownRate(w: World, u: Unit): number {
  let r = tempoFactor(w, u);
  if (u.statuses.some((s) => s.id === 'schock')) r *= 1 - statusParam(w, 'schock', 'cooldownSlowPct') / PERCENT;
  return r;
}

export function canMove(u: Unit): boolean {
  return !u.dead && !u.statuses.some((s) => s.id === 'betaeubung' || s.id === 'eingefroren' || s.id === 'wurzel');
}

export function canAct(u: Unit): boolean {
  return !u.dead && !u.statuses.some((s) => s.id === 'betaeubung' || s.id === 'eingefroren');
}

export function canUseAbilities(u: Unit): boolean {
  return canAct(u) && !u.statuses.some((s) => s.id === 'furcht');
}

/** Bewegungs-Multiplikator (Buffs, Frost, Malus, Eisfläche). */
export function moveMult(w: World, u: Unit): number {
  if (!canMove(u)) return 0;
  let m = u.hero?.passiveMoveMult ?? 1;
  for (const s of u.statuses) for (const mod of s.mods ?? []) if (mod.stat === 'moveSpeed' && mod.mult) m *= mod.mult;
  m *= slowFactor(w, u, 'move');
  if (u.foe?.affix === 'affix_rasend' && u.hp / u.maxHp < (u.foe.hs['rasendBelow'] ?? 0)) {
    m *= 1 + (u.foe.hs['rasendSpeed'] ?? 0);
  }
  return m;
}

export function rangeBonus(u: Unit): number {
  let r = 0;
  for (const s of u.statuses) for (const m of s.mods ?? []) if (m.stat === 'rangePx' && m.add) r += m.add;
  return r;
}

/** Eigene Schadensmodifikatoren des Angreifers (Adlerauge, Raserei, Blendung). */
export function dmgDealtMult(w: World, u: Unit): number {
  let m = 1;
  for (const s of u.statuses) for (const mod of s.mods ?? []) if (mod.stat === 'dmgDealt' && mod.mult) m *= mod.mult;
  if (u.statuses.some((s) => s.id === 'raserei')) m *= 1 + statusValue(w, u, 'raserei', 'dmgDealtPct') / PERCENT;
  if (u.statuses.some((s) => s.id === 'blendung')) m *= 1 - statusParam(w, 'blendung', 'dmgDealtMalusPct') / PERCENT;
  return m;
}

/** Nur die Buffs des Angreifers (für die Messung von K, Adlerauge zählt dort mit, 13.2). */
export function selfBuffDealtMult(u: Unit): number {
  let m = 1;
  for (const s of u.statuses) for (const mod of s.mods ?? []) if (mod.stat === 'dmgDealt' && mod.mult) m *= mod.mult;
  return m;
}

/** Erlittener Schaden: Verderbnis, Runenbruch, Spott-Schutz, Bollwerk, Resonanz. */
export function dmgTakenMult(w: World, u: Unit): number {
  let m = 1;
  for (const s of u.statuses) for (const mod of s.mods ?? []) if (mod.stat === 'dmgTaken' && mod.mult) m *= mod.mult;
  const vd = statusStacks(u, 'verderbnis');
  if (vd > 0) m *= 1 + (vd * statusParam(w, 'verderbnis', 'dmgTakenPctPerStack')) / PERCENT;
  if (u.statuses.some((s) => s.id === 'runenbruch')) m *= 1 + statusValue(w, u, 'runenbruch', 'dmgTakenPct') / PERCENT;
  if (u.side === 'hero') m *= 1 - resonancePct(w, u) / PERCENT;
  return m;
}

/** Resonanz (4.10): Verbündete unter einem Buff eines Runenwebers erleiden weniger Schaden. */
function resonancePct(w: World, u: Unit): number {
  let best = 0;
  for (const s of u.statuses) {
    if (!s.fromHero || s.srcClass !== 'runenweber' || w.content.statusById[s.id].kind !== 'buff') continue;
    const src = w.units.find((x) => x.id === s.srcId);
    const skillDefs = src ? w.heroSkillDefs.get(src.id) : undefined;
    if (!skillDefs) continue;
    for (const def of skillDefs.values()) {
      for (const e of def.effects) {
        if (e.k === 'handler' && e.id === 'buffedDamageReduction') best = Math.max(best, Number(e.params['pct'] ?? 0));
      }
    }
  }
  return best;
}

/** Elementfaktor (6.1): ×1,5 vom Gegenelement, ×0,5 vom eigenen, Runenbruch hebt 0,5 auf. */
export function elementFactor(w: World, attack: ElementId, target: Unit): number {
  if (attack === 'physisch' || target.element === 'physisch') return 1;
  const el = w.content.elementById[target.element];
  const e = w.content.engine.elements;
  if (el.weakTo === attack) return e.weakMult;
  if (attack === target.element) {
    const ignores = target.statuses.some((s) => s.id === 'runenbruch') && statusParam(w, 'runenbruch', 'ignoreElementResist') > 0;
    return ignores ? 1 : e.resistMult;
  }
  return 1;
}

/** Mitigation eines Gegners gegen Helden-Schaden, mit Rüstungsbruch und Boss-Passiv (6.2, 6.3, 10.6). */
export function foeMitigation(w: World, u: Unit, physical: boolean): number {
  let m = physical ? u.armorMit : u.resMit;
  const rb = statusStacks(u, 'ruestungsbruch');
  if (rb > 0) m *= Math.max(0, 1 - (rb * statusParam(w, 'ruestungsbruch', 'armorResMalusPctPerStack')) / PERCENT);
  return m;
}
