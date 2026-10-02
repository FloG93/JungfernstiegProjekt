// Wiedergabeleiste mit Umschalter Original · isoliertes Klavier · Noten (synthetisiert).

import type { Source } from "../lib/player";
import { formatTime } from "../lib/timing";

interface Props {
  ready: boolean;
  loading: boolean;
  playing: boolean;
  position: number;
  duration: number;
  source: Source;
  hasPiano: boolean;
  hasScore: boolean;
  volume: number;
  onToggle(): void;
  onSeek(seconds: number): void;
  onSource(source: Source): void;
  onVolume(db: number): void;
}

const SOURCES: { value: Source; label: string; title: string }[] = [
  { value: "original", label: "Original", title: "Der Ausschnitt aus der Originaldatei" },
  { value: "piano", label: "Klavier", title: "Das von Demucs isolierte Klavier" },
  { value: "score", label: "Noten", title: "Die erzeugten Noten, mit Klavierklang gespielt" },
];

export function PlayerBar(props: Props) {
  const { ready, loading, playing, position, duration, source, hasPiano, hasScore } = props;
  const available = (s: Source) => (s === "piano" ? hasPiano : s === "score" ? hasScore : true);
  return (
    <footer className="player-bar" aria-label="Wiedergabe">
      <button type="button" className="btn primary play" disabled={!ready} onClick={props.onToggle}
        title="Abspielen/Pause (Leertaste)">
        {playing ? "⏸" : "▶"}
      </button>
      <span className="time-display">{formatTime(position)}</span>
      <input className="seek" type="range" min={0} max={Math.max(duration, 0.1)} step={0.05}
        value={Math.min(position, duration)} disabled={!ready}
        onChange={(e) => props.onSeek(Number(e.target.value))} aria-label="Position" />
      <span className="time-display">{formatTime(duration)}</span>
      <div className="segmented" role="group" aria-label="Quelle">
        {SOURCES.map((s) => (
          <button key={s.value} type="button" title={s.title} disabled={!available(s.value)}
            className={source === s.value ? "active" : ""} onClick={() => props.onSource(s.value)}>
            {s.label}
          </button>
        ))}
      </div>
      <label className="volume" title="Lautstärke">
        🔊
        <input type="range" min={-40} max={6} step={1} value={props.volume}
          onChange={(e) => props.onVolume(Number(e.target.value))} />
      </label>
      {loading && <span className="hint">Audio wird geladen …</span>}
    </footer>
  );
}
