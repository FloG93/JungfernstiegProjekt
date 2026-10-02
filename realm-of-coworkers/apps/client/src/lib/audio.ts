// Klänge per WebAudio erzeugt (14.9): keine Dateien, höchstens 24 gleichzeitig, gleiche Töne höchstens 4 pro Sekunde.
import { settings } from './settings';

export type Sfx =
  | 'hit' | 'hitElement' | 'crit' | 'heal' | 'telegraph' | 'roll' | 'revive' | 'potion' | 'levelup' | 'loot'
  | 'legendary' | 'phase' | 'victory' | 'click' | 'death' | 'wipe' | 'checkpoint' | 'ping' | 'swap' | 'error';

const MAX_VOICES = 24;
const MAX_PER_SECOND = 4;
const UI_SOUNDS: ReadonlySet<Sfx> = new Set(['click', 'error']);

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let voices = 0;
const recent = new Map<Sfx, number[]>();

/** Audio startet nach der ersten Eingabe (Browser-Regel). */
export function unlockAudio(): void {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.connect(ctx.destination);
}

function volumeFor(s: Sfx): number {
  const st = settings.get();
  if (st.mute) return 0;
  return (UI_SOUNDS.has(s) ? st.ui : st.sfx) / 100;
}

interface Tone {
  type: OscillatorType;
  f0: number;
  f1?: number;
  dur: number;
  gain: number;
  delay?: number;
  noise?: boolean;
}

const SOUNDS: Record<Sfx, Tone[]> = {
  hit: [{ type: 'square', f0: 180, f1: 90, dur: 0.07, gain: 0.12, noise: true }],
  hitElement: [{ type: 'triangle', f0: 520, f1: 260, dur: 0.09, gain: 0.12 }],
  crit: [{ type: 'square', f0: 300, f1: 120, dur: 0.12, gain: 0.18, noise: true }, { type: 'sine', f0: 880, f1: 660, dur: 0.1, gain: 0.1 }],
  heal: [{ type: 'sine', f0: 520, f1: 780, dur: 0.18, gain: 0.1 }],
  telegraph: [{ type: 'sawtooth', f0: 220, f1: 200, dur: 0.18, gain: 0.08 }, { type: 'sawtooth', f0: 220, f1: 200, dur: 0.18, gain: 0.08, delay: 0.22 }],
  roll: [{ type: 'triangle', f0: 400, f1: 900, dur: 0.12, gain: 0.08, noise: true }],
  revive: [{ type: 'sine', f0: 392, dur: 0.12, gain: 0.1 }, { type: 'sine', f0: 523, dur: 0.12, gain: 0.1, delay: 0.12 }, { type: 'sine', f0: 659, dur: 0.2, gain: 0.1, delay: 0.24 }],
  potion: [{ type: 'sine', f0: 300, f1: 600, dur: 0.15, gain: 0.1 }, { type: 'sine', f0: 600, f1: 900, dur: 0.1, gain: 0.08, delay: 0.1 }],
  levelup: [{ type: 'triangle', f0: 523, dur: 0.12, gain: 0.12 }, { type: 'triangle', f0: 659, dur: 0.12, gain: 0.12, delay: 0.12 }, { type: 'triangle', f0: 784, dur: 0.12, gain: 0.12, delay: 0.24 }, { type: 'triangle', f0: 1047, dur: 0.3, gain: 0.12, delay: 0.36 }],
  loot: [{ type: 'sine', f0: 880, f1: 1320, dur: 0.12, gain: 0.08 }],
  legendary: [{ type: 'triangle', f0: 659, dur: 0.15, gain: 0.12 }, { type: 'triangle', f0: 880, dur: 0.15, gain: 0.12, delay: 0.15 }, { type: 'triangle', f0: 1319, dur: 0.4, gain: 0.12, delay: 0.3 }],
  phase: [{ type: 'sawtooth', f0: 110, f1: 55, dur: 0.6, gain: 0.12 }, { type: 'square', f0: 220, f1: 110, dur: 0.4, gain: 0.06 }],
  victory: [{ type: 'triangle', f0: 523, dur: 0.15, gain: 0.12 }, { type: 'triangle', f0: 659, dur: 0.15, gain: 0.12, delay: 0.15 }, { type: 'triangle', f0: 784, dur: 0.15, gain: 0.12, delay: 0.3 }, { type: 'triangle', f0: 1047, dur: 0.5, gain: 0.14, delay: 0.45 }],
  click: [{ type: 'sine', f0: 900, f1: 700, dur: 0.04, gain: 0.06 }],
  death: [{ type: 'sawtooth', f0: 200, f1: 60, dur: 0.35, gain: 0.08 }],
  wipe: [{ type: 'sawtooth', f0: 160, f1: 40, dur: 0.9, gain: 0.1 }],
  checkpoint: [{ type: 'sine', f0: 660, dur: 0.1, gain: 0.08 }, { type: 'sine', f0: 990, dur: 0.18, gain: 0.08, delay: 0.1 }],
  ping: [{ type: 'sine', f0: 1200, f1: 1000, dur: 0.08, gain: 0.08 }, { type: 'sine', f0: 1200, f1: 1000, dur: 0.08, gain: 0.08, delay: 0.12 }],
  swap: [{ type: 'square', f0: 600, f1: 300, dur: 0.06, gain: 0.05 }],
  error: [{ type: 'square', f0: 160, dur: 0.12, gain: 0.06 }],
};

let noiseBuf: AudioBuffer | null = null;

function noise(c: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const len = Math.floor(c.sampleRate * 0.2);
  noiseBuf = c.createBuffer(1, len, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let seed = 7;
  for (let i = 0; i < len; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (seed / 0x7fffffff) * 2 - 1;
  }
  return noiseBuf;
}

export function play(s: Sfx): void {
  if (!ctx || !master || ctx.state !== 'running') return;
  const vol = volumeFor(s);
  if (vol <= 0 || voices >= MAX_VOICES) return;
  const now = performance.now();
  const list = (recent.get(s) ?? []).filter((x) => now - x < 1000);
  if (list.length >= MAX_PER_SECOND) return;
  list.push(now);
  recent.set(s, list);
  const t0 = ctx.currentTime;
  for (const tone of SOUNDS[s]) {
    const start = t0 + (tone.delay ?? 0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(tone.gain * vol, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + tone.dur);
    g.connect(master);
    const src: AudioScheduledSourceNode = tone.noise
      ? Object.assign(ctx.createBufferSource(), { buffer: noise(ctx) })
      : ctx.createOscillator();
    if (src instanceof OscillatorNode) {
      src.type = tone.type;
      src.frequency.setValueAtTime(tone.f0, start);
      if (tone.f1) src.frequency.exponentialRampToValueAtTime(tone.f1, start + tone.dur);
    }
    src.connect(g);
    voices++;
    src.onended = () => {
      voices--;
      g.disconnect();
    };
    src.start(start);
    src.stop(start + tone.dur + 0.02);
  }
}
