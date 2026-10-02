// Anzeige eines Runs (11.7): Snapshots puffern, andere Einheiten mit 100 ms Verzögerung interpolieren (fehlt ein
// Snapshot, bis 250 ms extrapolieren), den eigenen Helden vorhersagen und bei mehr als 24 px Abweichung in 100 ms
// korrigieren. Kampfaktionen werden nicht vorhergesagt.
import type { EntityMeta, RunStartMsg, RunStateDTO, SnapEntity, SnapZone, SnapshotMsg } from '@aethra/shared';

export const INTERP_DELAY_MS = 100;
export const MAX_EXTRAPOLATE_MS = 250;
export const CORRECT_PX = 24;
export const CORRECT_MS = 100;
/** So viele Snapshots bestimmen den Uhrenabgleich (gleitendes Minimum). */
const OFFSET_WINDOW = 40;
/** Springt der Abstand um mehr als das, hat der Server gestockt: Abgleich neu beginnen. */
const STALL_MS = 1000;
/** So lange bleiben Positionen und entfernte Einheiten im Puffer. */
const KEEP_MS = 1500;
/** Nach dem Loslassen folgt der eigene Held wieder dem Server (Formation, Auto-Ausweichen). */
const FOLLOW_AFTER_MS = 300;
const FOLLOW_RATE = 8;
const HIST_MS = 1500;

export interface Sample {
  t: number;
  x: number;
  y: number;
}

export interface EntView {
  id: number;
  kind: SnapEntity['kind'];
  meta: EntityMeta;
  cur: SnapEntity;
  samples: Sample[];
  /** Simulationszeit der Entfernung (Tod eines Gegners, Verlassen), sonst null. */
  removedAt: number | null;
  firstSeen: number;
}

export interface ZoneView {
  z: SnapZone;
  startedAt: number;
  endsAt: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export class RunView {
  readonly ents = new Map<number, EntView>();
  zones: ZoneView[] = [];
  run: RunStateDTO | null = null;
  tick = 0;
  simT = 0;
  ownId: number | null = null;
  /** Clientzeit minus Simulationszeit (gleitendes Minimum). */
  offset = 0;
  snapshots = 0;
  private offsets: number[] = [];
  private wasPaused = false;
  readonly pred = { x: 0, y: 0, init: false, lastMoveAt: -1e9, cx: 0, cy: 0, cLeft: 0, rollUntil: 0, rollVx: 0, rollVy: 0 };
  private hist: { at: number; x: number; y: number }[] = [];

  constructor(
    readonly start: RunStartMsg,
    readonly bandDepth: number,
    /** Laufgeschwindigkeit in px/s (9.2: 220). */
    readonly moveSpeed: number,
    readonly rollPx: number,
    readonly rollMs: number,
  ) {}

  get tickMs(): number {
    return this.start.config.tickMs;
  }

  own(): EntView | undefined {
    return this.ownId !== null ? this.ents.get(this.ownId) : undefined;
  }

  // ---------- Snapshots ----------

  onSnapshot(m: SnapshotMsg, now: number, rttMs = 0): void {
    const simT = m.tick * this.tickMs;
    this.updateOffset(now - simT, m.run.paused);
    const seen = new Set<number>();
    for (const e of m.ents) {
      seen.add(e.id);
      let v = this.ents.get(e.id);
      if (!v || v.removedAt !== null) {
        v = { id: e.id, kind: e.kind, meta: e.meta ?? v?.meta ?? {}, cur: e, samples: [], removedAt: null, firstSeen: simT };
        this.ents.set(e.id, v);
      } else {
        if (e.meta) v.meta = e.meta;
        v.cur = e;
      }
      const last = v.samples[v.samples.length - 1];
      if (last && last.t === simT) {
        last.x = e.x;
        last.y = e.y;
      } else {
        v.samples.push({ t: simT, x: e.x, y: e.y });
      }
    }
    if (m.full) for (const v of this.ents.values()) if (!seen.has(v.id) && v.removedAt === null) v.removedAt = simT;
    for (const id of m.rm) {
      const v = this.ents.get(id);
      if (v && v.removedAt === null) v.removedAt = simT;
    }
    for (const v of this.ents.values()) {
      if (!seen.has(v.id) && v.removedAt === null) {
        const last = v.samples[v.samples.length - 1];
        if (last && last.t < simT) v.samples.push({ t: simT, x: last.x, y: last.y });
      }
      while (v.samples.length > 2 && v.samples[0]!.t < simT - KEEP_MS) v.samples.shift();
      if (v.removedAt !== null && v.removedAt < simT - KEEP_MS) this.ents.delete(v.id);
    }
    this.zones = m.zones.map((z) => ({ z, startedAt: simT + z.endsIn - z.total, endsAt: simT + z.endsIn }));
    this.run = m.run;
    this.tick = m.tick;
    this.simT = simT;
    this.snapshots++;
    if (m.run.me) this.ownId = m.run.me.unitId;
    this.reconcile(now, rttMs);
  }

  private updateOffset(o: number, paused: boolean): void {
    if (paused) {
      this.wasPaused = true;
      return;
    }
    if (this.wasPaused) {
      this.offsets = [];
      this.wasPaused = false;
    }
    if (this.offsets.length > 0 && o - Math.min(...this.offsets) > STALL_MS) this.offsets = [];
    this.offsets.push(o);
    if (this.offsets.length > OFFSET_WINDOW) this.offsets.shift();
    this.offset = Math.min(...this.offsets);
  }

  /** Simulationszeit, die gerade gezeigt wird (100 ms hinter dem Server). */
  renderTime(now: number): number {
    return now - this.offset - INTERP_DELAY_MS;
  }

  /** Interpolierte Position einer Einheit zur Zeit rt; dahinter höchstens 250 ms Extrapolation. */
  sample(e: EntView, rt: number): Vec2 {
    const s = e.samples;
    if (s.length === 0) return { x: e.cur.x, y: e.cur.y };
    const first = s[0]!;
    if (rt <= first.t) return { x: first.x, y: first.y };
    for (let i = s.length - 1; i >= 0; i--) {
      const a = s[i]!;
      if (a.t > rt) continue;
      const b = s[i + 1];
      if (b) {
        const k = (rt - a.t) / (b.t - a.t || 1);
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      }
      const p = s[i - 1];
      if (!p || p.t === a.t) return { x: a.x, y: a.y };
      const dt = Math.min(rt - a.t, MAX_EXTRAPOLATE_MS);
      return { x: a.x + ((a.x - p.x) / (a.t - p.t)) * dt, y: a.y + ((a.y - p.y) / (a.t - p.t)) * dt };
    }
    return { x: first.x, y: first.y };
  }

  // ---------- Eigener Held ----------

  /** Ausweichrolle vorhersagen (Strecke über die Dauer der Unverwundbarkeit). */
  predictRoll(now: number, dir: Vec2): void {
    const e = this.own();
    if (!e || !this.pred.init) return;
    const len = Math.hypot(dir.x, dir.y);
    const dx = len > 0 ? dir.x / len : e.cur.face;
    const dy = len > 0 ? dir.y / len : 0;
    const v = this.rollPx / (this.rollMs / 1000);
    this.pred.rollUntil = now + this.rollMs;
    this.pred.rollVx = dx * v;
    this.pred.rollVy = dy * v;
    this.pred.lastMoveAt = now + this.rollMs;
  }

  /** Bewegt die Vorhersage um einen Frame. dir: Eingaberichtung (0 = keine Eingabe). */
  stepOwn(now: number, dtMs: number, dir: Vec2, rt: number): Vec2 | null {
    const e = this.own();
    if (!e) return null;
    const server = this.sample(e, rt);
    const p = this.pred;
    if (e.cur.state === 'dead' || e.cur.state === 'stun' || this.run?.paused) {
      p.init = false;
      return server;
    }
    if (!p.init) {
      p.x = server.x;
      p.y = server.y;
      p.init = true;
    }
    const dt = dtMs / 1000;
    const moving = dir.x !== 0 || dir.y !== 0;
    if (now < p.rollUntil) {
      p.x += p.rollVx * dt;
      p.y += p.rollVy * dt;
    } else if (moving) {
      const len = Math.hypot(dir.x, dir.y) || 1;
      p.x += (dir.x / len) * this.moveSpeed * dt;
      p.y += (dir.y / len) * this.moveSpeed * dt;
      p.lastMoveAt = now;
    } else if (now - p.lastMoveAt > FOLLOW_AFTER_MS) {
      const k = Math.min(1, dt * FOLLOW_RATE);
      p.x += (server.x - p.x) * k;
      p.y += (server.y - p.y) * k;
    }
    if (p.cLeft > 0) {
      const step = Math.min(dtMs, p.cLeft) / CORRECT_MS;
      p.x += p.cx * step;
      p.y += p.cy * step;
      p.cLeft -= dtMs;
    }
    p.y = Math.max(0, Math.min(this.bandDepth, p.y));
    this.hist.push({ at: now, x: p.x, y: p.y });
    while (this.hist.length > 0 && this.hist[0]!.at < now - HIST_MS) this.hist.shift();
    return { x: p.x, y: p.y };
  }

  private histAt(at: number): Vec2 | null {
    const h = this.hist;
    if (h.length === 0 || at < h[0]!.at) return null;
    for (let i = h.length - 1; i >= 0; i--) {
      const a = h[i]!;
      if (a.at > at) continue;
      const b = h[i + 1];
      if (!b) return { x: a.x, y: a.y };
      const k = (at - a.at) / (b.at - a.at || 1);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    return null;
  }

  /**
   * Abgleich mit dem Server: Der Snapshot zeigt die Eingaben von vor etwa einer Rundlaufzeit (plus Tick).
   * Weicht die damalige Vorhersage um mehr als 24 px ab, wird in 100 ms korrigiert (11.7).
   */
  private reconcile(now: number, rttMs: number): void {
    const e = this.own();
    const p = this.pred;
    if (!e || !p.init) return;
    if (now - p.lastMoveAt > FOLLOW_AFTER_MS && now >= p.rollUntil) return;
    const s = e.samples[e.samples.length - 1];
    const h = this.histAt(now - rttMs - this.tickMs);
    if (!s || !h) return;
    const ex = s.x - h.x;
    const ey = s.y - h.y;
    if (Math.hypot(ex, ey) <= CORRECT_PX) return;
    p.cx = ex;
    p.cy = ey;
    p.cLeft = CORRECT_MS;
    for (const x of this.hist) {
      x.x += ex;
      x.y += ey;
    }
  }
}
