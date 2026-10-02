// Musik per WebAudio (14.9): ruhige Flächenklänge je Stimmung (Lager, Stage, Boss), ohne Audiodateien. // OPEN-043
// Lautstärke aus den Einstellungen; startet erst nach der ersten Eingabe (Browser-Regel).
import { audioContext } from './audio';
import { settings } from './settings';

export type Mood = 'off' | 'camp' | 'stage' | 'boss';

const BAR_S = 4;
const MAX_GAIN = 0.06;
/** Akkordfolgen in Halbtönen über dem Grundton. */
const PROGRESSIONS: Record<Exclude<Mood, 'off'>, { root: number; chords: number[][]; pulse: boolean }> = {
  camp: { root: 220, chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [-5, -1, 2]], pulse: false },
  stage: { root: 196, chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]], pulse: true },
  boss: { root: 147, chords: [[0, 3, 7], [1, 4, 8], [0, 3, 7], [-2, 1, 5]], pulse: true },
};

let mood: Mood = 'off';
let timer: ReturnType<typeof setInterval> | null = null;
let bar = 0;
let out: GainNode | null = null;

function volume(): number {
  const s = settings.get();
  return s.mute ? 0 : (s.music / 100) * MAX_GAIN;
}

function playBar(): void {
  const ctx = audioContext();
  if (!ctx || ctx.state !== 'running' || mood === 'off') return;
  if (!out) {
    out = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    out.connect(lp);
    lp.connect(ctx.destination);
  }
  out.gain.setTargetAtTime(volume(), ctx.currentTime, 0.5);
  const p = PROGRESSIONS[mood];
  const chord = p.chords[bar % p.chords.length]!;
  const t0 = ctx.currentTime + 0.05;
  for (const semi of chord) {
    const f = p.root * 2 ** (semi / 12);
    for (const detune of [-6, 6]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      o.detune.value = detune;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.5, t0 + 1.2);
      g.gain.linearRampToValueAtTime(0.35, t0 + BAR_S - 0.6);
      g.gain.linearRampToValueAtTime(0, t0 + BAR_S + 0.4);
      o.connect(g);
      g.connect(out);
      o.start(t0);
      o.stop(t0 + BAR_S + 0.5);
    }
  }
  if (p.pulse) {
    // leiser Puls im Bass, im Bosskampf doppelt so schnell
    const steps = mood === 'boss' ? 8 : 4;
    for (let i = 0; i < steps; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t = t0 + (i * BAR_S) / steps;
      o.type = 'sine';
      o.frequency.value = (p.root / 2) * 2 ** (chord[0]! / 12);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.7, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + 0.4);
    }
  }
  bar++;
}

export function setMood(m: Mood): void {
  if (m === mood) return;
  mood = m;
  bar = 0;
  if (timer) clearInterval(timer);
  timer = null;
  if (m === 'off') {
    const ctx = audioContext();
    if (out && ctx) out.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    return;
  }
  playBar();
  timer = setInterval(playBar, BAR_S * 1000);
}

settings.subscribe(() => {
  const ctx = audioContext();
  if (out && ctx) out.gain.setTargetAtTime(volume(), ctx.currentTime, 0.2);
});
