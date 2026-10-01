// Gegner-KI (6.6, 9.3, 9.4, 9.7): Zielwahl, Bewegung, Angriffsplätze, Angriffe, Elite-Großangriff.
import { updateBoss } from './boss';
import { foeHit } from './combat';
import { attackRate, canAct, moveMult } from './effstats';
import { getHandler } from './handlers';
import type { Unit, World } from './types';
import { MS_PER_S, dist, livingHeroes, nearest, unitById } from './util';

/** Ist der Spott noch aktiv und lebt der Spötter? */
function tauntTarget(w: World, u: Unit): Unit | undefined {
  const f = u.foe!;
  if (f.tauntById === null || w.t >= f.tauntUntil) return undefined;
  const t = unitById(w, f.tauntById);
  return t && !t.dead ? t : undefined;
}

/** Zielwahl nach Bedrohung (6.6): höchste Bedrohung, Wechsel erst über 110 % des aktuellen Ziels. */
export function threatTarget(w: World, u: Unit): Unit | undefined {
  const f = u.foe!;
  const heroes = livingHeroes(w);
  if (heroes.length === 0) return undefined;
  const taunt = tauntTarget(w, u);
  if (taunt) return taunt;
  const threat = (h: Unit) => f.threat.get(h.id) ?? 0;
  let best: Unit | undefined;
  for (const h of heroes) {
    if (!best || threat(h) > threat(best) || (threat(h) === threat(best) && dist(u, h) < dist(u, best))) best = h;
  }
  const current = unitById(w, f.targetId);
  if (!current || current.dead || current.side !== 'hero') {
    return best && threat(best) > 0 ? best : nearest(u, heroes);
  }
  if (best && best.id !== current.id && threat(best) > threat(current) * w.content.balance.combat.threatSwitch) return best;
  return current;
}

function isRanged(u: Unit): boolean {
  const ai = u.foe!.ai;
  return ai === 'ranged' || ai === 'support';
}

function stepToward(w: World, u: Unit, x: number, y: number, speed: number): void {
  const dt = w.tickMs / MS_PER_S;
  const dx = x - u.x;
  const dy = y - u.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return;
  const s = Math.min(d, speed * dt);
  u.x += (dx / d) * s;
  u.y += (dy / d) * s;
  if (Math.abs(dx) >= 1) u.face = dx > 0 ? 1 : -1;
  u.state = 'walk';
  u.stateUntil = w.t + w.tickMs;
}

/** Nahkämpfer, die einen Helden gerade angreifen (Angriffsplätze, 9.4). */
function engagedMelee(w: World, target: Unit): Unit[] {
  return w.units
    .filter((o) => o.foe && !o.dead && !isRanged(o) && o.foe.targetId === target.id && dist(o, target) <= o.foe.rangePx)
    .sort((a, b) => dist(a, target) - dist(b, target) || a.id - b.id);
}

function moveFoe(w: World, u: Unit, t: Unit): void {
  const f = u.foe!;
  const e = w.content.engine.enemy;
  const speed = (f.rushing ? w.content.balance.stage.rushSpeed : f.speed) * moveMult(w, u);
  if (speed <= 0) return;
  const d = dist(u, t);
  if (isRanged(u)) {
    if (d <= f.rangePx) return;
    const hold = f.rangePx * e.holdRangeFraction;
    stepToward(w, u, t.x + f.side * Math.sqrt(Math.max(0, hold * hold - (t.y - u.y) ** 2)), u.y + (t.y - u.y) / 2, speed);
    return;
  }
  if (d <= f.rangePx) return;
  const engaged = engagedMelee(w, t);
  if (engaged.length >= w.content.balance.combat.meleeSlots && !engaged.includes(u)) {
    // Platz belegt: im Abstand Reichweite + Kreisbahn warten und nachrücken, sobald ein Platz frei wird
    const ring = f.rangePx + e.meleeOrbitPx;
    if (d > ring) stepToward(w, u, t.x + Math.sign(u.x - t.x || f.side) * ring, u.y, speed);
    return;
  }
  stepToward(w, u, t.x + Math.sign(u.x - t.x || f.side) * f.rangePx * e.holdRangeFraction, t.y, speed);
}

function basicAttack(w: World, u: Unit, t: Unit): void {
  const f = u.foe!;
  foeHit(w, u, t, {
    amount: f.dmgPerHit, physical: f.physical, element: u.element, attackerLevel: w.scenario.attackerLevel(w),
  });
  u.face = t.x >= u.x ? 1 : -1;
  u.state = 'attack';
  u.stateUntil = w.t + w.tickMs * 2 * 2;
}

export function updateEnemy(w: World, u: Unit): void {
  const f = u.foe!;
  const def = f.type === 'boss' ? undefined : w.content.enemyById[f.type];
  for (const h of def?.handlers ?? []) getHandler(h.id)?.update?.(w, u, h.params);
  if (u.dead) return;
  if (f.isElite && f.affix) getHandler(f.affix)?.update?.(w, u, w.content.elite.affixParams[f.affix] ?? {});
  f.attackCdLeft -= w.tickMs * attackRate(w, u);
  if (!canAct(u)) return;
  if (f.isElite) getHandler('elite_slam')?.update?.(w, u, {});
  const t = isRanged(u) ? (tauntTarget(w, u) ?? nearest(u, livingHeroes(w))) : threatTarget(w, u);
  if (!t) return;
  f.targetId = t.id;
  if (f.ai !== 'bomber' || f.hs['fuseAt'] === undefined) moveFoe(w, u, t);
  if (f.attackCdLeft > 0 || f.ai === 'bomber') return;
  let victim: Unit | undefined = t;
  if (isRanged(u) && !tauntTarget(w, u)) {
    const inRange = livingHeroes(w).filter((h) => dist(u, h) <= f.rangePx);
    victim = inRange.length > 0 ? w.rng.pick(inRange) : undefined;
  } else if (dist(u, t) > f.rangePx) {
    victim = undefined;
  }
  if (!victim) return;
  f.attackCdLeft = f.intervalMs;
  const custom = def?.handlers.find((h) => getHandler(h.id)?.attack);
  if (custom && getHandler(custom.id)!.attack!(w, u, victim, custom.params)) return;
  basicAttack(w, u, victim);
}

/** Schritt 2 der Tick-Reihenfolge (11.7): Gegner-KI und Bosse. */
export function updateFoes(w: World): void {
  for (const u of [...w.units]) {
    if (u.dead || !u.foe || u.foe.ai === 'dummy') continue;
    if (u.kind === 'boss') updateBoss(w, u);
    else updateEnemy(w, u);
  }
}
