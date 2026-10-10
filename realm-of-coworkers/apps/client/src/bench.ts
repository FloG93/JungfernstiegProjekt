// Leistungsmessung (2.7, 16.3): 6 Helden und 40 Gegner mit Flächen und Treffern, ohne Server.
// Aufruf: /?bench. Ergebnis in window.__bench (Frames, Rechenzeit der Szene je Frame, FPS).
import type { ClassId, GameEvent, RunStartMsg, SnapEntity, SnapZone, SnapshotMsg } from '@aethra/shared';
import { content, loadGameContent } from './lib/content';
import { settings } from './lib/settings';
import { RunView } from './game/runview';

const HEROES: ClassId[] = ['krieger', 'magier', 'waldlaeufer', 'schurke', 'kleriker', 'runenweber'];
const ENEMIES = 40;
const TYPES = ['scherge', 'hetzer', 'schuetze', 'schwarmling', 'brecher', 'priester', 'kultist', 'bomber', 'waechter'];

interface BenchResult {
  frames: number;
  avgUpdateMs: number;
  p95UpdateMs: number;
  fps: number;
  done: boolean;
}

export async function runBench(seconds = 6): Promise<void> {
  const result: BenchResult = { frames: 0, avgUpdateMs: 0, p95UpdateMs: 0, fps: 0, done: false };
  (globalThis as { __bench?: BenchResult }).__bench = result;
  await loadGameContent();
  const c = content();
  const root = document.getElementById('app')!;
  root.innerHTML = '<div id="bench" style="position:fixed;inset:0"></div>';
  const el = document.getElementById('bench')!;
  const start: RunStartMsg = {
    t: 'run.start', runId: 'bench', seed: 1, stage: 13, n: 6, roster: [],
    config: { tickMs: 50, snapshotEveryTicks: 2, introId: 'stage-13', bossId: null },
  };
  const view = new RunView(start, c.engine.world.bandDepthPx, c.balance.movement.manual, c.balance.combat.roll.px, c.balance.combat.roll.invulnMs);
  let events: GameEvent[] = [];
  const { GameHost } = await import('./game/host');
  const host = new GameHost(el, { content: c, view: () => view, settings: () => settings.get(), ownDir: () => ({ x: 0, y: 0 }), drainEvents: () => {
    const e = events;
    events = [];
    return e;
  } });
  // Schnappschüsse mit 10 Hz: Helden in Formation, Gegner kreisen, Flächen und Treffer
  let tick = 0;
  const base = 6000;
  const snap = () => {
    tick += 2;
    const t = tick * 50;
    const ents: SnapEntity[] = [];
    HEROES.forEach((cls, i) => ents.push({
      id: i + 1, kind: 'hero', x: base - 60 * i + Math.sin(t / 900 + i) * 30, y: 40 + i * 30, face: 1, hp: 800 - i * 40, maxHp: 1000,
      state: i % 2 ? 'attack' : 'walk', fx: [{ id: 'kraftrune', stacks: 1, ms: 3000 }], ...(i === 0 ? { cd: { krieger_spott: 2000 } } : {}),
      ...(tick === 2 ? { meta: { name: `Held ${i + 1}`, cls, level: 13, acc: i + 1, look: [i % 4, i % 6] as [number, number] } } : {}),
    }));
    for (let k = 0; k < ENEMIES; k++) {
      const a = t / 1500 + (k * Math.PI * 2) / ENEMIES;
      ents.push({
        id: 100 + k, kind: 'enemy', x: base + 220 + Math.cos(a) * 260, y: 120 + Math.sin(a * 1.3) * 100, face: -1, hp: 300 - (k % 7) * 30, maxHp: 300,
        state: k % 3 === 0 ? 'attack' : 'walk', el: 'erde', ...(k % 5 === 0 ? { tgt: 1 } : {}),
        ...(tick === 2 ? { meta: { type: TYPES[k % TYPES.length]!, level: 13, ...(k % 13 === 0 ? { elite: true } : {}) } } : {}),
      });
    }
    const zones: SnapZone[] = [0, 1, 2, 3].map((z) => ({
      id: z + 1, shape: z === 3 ? 'line' : 'circle', x: base + 100 + z * 120, y: 60 + z * 40, w: z === 3 ? 400 : 110, h: 40, ang: 0.3,
      endsIn: 1500 - ((t + z * 300) % 1500), total: 1500, kind: 'telegraph', hostile: true,
    }));
    const msg: SnapshotMsg = {
      t: 'run.snapshot', tick, full: tick === 2, ents, rm: [], zones,
      run: {
        phase: 'fight', anchorX: base, cameraX: base + 60, arena: false, worldWidth: 12000, encounter: 2, encounters: 6, checkpoint: 0,
        autowalk: true, paused: false, countdownEndsIn: null, bossId: null, bossPhase: 0, enrageIn: null, wipes: 0, kampfstufe: 0, ready: [],
        autoReadyIn: null,
        me: {
          unitId: 1, potions: 3, potionCd: 0, rollCd: 0, swapCd: 0, activeSet: 'A', setElements: { A: 'eis', B: null }, autocast: {},
          autoPotion: true, autoDodge: true, focusId: 105, helper: false, reviveDoneIn: null, autopilot: false,
        },
      },
    };
    view.onSnapshot(msg, performance.now());
    for (let i = 0; i < 12; i++) {
      events.push({ e: 'hit', src: 1 + (i % 6), dst: 100 + ((tick + i) % ENEMIES), dmg: 40 + i, ...(i % 5 === 0 ? { crit: true } : {}), el: i % 2 ? 'eis' : 'physisch' });
    }
  };
  const snapTimer = setInterval(snap, 100);
  snap();
  // Rechenzeit der Szene je Frame messen: erst messen, wenn Phaser die Sprites geladen und create() gelaufen ist
  const bisStart = Date.now() + 15_000;
  while (!host.scene?.bereit && Date.now() < bisStart) await new Promise((r) => setTimeout(r, 50));
  await new Promise((r) => setTimeout(r, 300));
  // Phaser ruft die beim Start gebundene Funktion sys.sceneUpdate auf
  const scene = host.scene!;
  const sys = scene.sys as unknown as { sceneUpdate: (time: number, delta: number) => void };
  const orig = sys.sceneUpdate;
  const times: number[] = [];
  sys.sceneUpdate = function (this: unknown, time: number, delta: number) {
    const t0 = performance.now();
    orig.call(scene, time, delta);
    times.push(performance.now() - t0);
  };
  let frames = 0;
  const t0 = performance.now();
  await new Promise<void>((resolve) => {
    const f = () => {
      frames++;
      if (performance.now() - t0 < seconds * 1000) requestAnimationFrame(f);
      else resolve();
    };
    requestAnimationFrame(f);
  });
  clearInterval(snapTimer);
  times.sort((a, b) => a - b);
  result.frames = times.length;
  result.avgUpdateMs = times.reduce((a, x) => a + x, 0) / Math.max(1, times.length);
  result.p95UpdateMs = times[Math.floor(times.length * 0.95)] ?? 0;
  result.fps = frames / seconds;
  result.done = true;
  console.log('BENCH', JSON.stringify(result));
}
