// Wiedergabe mit A/B/C-Umschaltung: Original · isoliertes Klavier · Noten (synthetisiert).
// Alle drei Quellen laufen synchron am Tone.js-Transport; umgeschaltet wird nur die Lautstärke,
// dadurch bleibt die Position beim Wechsel exakt erhalten.

import * as Tone from "tone";

import type { ScoreData } from "../api/types";
import { noteNameTone, SALAMANDER_URLS } from "./music";

export type Source = "original" | "piano" | "score";

export interface PlayerInput {
  originalUrl: string;
  pianoUrl: string | null;
  score: ScoreData | null;
  samplesBaseUrl: string;
  duration: number;
}

export class Player {
  private readonly output = new Tone.Volume(0).toDestination();
  private original: Tone.Player | null = null;
  private piano: Tone.Player | null = null;
  private sampler: Tone.Sampler | null = null;
  private part: Tone.Part | null = null;
  private source: Source = "original";
  private endEvent: number | null = null;
  duration = 0;
  onEnded: (() => void) | null = null;

  async load(input: PlayerInput): Promise<void> {
    this.disposeSources();
    const transport = Tone.getTransport();
    transport.stop();
    transport.seconds = 0;
    this.duration = input.duration;

    this.original = new Tone.Player({ url: input.originalUrl }).connect(this.output);
    const loads: Promise<unknown>[] = [Tone.loaded()];
    if (input.pianoUrl) this.piano = new Tone.Player({ url: input.pianoUrl }).connect(this.output);
    if (input.score && input.score.notes.length > 0) {
      this.sampler = new Tone.Sampler({
        urls: SALAMANDER_URLS,
        baseUrl: input.samplesBaseUrl,
        release: 0.8,
      }).connect(this.output);
      this.part = this.buildPart(input.score);
    }
    await Promise.all(loads);
    this.original.sync().start(0);
    this.piano?.sync().start(0);
    this.part?.start(0);
    this.endEvent = transport.scheduleOnce(() => {
      Tone.getDraw().schedule(() => this.onEnded?.(), Tone.now());
    }, this.duration);
    this.applySource();
  }

  private buildPart(score: ScoreData): Tone.Part {
    const pedals = score.pedals;
    const events = score.notes.map((n) => {
      // Unter gehaltenem Pedal klingt der Ton bis zum Pedal-Loslassen weiter.
      let end = n.t1;
      for (const p of pedals) if (p.t0 <= end && end < p.t1) end = p.t1;
      return { time: n.t0, note: noteNameTone(n.p), dur: Math.max(0.05, end - n.t0), vel: n.v };
    });
    return new Tone.Part((time, ev: { note: string; dur: number; vel: number }) => {
      this.sampler?.triggerAttackRelease(ev.note, ev.dur, time, Math.max(0.15, ev.vel / 127));
    }, events);
  }

  private applySource(): void {
    if (this.original) this.original.mute = this.source !== "original";
    if (this.piano) this.piano.mute = this.source !== "piano";
    if (this.sampler) this.sampler.volume.value = this.source === "score" ? 0 : -Infinity;
  }

  setSource(source: Source): void {
    this.source = source;
    this.applySource();
  }

  setVolume(db: number): void {
    this.output.volume.value = db;
  }

  get playing(): boolean {
    return Tone.getTransport().state === "started";
  }

  get position(): number {
    return Tone.getTransport().seconds;
  }

  async play(): Promise<void> {
    await Tone.start();
    const transport = Tone.getTransport();
    if (transport.seconds >= this.duration - 0.05) transport.seconds = 0;
    transport.start();
  }

  pause(): void {
    Tone.getTransport().pause();
    this.sampler?.releaseAll();
  }

  seek(seconds: number): void {
    const transport = Tone.getTransport();
    const wasPlaying = this.playing;
    if (wasPlaying) transport.pause();
    this.sampler?.releaseAll();
    transport.seconds = Math.max(0, Math.min(seconds, this.duration));
    if (wasPlaying) transport.start();
  }

  private disposeSources(): void {
    const transport = Tone.getTransport();
    if (this.endEvent !== null) transport.clear(this.endEvent);
    this.endEvent = null;
    this.part?.dispose();
    this.sampler?.dispose();
    this.original?.unsync().dispose();
    this.piano?.unsync().dispose();
    this.part = null;
    this.sampler = null;
    this.original = null;
    this.piano = null;
  }

  dispose(): void {
    Tone.getTransport().stop();
    this.disposeSources();
  }
}
