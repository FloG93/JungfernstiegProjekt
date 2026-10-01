// Gegner erzeugen (9.3, 9.4, 9.6, 9.7): Werte nach Stage, Gruppengröße, Elite und Affix.
import type { ElementId, EnemyId, HandlerId } from '../content/ids';
import type { Content } from '../content/loader';
import { enemyDps, enemyLife, enemyLifeFactor } from '../formulas';
import { addShield } from './combat';
import { getHandler } from './handlers';
import type { Unit, World } from './types';
import { MS_PER_S, PERCENT, newId } from './util';

/** Element eines Kapitels = Element seines Bosses (3.1). */
export function chapterElement(content: Content, chapter: number): ElementId {
  const b = content.bosses.find((x) => x.chapter === chapter);
  if (!b) throw new Error(`Kapitel ${chapter} ohne Boss`);
  return b.element;
}

export interface EnemySpec {
  type: EnemyId;
  /** Elite: Affix-Handler (9.7). */
  eliteAffix?: HandlerId;
  x: number;
  y: number;
  /** Gegnerstufe Lv (9.4): Stage-Nummer, bei Boss-Adds 5 × Kapitel. */
  level: number;
  chapter: number;
  /** Gruppenstärke für den Lebensfaktor H(n). */
  n: number;
  encounter: number;
  side: -1 | 1;
  /** Einführungsfaktor auf Leben und Schaden (4.3). */
  introMult?: number;
  kind?: 'enemy' | 'add';
}

export function spawnEnemy(w: World, s: EnemySpec): Unit {
  const c = w.content;
  const def = c.enemyById[s.type];
  const b = c.balance;
  const elite = s.eliteAffix !== undefined;
  const ed = c.elite;
  const intro = s.introMult ?? 1;
  const hpMult = elite ? ed.hpMult : def.hpMult;
  const dmgMult = elite ? ed.dmgMult : def.dmgMult;
  const hp = Math.max(1, Math.round(enemyLife(b, s.level) * hpMult * enemyLifeFactor(b, s.n) * intro));
  const element: ElementId = def.element === 'kapitel' ? chapterElement(c, s.chapter) : 'physisch';
  const u: Unit = {
    id: newId(w), kind: s.kind ?? 'enemy', side: 'foe', x: s.x, y: s.y, face: s.side === 1 ? -1 : 1,
    hp, maxHp: hp, dead: false, state: 'walk', stateUntil: 0, element,
    armorMit: elite ? ed.armorMit : def.armorMit, resMit: elite ? ed.resMit : def.resMit, statuses: [], shields: [],
    foe: {
      type: s.type, level: s.level,
      dmgPerHit: enemyDps(b, s.level) * dmgMult * def.intervalS * intro,
      intervalMs: def.intervalS * MS_PER_S, rangePx: def.rangePx, speed: def.speed, ai: def.ai,
      attackCdLeft: def.intervalS * MS_PER_S, threat: new Map(), targetId: null, tauntById: null, tauntUntil: 0,
      weight: elite ? ed.weight : def.weight, encounter: s.encounter, isElite: elite, affix: s.eliteAffix ?? null,
      physical: element === 'physisch', hs: {}, rushing: false, spawnedAt: w.t, side: s.side,
    },
  };
  w.units.push(u);
  for (const h of def.handlers) getHandler(h.id)?.setup?.(w, u, h.params);
  if (elite) {
    u.foe!.hs['slamAt'] = w.t + ed.slam.everyS * MS_PER_S;
    const ap = ed.affixParams[s.eliteAffix!] ?? {};
    getHandler(s.eliteAffix!)?.setup?.(w, u, ap);
  }
  return u;
}

/** Schild eines Gegners mit Kennung (Wächter, Elite-Affix), ersetzt einen vorhandenen gleicher Kennung. */
export function setFoeShield(w: World, u: Unit, pctMaxHp: number, tag: string): void {
  u.shields = u.shields.filter((s) => s.tag !== tag);
  addShield(w, u, u, (u.maxHp * pctMaxHp) / PERCENT, Infinity, tag);
}
