// Schaden, Heilung, Schilde und Tod (5.6, 6.3, 6.6, 6.8).
import type { ElementId, StatusId } from '../content/ids';
import { heroMitigation } from '../formulas';
import {
  dmgDealtMult, dmgTakenMult, elementFactor, foeMitigation, heroStats, kraftEff, selfBuffDealtMult, statusParam,
} from './effstats';
import { foeIncomingMult, heroPassiveHooks } from './handlers';
import { applyStatus, clearStatuses, removeStatus } from './status';
import type { ShieldInst, Unit, World } from './types';
import { MS_PER_S, PERCENT, emit, hasStatus, livingFoes } from './util';

export interface HeroHitOpts {
  coef: number;
  /** Element des Schadens (aktive Waffe, 4.4). */
  element: ElementId;
  canCrit?: boolean;
  /** Bedingter Bonus (Meucheln), zählt zu K (13.2). */
  condMult?: number;
  /** Treffer mit Waffe: kann den festen Effekt der Bosswaffe auslösen (8.5). */
  weaponHit?: boolean;
}

export function isInvulnerable(u: Unit): boolean {
  return u.statuses.some((s) => s.id === 'unverwundbar');
}

/** Direkter Treffer eines Helden über einen Koeffizienten (5.6). Gibt den verursachten Schaden zurück. */
export function heroHit(w: World, src: Unit, dst: Unit, o: HeroHitOpts): number {
  if (dst.dead || !src.hero || dst.side === src.side) return 0;
  const st = heroStats(w, src);
  const kraft = st.kra * src.hero.soloMult;
  const physical = o.element === 'physisch';
  const fElem = elementFactor(w, o.element, dst);
  let fCrit = 1;
  let crit = false;
  if (o.canCrit !== false && w.rng.chance(st.krt / PERCENT)) {
    crit = true;
    fCrit = st.ksd / PERCENT;
  }
  let cond = o.condMult ?? 1;
  if (src.hero.nextHitBonusPct > 0 && hasStatus(src, 'tarnung')) {
    cond *= 1 + src.hero.nextHitBonusPct / PERCENT;
    src.hero.nextHitBonusPct = 0;
    removeStatus(w, src, 'tarnung');
  }
  const mit = foeMitigation(w, dst, physical);
  const mult = dmgDealtMult(w, src) * dmgTakenMult(w, dst) * cond * foeIncomingMult(w, dst, physical);
  const raw = o.coef * kraft * (1 + st.ele / PERCENT) * fElem * fCrit * (1 - mit) * mult;
  const done = applyDamage(w, src, dst, raw, { crit, el: o.element });
  src.hero.meter.kCoef += o.coef * cond * fCrit * selfBuffDealtMult(src);
  src.hero.meter.hits++;
  if (o.weaponHit !== false) weaponProc(w, src, dst);
  return done;
}

/** Fester Effekt der Bosswaffe: 5 % je Treffer, nicht je Tick (8.5). */
function weaponProc(w: World, src: Unit, dst: Unit): void {
  const h = src.hero;
  if (!h || dst.dead) return;
  const bossId = h.sets[h.activeSet].effectBoss;
  if (!bossId) return;
  const wp = w.content.bossById[bossId].weapon;
  if (!w.rng.chance(wp.chance)) return;
  applyStatus(w, src, dst, wp.status, { stacks: wp.stacks, perStackTick: heroDotPerStackTick(w, src, wp.status) });
}

/** Schaden über Zeit eines Helden je Stapel und Tick: Koeffizient × Kraft_eff × (1 + ELE) (6.3, E-007). */
export function heroDotPerStackTick(w: World, src: Unit, id: StatusId, value?: number): number | undefined {
  const def = w.content.statusById[id];
  if (!def.tickMs || !src.hero) return undefined;
  const coef = value ?? def.params['heroCoefPerS'];
  if (coef === undefined) return undefined;
  const st = heroStats(w, src);
  const ele = def.kind === 'debuff' ? 1 + st.ele / PERCENT : 1;
  return coef * kraftEff(w, src) * ele * (def.tickMs / MS_PER_S);
}

export interface FoeHitOpts {
  amount: number;
  physical: boolean;
  element: ElementId;
  attackerLevel: number;
}

/** Treffer eines Gegners, Bosses oder einer Gefahr auf einen Helden (5.6). */
export function foeHit(w: World, src: Unit | null, dst: Unit, o: FoeHitOpts): number {
  if (dst.dead) return 0;
  const st = dst.hero ? heroStats(w, dst) : null;
  const wv = st ? (o.physical ? st.rue : st.res) : 0;
  const m = st ? heroMitigation(w.content.balance, wv, o.attackerLevel) : 0;
  const mult = (src ? dmgDealtMult(w, src) : 1) * dmgTakenMult(w, dst);
  const raw = o.amount * (1 - m) * mult;
  const done = applyDamage(w, src, dst, raw, { el: o.element });
  if (src?.foe?.affix === 'affix_blutsauger' && done > 0) {
    healUnit(w, src, src, done * (src.foe.hs['leechPct'] ?? 0), {});
  }
  return done;
}

export interface DotOpts {
  /** Für die Messung von K: Koeffizient je Stapel und Tick (Quelle Held). */
  coefPerStackTick?: number;
  stacks?: number;
  attackerLevel?: number;
}

/** Schaden über Zeit ohne Element: Resistenz mindert, bei Blutung Rüstung (6.4). */
export function dealDotDamage(w: World, src: Unit | null, dst: Unit, amount: number, physical: boolean, o: DotOpts): number {
  if (dst.dead) return 0;
  let raw: number;
  if (dst.side === 'foe') {
    raw = amount * (1 - foeMitigation(w, dst, physical)) * dmgTakenMult(w, dst) * foeIncomingMult(w, dst, physical);
  } else {
    const st = heroStats(w, dst);
    const m = heroMitigation(w.content.balance, physical ? st.rue : st.res, o.attackerLevel ?? w.scenario.attackerLevel(w));
    raw = amount * (1 - m) * dmgTakenMult(w, dst);
  }
  const done = applyDamage(w, src, dst, raw, { dot: true });
  if (src?.hero && o.coefPerStackTick !== undefined) src.hero.meter.kCoef += o.coefPerStackTick * (o.stacks ?? 1);
  return done;
}

interface ApplyMeta {
  crit?: boolean;
  el?: string;
  dot?: boolean;
}

/** Rundet, zieht Schilde ab (jüngstes zuerst), mindert Leben, meldet Treffer und Tod (5.6). */
export function applyDamage(w: World, src: Unit | null, dst: Unit, raw: number, meta: ApplyMeta): number {
  if (dst.dead) return 0;
  if (isInvulnerable(dst)) {
    emit(w, { e: 'hit', src: src?.id ?? 0, dst: dst.id, dmg: 0, el: meta.el });
    return 0;
  }
  let amount = Math.max(1, Math.round(raw));
  const total = amount;
  let absorbed = 0;
  for (let i = dst.shields.length - 1; i >= 0 && amount > 0; i--) {
    const sh = dst.shields[i]!;
    const a = Math.min(sh.amount, amount);
    sh.amount -= a;
    amount -= a;
    absorbed += a;
  }
  if (absorbed > 0) {
    dst.shields = dst.shields.filter((s) => s.amount > 0);
    if (dst.shields.length === 0) removeStatus(w, dst, 'schild');
  }
  dst.hp -= amount;
  const ev: { e: 'hit'; src: number; dst: number; dmg: number; crit?: boolean; el?: string; absorbed?: number; dot?: boolean } = {
    e: 'hit', src: src?.id ?? 0, dst: dst.id, dmg: total,
  };
  if (meta.crit) ev.crit = true;
  if (meta.el) ev.el = meta.el;
  if (absorbed) ev.absorbed = absorbed;
  if (meta.dot) ev.dot = true;
  emit(w, ev);
  if (src?.hero) src.hero.meter.damage += total;
  if (dst.hero) dst.hero.meter.damageTaken += total;
  if (src?.hero && dst.foe) addThreat(dst, src.id, total * w.content.classById[src.hero.classId].threat);
  if (dst.foe) dst.foe.hs['lastDamageAt'] = w.t;
  if (dst.hp <= 0) {
    if (dst.immortal) dst.hp = 1;
    else killUnit(w, dst, src);
  }
  return total;
}

export function addThreat(foe: Unit, heroId: number, amount: number): void {
  if (!foe.foe || amount <= 0) return;
  foe.foe.threat.set(heroId, (foe.foe.threat.get(heroId) ?? 0) + amount);
}

export interface HealOpts {
  /** Heileraktion: erzeugt Bedrohung (4.9, 6.6). */
  healerAction?: boolean;
}

/** Heilung (5.6): kann nicht kritisch treffen, Gift senkt erhaltene Heilung (6.3). */
export function healUnit(w: World, src: Unit | null, dst: Unit, amount: number, o: HealOpts): number {
  if (dst.dead || amount <= 0) return 0;
  let a = amount;
  if (hasStatus(dst, 'gift')) a *= 1 - statusParam(w, 'gift', 'healingReceivedMalusPct') / PERCENT;
  a = Math.round(a);
  if (a <= 0) return 0;
  const eff = Math.min(a, dst.maxHp - dst.hp);
  dst.hp += eff;
  const over = a - eff;
  if (eff > 0) emit(w, { e: 'heal', src: src?.id ?? 0, dst: dst.id, amount: eff });
  if (src?.hero) {
    src.hero.meter.healing += eff;
    if (over > 0) heroPassiveHooks(w, src).onOverheal?.(w, src, dst, over);
    if (o.healerAction && eff > 0) {
      const threat = eff * w.content.balance.combat.healThreat;
      for (const f of livingFoes(w)) addThreat(f, src.id, threat);
    }
  }
  return eff;
}

export function addShield(w: World, src: Unit | null, dst: Unit, amount: number, ms: number, tag?: string): void {
  if (dst.dead || amount <= 0) return;
  const had = dst.shields.length > 0;
  const sh: ShieldInst = { amount: Math.round(amount), createdAt: w.t, endsAt: w.t + ms, srcId: src?.id ?? 0 };
  if (tag) sh.tag = tag;
  dst.shields.push(sh);
  if (!had) emit(w, { e: 'fx', id: dst.id, fx: 'schild', add: true });
}

export function shieldTotal(u: Unit): number {
  let s = 0;
  for (const sh of u.shields) s += sh.amount;
  return s;
}

export function killUnit(w: World, u: Unit, killer: Unit | null): void {
  if (u.dead) return;
  u.hp = 0;
  u.dead = true;
  u.state = 'dead';
  clearStatuses(w, u);
  if (u.hero) {
    u.hero.meter.deaths++;
    u.hero.reviveTargetId = null;
  }
  emit(w, { e: 'death', id: u.id });
  w.scenario.onDeath?.(w, u, killer);
}

/** Belebt einen gefallenen Helden mit einem Anteil seines Max-Lebens wieder (4.4, 6.8). */
export function reviveUnit(w: World, u: Unit, pct: number): void {
  if (!u.dead || !u.hero) return;
  u.dead = false;
  u.hp = Math.max(1, Math.round((u.maxHp * pct) / PERCENT));
  u.state = 'idle';
  emit(w, { e: 'revive', id: u.id });
}
