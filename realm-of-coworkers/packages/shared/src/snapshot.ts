// Snapshots für Clients (11.7, 15.4): Delta je Empfänger, vollständig beim Beitritt und alle 5 s.
import type { RunStateDTO, SnapEntity, SnapZone, SnapshotMsg } from './protocol';
import { shieldTotal } from './sim/combat';
import type { RunScenario } from './sim/stage';
import type { Unit, World } from './sim/types';

const FX_ROUND_MS = 100;

function round(n: number): number {
  return Math.round(n);
}

function entityOf(w: World, u: Unit, own: boolean, withMeta: boolean): SnapEntity {
  const e: SnapEntity = {
    id: u.id, kind: u.kind, x: round(u.x), y: round(u.y), face: u.face, hp: Math.max(0, round(u.hp)), maxHp: round(u.maxHp),
    state: u.dead ? 'dead' : u.state,
  };
  const sh = shieldTotal(u);
  if (sh > 0) e.shield = round(sh);
  if (u.statuses.length > 0) {
    e.fx = u.statuses.map((s) => ({ id: s.id, stacks: s.stacks, ms: Math.max(0, Math.round((s.endsAt - w.t) / FX_ROUND_MS) * FX_ROUND_MS) }));
  }
  if (u.kind !== 'hero' || u.element !== 'physisch') e.el = u.element;
  if (own && u.hero) {
    e.cd = {};
    for (const s of u.hero.skills) if (s.slot !== 'passive') e.cd[s.def.id] = Math.ceil(s.cdLeft);
  }
  if (withMeta) {
    if (u.hero) {
      e.meta = { name: u.hero.name, cls: u.hero.classId, level: u.hero.level };
      const acc = Number(u.hero.playerId);
      if (Number.isFinite(acc)) e.meta.acc = acc;
    }
    else if (u.foe) {
      e.meta = { type: u.foe.type, level: u.foe.level };
      if (u.foe.isElite) e.meta.elite = true;
      if (u.foe.affix) e.meta.affix = u.foe.affix;
      if (u.foe.bossId) e.meta.boss = u.foe.bossId;
    }
  }
  return e;
}

export function zonesOf(w: World): SnapZone[] {
  return w.zones.map((z) => {
    const sz: SnapZone = {
      id: z.id, shape: z.shape, x: round(z.x), y: round(z.y), w: round(z.w), h: round(z.h),
      endsIn: Math.max(0, z.endsAt - w.t), total: z.endsAt - z.createdAt, kind: z.kind, hostile: z.affects === 'hero',
    };
    if (z.ang !== undefined) sz.ang = z.ang;
    if (z.label) sz.label = z.label;
    return sz;
  });
}

/** Angaben des Servers, die nicht in der Welt stehen (Helfer, Bereitschaft am Boss-Tor, Auto-Weiter). */
export interface RunExtra {
  helper: boolean;
  ready: number[];
  autoReadyIn: number | null;
}

export function runStateOf(w: World, s: RunScenario, ownUnitId: number | null, x: RunExtra): RunStateDTO {
  const boss = w.boss;
  const enr = boss && !boss.dead ? (boss.foe?.hs['enrageAt'] ?? 0) - w.t : null;
  const st: RunStateDTO = {
    phase: s.phase,
    anchorX: round(s.anchorX),
    cameraX: round(s.cameraX(w)),
    arena: s.kind === 'arena',
    worldWidth: s.kind === 'arena' && s.arena ? s.arena.widthPx : s.def.lengthPx,
    encounter: s.active?.idx ?? -1,
    encounters: s.def.encounters.length,
    checkpoint: s.checkpointIdx,
    autowalk: s.autowalk,
    paused: w.paused,
    countdownEndsIn: s.phase === 'countdown' ? Math.max(0, s.countdownEndsAt - w.t) : null,
    bossId: s.bossId,
    bossPhase: boss?.foe?.hs['phase'] ?? 0,
    enrageIn: enr !== null && (boss?.foe?.hs['enrage'] ?? 0) === 0 ? Math.max(0, enr) : null,
    wipes: s.wipes,
    kampfstufe: s.kampfstufe,
    ready: x.ready,
    autoReadyIn: x.autoReadyIn,
  };
  const me = w.units.find((u) => u.id === ownUnitId);
  if (me?.hero) {
    const h = me.hero;
    const autocast: Record<string, boolean> = {};
    for (const sk of h.skills) if (sk.slot !== 'passive' && sk.slot !== 'auto') autocast[sk.def.id] = sk.autocast;
    st.me = {
      unitId: me.id,
      potions: h.potionCharges,
      potionCd: Math.max(0, h.potionReadyAt - w.t),
      rollCd: Math.max(0, h.rollReadyAt - w.t),
      swapCd: Math.max(0, h.swapLockUntil - w.t),
      activeSet: h.activeSet,
      setElements: { A: h.sets.A.element, B: h.sets.B.hasWeapon ? h.sets.B.element : null },
      autocast,
      autoPotion: h.autoPotion,
      autoDodge: h.autoDodge,
      focusId: h.focusId,
      helper: x.helper,
      reviveDoneIn: h.reviveTargetId !== null && h.reviveDoneAt > 0 ? Math.max(0, h.reviveDoneAt - w.t) : null,
      autopilot: !h.connected,
    };
  }
  return st;
}

/** Zustand je Empfänger: zuletzt gesendete Einheiten (für Deltas). */
export class SnapshotTracker {
  private sent = new Map<number, string>();

  /**
   * Snapshot für einen Empfänger. `meta` (Name, Typ) kommt beim ersten Auftauchen und mit `withMeta`
   * (Beitritt, Wiederverbinden), nicht in den regelmäßigen vollständigen Snapshots.
   */
  build(w: World, s: RunScenario, ownUnitId: number | null, full: boolean, x: RunExtra, withMeta = full): SnapshotMsg {
    const ents: SnapEntity[] = [];
    const seen = new Set<number>();
    for (const u of w.units) {
      seen.add(u.id);
      const isNew = !this.sent.has(u.id);
      const e = entityOf(w, u, u.id === ownUnitId, withMeta || isNew);
      const { meta: _m, ...rest } = e;
      const key = JSON.stringify(rest);
      if (full || isNew || this.sent.get(u.id) !== key) ents.push(e);
      this.sent.set(u.id, key);
    }
    const rm: number[] = [];
    for (const id of [...this.sent.keys()]) {
      if (!seen.has(id)) {
        rm.push(id);
        this.sent.delete(id);
      }
    }
    return { t: 'run.snapshot', tick: w.tick, full, ents, rm, zones: zonesOf(w), run: runStateOf(w, s, ownUnitId, x) };
  }

  reset(): void {
    this.sent.clear();
  }
}
