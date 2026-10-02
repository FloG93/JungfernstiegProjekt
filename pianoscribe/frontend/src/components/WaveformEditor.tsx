// Wellenform des ganzen Songs mit Trim-Bereich, Zoom, Wiedergabe und Markierung des ersten
// Taktschlags. Zeiten beziehen sich auf die Originaldatei.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin, { type Region } from "wavesurfer.js/dist/plugins/regions.esm.js";
import TimelinePlugin from "wavesurfer.js/dist/plugins/timeline.esm.js";

import type { Trim, Waveform } from "../api/types";
import { formatDecimal, formatTime } from "../lib/timing";

export interface WaveformHandle {
  pause(): void;
  currentTime(): number;
  setTrimStart(): void;
  setTrimEnd(): void;
  togglePlay(): void;
}

interface Props {
  url: string;
  waveform: Waveform;
  trim: Trim;
  firstDownbeat: number | null;
  disabled: boolean;
  onTrimChange(trim: Trim): void;
  onDownbeatChange(seconds: number | null): void;
  onTempoTapped(bpm: number): void;
  onPlay(): void;
}

const TRIM_COLOR = "rgba(250, 176, 5, 0.22)";
const DOWNBEAT_COLOR = "rgba(232, 89, 12, 0.9)";

export const WaveformEditor = forwardRef<WaveformHandle, Props>(function WaveformEditor(props, ref) {
  const { url, waveform, trim, firstDownbeat, disabled } = props;
  const container = useRef<HTMLDivElement>(null);
  const timeline = useRef<HTMLDivElement>(null);
  const ws = useRef<WaveSurfer | null>(null);
  const regions = useRef<RegionsPlugin | null>(null);
  const ready = useRef(false);
  const zoomRef = useRef(0);
  const callbacks = useRef(props);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [waveReady, setWaveReady] = useState(false);
  const [taps, setTaps] = useState<number[]>([]);

  useEffect(() => {
    callbacks.current = props;
  });

  // Einmal pro URL aufbauen; Trim und Marker werden unten nachgeführt.
  useEffect(() => {
    if (!container.current || !timeline.current) return;
    const regionPlugin = RegionsPlugin.create();
    const instance = WaveSurfer.create({
      container: container.current,
      url,
      peaks: [waveform.peaks],
      duration: waveform.duration_s,
      height: 110,
      waveColor: "#8e9bbd",
      progressColor: "#4c5a80",
      cursorColor: "#1c2541",
      barWidth: 2,
      barGap: 1,
      barRadius: 1,
      normalize: true,
      dragToSeek: true,
      plugins: [
        regionPlugin,
        TimelinePlugin.create({ container: timeline.current, height: 18, timeInterval: 1,
          primaryLabelInterval: 10, style: { fontSize: "11px", color: "#5c6378" } }),
      ],
    });
    ws.current = instance;
    regions.current = regionPlugin;
    ready.current = false;
    instance.on("ready", () => {
      ready.current = true;
      if (zoomRef.current > 0) instance.zoom(zoomRef.current);
      setWaveReady(true); // Regionen erst jetzt anlegen, vorher ist die Dauer unbekannt
    });
    instance.on("timeupdate", (t) => setTime(t));
    instance.on("play", () => {
      setPlaying(true);
      callbacks.current.onPlay();
    });
    instance.on("pause", () => setPlaying(false));
    regionPlugin.on("region-updated", (region: Region) => {
      if (region.id === "trim") {
        callbacks.current.onTrimChange({ start_s: round(region.start), end_s: round(region.end) });
      } else if (region.id === "downbeat") {
        callbacks.current.onDownbeatChange(round(region.start));
      }
    });
    return () => {
      instance.destroy();
      ws.current = null;
      regions.current = null;
      setWaveReady(false);
    };
  }, [url, waveform]);

  // Trim-Bereich und Taktschlag-Marker mit dem Projektzustand abgleichen.
  useEffect(() => {
    const plugin = regions.current;
    if (!plugin || !waveReady) return;
    const existing = plugin.getRegions().find((r) => r.id === "trim");
    if (existing) {
      if (Math.abs(existing.start - trim.start_s) > 0.005 || Math.abs(existing.end - trim.end_s) > 0.005) {
        existing.setOptions({ start: trim.start_s, end: trim.end_s });
      }
      existing.setOptions({ drag: !disabled, resize: !disabled });
    } else {
      plugin.addRegion({ id: "trim", start: trim.start_s, end: trim.end_s, color: TRIM_COLOR,
        drag: !disabled, resize: !disabled, minLength: 0.5 });
    }
  }, [trim.start_s, trim.end_s, disabled, waveReady]);

  useEffect(() => {
    const plugin = regions.current;
    if (!plugin || !waveReady) return;
    const marker = plugin.getRegions().find((r) => r.id === "downbeat");
    if (firstDownbeat === null) {
      marker?.remove();
    } else if (marker) {
      if (Math.abs(marker.start - firstDownbeat) > 0.005) marker.setOptions({ start: firstDownbeat });
    } else {
      plugin.addRegion({ id: "downbeat", start: firstDownbeat, color: DOWNBEAT_COLOR, drag: true,
        resize: false, content: "1" });
    }
  }, [firstDownbeat, waveReady]);

  useEffect(() => {
    zoomRef.current = zoom;
    // zoom() wirft, solange die Wellenform noch nicht bereit ist.
    if (ready.current) ws.current?.zoom(zoom);
  }, [zoom]);

  const togglePlay = useCallback(() => {
    void ws.current?.playPause();
  }, []);

  const playTrim = () => {
    const instance = ws.current;
    if (!instance) return;
    const region = regions.current?.getRegions().find((r) => r.id === "trim");
    region?.play();
  };

  const tap = () => {
    const now = performance.now();
    const recent = [...taps.filter((t) => now - t < 3000), now].slice(-6);
    setTaps(recent);
    if (recent.length >= 3) {
      const intervals = recent.slice(1).map((t, i) => t - recent[i]!);
      const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      callbacks.current.onTempoTapped(Math.round(60000 / mean));
    }
  };

  useImperativeHandle(ref, () => ({
    pause: () => ws.current?.pause(),
    currentTime: () => ws.current?.getCurrentTime() ?? 0,
    togglePlay,
    setTrimStart: () => {
      const t = ws.current?.getCurrentTime() ?? 0;
      if (t < trim.end_s - 0.5) callbacks.current.onTrimChange({ start_s: round(t), end_s: trim.end_s });
    },
    setTrimEnd: () => {
      const t = ws.current?.getCurrentTime() ?? 0;
      if (t > trim.start_s + 0.5) callbacks.current.onTrimChange({ start_s: trim.start_s, end_s: round(t) });
    },
  }), [togglePlay, trim.start_s, trim.end_s]);

  const tapBpm = taps.length >= 3
    ? Math.round(60000 / ((taps[taps.length - 1]! - taps[0]!) / (taps.length - 1)))
    : null;

  return (
    <section className="panel waveform-panel" aria-label="Wellenform">
      <div className="waveform-toolbar">
        <button type="button" className="btn primary" onClick={togglePlay}
          title="Abspielen/Pause (Leertaste bei geöffneter Wellenform)">
          {playing ? "⏸ Pause" : "▶ Abspielen"}
        </button>
        <button type="button" className="btn" onClick={playTrim}>▶ Ausschnitt</button>
        <span className="time-display">{formatTime(time)} / {formatTime(waveform.duration_s)}</span>
        <span className="spacer" />
        <span className="trim-display" title="Ausschnitt (mit [ und ] am Abspielkopf setzen)">
          Ausschnitt {formatTime(trim.start_s)} – {formatTime(trim.end_s)}
          {" "}({formatDecimal(trim.end_s - trim.start_s)} s)
        </span>
        <span className="spacer" />
        <button type="button" className="btn" disabled={disabled}
          onClick={() => callbacks.current.onDownbeatChange(round(ws.current?.getCurrentTime() ?? 0))}
          title="Setzt den ersten Taktschlag (Zählzeit 1) auf die aktuelle Position">
          Ersten Taktschlag hier
        </button>
        {firstDownbeat !== null && (
          <button type="button" className="btn subtle" onClick={() => callbacks.current.onDownbeatChange(null)}
            title="Taktschlag wieder automatisch erkennen">
            Automatisch
          </button>
        )}
        <button type="button" className="btn" onClick={tap} title="Im Takt klicken, um das Tempo zu bestimmen">
          Tap {tapBpm ? `(${tapBpm} BPM)` : ""}
        </button>
        <label className="zoom">
          Zoom
          <input type="range" min={0} max={300} step={10} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))} />
        </label>
      </div>
      <div ref={container} className="waveform" />
      <div ref={timeline} className="waveform-timeline" />
    </section>
  );
});

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
