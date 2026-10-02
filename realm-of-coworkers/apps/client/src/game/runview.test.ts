// Interpolation, Extrapolation und Vorhersage (11.7).
import { describe, expect, it } from 'vitest';
import type { RunStartMsg, RunStateDTO, SnapEntity, SnapshotMsg } from '@aethra/shared';
import { CORRECT_PX, INTERP_DELAY_MS, MAX_EXTRAPOLATE_MS, RunView } from './runview';

const start: RunStartMsg = {
  t: 'run.start', runId: 'r', seed: 1, stage: 1, n: 1, roster: [],
  config: { tickMs: 50, snapshotEveryTicks: 2, introId: 'stage-01', bossId: null },
};

function runState(paused = false, ownId = 1): RunStateDTO {
  return {
    phase: 'walk', anchorX: 0, cameraX: 0, arena: false, worldWidth: 12000, encounter: -1, encounters: 6, checkpoint: -1,
    autowalk: true, paused, countdownEndsIn: null, bossId: null, bossPhase: 0, enrageIn: null, wipes: 0, kampfstufe: 0,
    ready: [], autoReadyIn: null,
    me: {
      unitId: ownId, potions: 4, potionCd: 0, rollCd: 0, swapCd: 0, activeSet: 'A', setElements: { A: 'physisch', B: null },
      autocast: {}, autoPotion: true, autoDodge: true, focusId: null, helper: false, reviveDoneIn: null, autopilot: false,
    },
  };
}

function ent(id: number, x: number, y = 100, kind: SnapEntity['kind'] = 'enemy'): SnapEntity {
  return { id, kind, x, y, face: 1, hp: 10, maxHp: 10, state: 'walk' };
}

function snap(tick: number, ents: SnapEntity[], o: { full?: boolean; rm?: number[]; paused?: boolean } = {}): SnapshotMsg {
  return { t: 'run.snapshot', tick, full: o.full ?? false, ents, rm: o.rm ?? [], zones: [], run: runState(o.paused) };
}

describe('RunView', () => {
  it('interpoliert mit 100 ms Verzögerung zwischen zwei Snapshots', () => {
    const v = new RunView(start, 240, 220, 160, 500);
    // Snapshot bei Tick 2 (100 ms) und 4 (200 ms), Ankunft ohne Verzögerung
    v.onSnapshot(snap(2, [ent(5, 100)], { full: true }), 1100);
    v.onSnapshot(snap(4, [ent(5, 200)]), 1200);
    expect(v.offset).toBe(1000);
    // Renderzeit 1250 − 1000 − 100 = 150 ms: Mitte zwischen 100 und 200
    const e = v.ents.get(5)!;
    expect(v.renderTime(1250)).toBe(150);
    expect(v.sample(e, v.renderTime(1250)).x).toBeCloseTo(150);
    expect(INTERP_DELAY_MS).toBe(100);
  });

  it('extrapoliert höchstens 250 ms, unveränderte Einheiten bleiben stehen', () => {
    const v = new RunView(start, 240, 220, 160, 500);
    v.onSnapshot(snap(2, [ent(5, 100), ent(6, 50)], { full: true }), 1100);
    v.onSnapshot(snap(4, [ent(5, 200)]), 1200);
    const e = v.ents.get(5)!;
    // 1000 px/s, 300 ms nach dem letzten Snapshot → gedeckelt auf 250 ms
    expect(v.sample(e, 200 + 300).x).toBeCloseTo(200 + MAX_EXTRAPOLATE_MS);
    // Einheit 6 fehlte im Delta: gleiche Position fortgeschrieben
    expect(v.sample(v.ents.get(6)!, 400).x).toBe(50);
  });

  it('entfernt Einheiten aus rm und bei vollständigen Snapshots', () => {
    const v = new RunView(start, 240, 220, 160, 500);
    v.onSnapshot(snap(2, [ent(5, 100), ent(6, 50), ent(7, 10)], { full: true }), 1100);
    v.onSnapshot(snap(4, [], { rm: [6] }), 1200);
    expect(v.ents.get(6)!.removedAt).toBe(200);
    v.onSnapshot(snap(6, [ent(5, 100)], { full: true }), 1300);
    expect(v.ents.get(7)!.removedAt).toBe(300);
    expect(v.ents.get(5)!.removedAt).toBeNull();
  });

  it('Pause und Stocken setzen den Uhrenabgleich zurück', () => {
    const v = new RunView(start, 240, 220, 160, 500);
    v.onSnapshot(snap(2, [ent(5, 100)], { full: true }), 1100);
    v.onSnapshot(snap(2, [], { paused: true }), 5000);
    v.onSnapshot(snap(4, []), 9000);
    expect(v.offset).toBe(9000 - 200);
  });

  it('sagt die eigene Bewegung vorher und korrigiert ab 24 px in 100 ms', () => {
    const v = new RunView(start, 240, 220, 160, 500);
    v.onSnapshot(snap(2, [ent(1, 1000, 100, 'hero')], { full: true }), 1100);
    let now = 1200;
    // 500 ms nach rechts: Vorhersage 1000 + 220 × 0,5 = 1110
    for (let i = 0; i < 10; i++) {
      now += 50;
      v.stepOwn(now, 50, { x: 1, y: 0 }, v.renderTime(now));
    }
    expect(v.pred.x).toBeCloseTo(1110, 0);
    // Server meldet eine deutlich andere Position (Hindernis): Korrektur wird eingeplant
    v.onSnapshot(snap(14, [ent(1, 1000, 100, 'hero')]), now, 0);
    expect(v.pred.cLeft).toBe(100);
    expect(Math.abs(v.pred.cx)).toBeGreaterThan(CORRECT_PX);
    for (let i = 0; i < 4; i++) {
      now += 50;
      v.stepOwn(now, 50, { x: 0, y: 0 }, v.renderTime(now));
    }
    expect(v.pred.cLeft).toBeLessThanOrEqual(0);
    expect(v.pred.x).toBeLessThan(1080);
  });

  it('kleine Abweichungen unter 24 px lösen keine Korrektur aus', () => {
    const v = new RunView(start, 240, 220, 160, 500);
    v.onSnapshot(snap(2, [ent(1, 1000, 100, 'hero')], { full: true }), 1100);
    let now = 1100;
    for (let i = 0; i < 4; i++) {
      now += 50;
      v.stepOwn(now, 50, { x: 1, y: 0 }, v.renderTime(now));
    }
    // Server bestätigt nahezu dieselbe Strecke
    v.onSnapshot(snap(6, [ent(1, 1000 + 220 * 0.15, 100, 'hero')]), now, 0);
    expect(v.pred.cLeft).toBe(0);
  });
});
