// Helden in der Simulation anlegen: Fähigkeiten mit Artefakt-Änderungen, Formation, Werte (4, 6.5, 7.7).
import type { ClassId } from '../content/ids';
import type { Content } from '../content/loader';
import type { SkillDef } from '../content/schemas';
import { refreshMaxHp } from './actions';
import { getHandler } from './handlers';
import { applyModifyValue } from './handlers/modifyValue';
import type { ModTarget } from './handlers/modifyValue';
import type { HeroBalance, HeroSetup, Unit, Vec, World } from './types';
import { PERCENT, newId } from './util';

export interface HeroDefs {
  defs: Map<string, SkillDef>;
  balance: HeroBalance;
  buffDurationAddMs: number;
}

/** Fähigkeiten und Werte eines Helden nach Artefakt-Effekten (modifyValue gilt nur für den Träger). */
export function buildHeroDefs(content: Content, classId: ClassId, artifacts: HeroSetup['artifacts']): HeroDefs {
  const defs = new Map<string, SkillDef>();
  for (const id of content.classById[classId].skills) {
    const def = content.skillById.get(id);
    if (def) defs.set(id, structuredClone(def));
  }
  const b = content.balance.combat;
  const t: ModTarget = {
    defs,
    balance: {
      potionPct: b.potion.pct,
      potionCooldownS: b.potion.cooldownS,
      rollPx: b.roll.px,
      rollCooldownS: b.roll.cooldownS,
      reviveChannelS: b.revive.channelS,
    },
    buffDurationAddMs: 0,
  };
  for (const a of artifacts) {
    if (a.rank < 1) continue;
    const def = content.artifactById.get(`${classId}_${a.slot}`);
    if (def?.effect.k === 'handler' && def.effect.id === 'modifyValue') applyModifyValue(t, def.effect.params);
  }
  return { defs, balance: t.balance, buffDurationAddMs: t.buffDurationAddMs };
}

export interface AddHeroOpts {
  x: number;
  y?: number;
  /** Laufende Nummer derselben Klasse in der Party (Versatz in der Tiefe, 6.5). */
  sameClassIndex?: number;
  solo: boolean;
}

export function addHero(w: World, setup: HeroSetup, o: AddHeroOpts): Unit {
  const c = w.content;
  const cls = c.classById[setup.classId];
  const hd = buildHeroDefs(c, setup.classId, setup.artifacts);
  const id = newId(w);
  w.heroSkillDefs.set(id, hd.defs);
  let passiveMoveMult = 1;
  let rollCooldownS = hd.balance.rollCooldownS;
  const skills = cls.skills.map((sid) => {
    const def = hd.defs.get(sid)!;
    if (def.slot === 'passive') {
      for (const e of def.effects) {
        if (e.k === 'buff' && e.stat === 'moveSpeed' && e.ms === 0 && e.mult) passiveMoveMult *= e.mult;
        if (e.k === 'handler') {
          const m = getHandler(e.id);
          if (m?.rollCooldownS) rollCooldownS = Math.min(rollCooldownS, m.rollCooldownS(e.params));
        }
      }
    }
    const autocast = def.slot === 'auto' ? true : (setup.autocast[sid] ?? def.autoCast?.default ?? false);
    return { def, slot: def.slot, cdLeft: 0, autocast };
  });
  const k = o.sameClassIndex ?? 0;
  const depthStep = c.balance.movement.sameClassDepthPx;
  const offsetY = k === 0 ? 0 : (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * depthStep;
  const center = c.engine.world.bandDepthPx / 2;
  const u: Unit = {
    id, kind: 'hero', side: 'hero', x: o.x, y: o.y ?? center + offsetY, face: 1,
    hp: 1, maxHp: 1, dead: false, state: 'idle', stateUntil: 0,
    element: setup.sets[setup.activeSet].element, armorMit: 0, resMit: 0, statuses: [], shields: [],
    hero: {
      playerId: setup.playerId, dbId: setup.dbId, name: setup.name, classId: setup.classId, level: setup.level,
      appearance: setup.appearance ?? null, sets: setup.sets, activeSet: setup.activeSet,
      swapUntil: 0, swapLockUntil: 0, skills, balance: hd.balance, buffDurationAddMs: hd.buffDurationAddMs,
      potionCharges: c.balance.combat.potion.charges, potionReadyAt: 0, autoPotion: setup.autoPotion,
      autoDodge: setup.autoDodge ?? true,
      rollReadyAt: 0, rollUntil: 0, rollDir: { x: 1, y: 0 }, focusId: null,
      input: { mx: 0, my: 0, moveTo: null, lastInputAt: 0 }, manualUntil: 0,
      formationOffsetX: cls.formationOffsetPx, formationOffsetY: offsetY,
      connected: true, disconnectedAt: 0, reviveTargetId: null, reviveDoneAt: 0, nextHitBonusPct: 0,
      elementarflussReadyAt: 0, trapIds: [], soloMult: o.solo ? cls.solo : 1, passiveMoveMult, rollCooldownS,
      meter: { damage: 0, healing: 0, kCoef: 0, hits: 0, deaths: 0, damageTaken: 0 },
    },
  };
  w.units.push(u);
  refreshMaxHp(w, u, 1);
  u.hp = u.maxHp;
  return u;
}

/** Platziert einen Helden auf seinem Formationsplatz relativ zu einem Punkt. */
export function placeInFormation(u: Unit, anchor: Vec): void {
  if (!u.hero) return;
  u.x = anchor.x + u.hero.formationOffsetX;
  u.y = anchor.y + u.hero.formationOffsetY;
}

/** Nummer je Klasse für mehrere Helden derselben Klasse (6.5). */
export function sameClassIndices(setups: HeroSetup[]): number[] {
  const seen = new Map<ClassId, number>();
  return setups.map((s) => {
    const k = seen.get(s.classId) ?? 0;
    seen.set(s.classId, k + 1);
    return k;
  });
}

/** Werte eines Helden im laufenden Run aktualisieren (Stufenaufstieg, 12.1): Lebensanteil bleibt, dann Heilung. */
export function updateHeroSetup(w: World, u: Unit, setup: HeroSetup, healPct = 0): void {
  const h = u.hero;
  if (!h) return;
  const frac = u.maxHp > 0 ? u.hp / u.maxHp : 1;
  h.level = setup.level;
  h.sets = setup.sets;
  if (!h.sets[h.activeSet].hasWeapon && h.sets[h.activeSet === 'A' ? 'B' : 'A'].hasWeapon) h.activeSet = h.activeSet === 'A' ? 'B' : 'A';
  u.element = h.sets[h.activeSet].element;
  refreshMaxHp(w, u, frac);
  if (healPct > 0 && !u.dead) u.hp = Math.min(u.maxHp, u.hp + Math.round((u.maxHp * healPct) / PERCENT));
}

/** Held verlässt den Run (2.4, 11.5): Einheit entfernen, n neu setzen. */
export function removeHeroUnit(w: World, unitId: number): void {
  const before = w.units.length;
  w.units = w.units.filter((u) => u.id !== unitId);
  if (w.units.length !== before) w.removed.push(unitId);
  w.heroSkillDefs.delete(unitId);
}
