// Notationsparameter (live): jede Änderung löst nur die Notationsstufe aus (mit Debounce).

import type { DeepPartial, GridMode, NotationParams, ScoreInfo } from "../api/types";
import { KEY_OPTIONS, SPLIT_OPTIONS, TIME_SIGNATURES } from "../lib/music";

interface Props {
  params: NotationParams;
  info: ScoreInfo | null;
  disabled: boolean;
  onChange(changes: DeepPartial<NotationParams>): void;
}

const GRIDS: { value: GridMode; label: string }[] = [
  { value: "auto", label: "Automatisch" },
  { value: "1/8", label: "Achtel" },
  { value: "1/16", label: "Sechzehntel" },
  { value: "1/16+triplets", label: "Sechzehntel + Triolen" },
];

export function ParamsPanel({ params, info, disabled, onChange }: Props) {
  // Textfelder sind unkontrolliert (übernommen beim Verlassen); der key setzt sie zurück,
  // wenn sich der gespeicherte Wert ändert.
  const autoTempo = params.tempo_bpm === null;

  return (
    <section className="panel params-panel" aria-label="Notation">
      <h2>Notation</h2>
      {info && (
        <p className="detected">
          Erkannt: {Math.round(info.tempo_bpm)} BPM · {info.key_name} · {info.time_signature}
          {info.pickup_quarters > 0 && ` · Auftakt ${formatQuarters(info.pickup_quarters)}`}
          {" "}· {info.measures} Takte
        </p>
      )}
      {info?.warnings.map((w) => (
        <p key={w} className="warning">{w}</p>
      ))}
      <fieldset disabled={disabled}>
        <div className="field">
          <label htmlFor="tempo">Tempo</label>
          <div className="inline">
            <label className="checkbox small">
              <input type="checkbox" checked={autoTempo}
                onChange={(e) => onChange({ tempo_bpm: e.target.checked ? null : Math.round(info?.tempo_bpm ?? 100) })} />
              auto
            </label>
            <input id="tempo" type="number" min={30} max={300} step={1} disabled={autoTempo}
              key={`${params.tempo_bpm ?? "auto"}-${info?.tempo_bpm ?? ""}`}
              defaultValue={autoTempo ? Math.round(info?.tempo_bpm ?? 0) || "" : params.tempo_bpm ?? ""}
              onBlur={(e) => {
                const value = Number(e.target.value);
                if (!autoTempo && value >= 30 && value <= 300 && value !== params.tempo_bpm) {
                  onChange({ tempo_bpm: value });
                }
              }} />
            <span className="unit">BPM</span>
          </div>
        </div>
        <div className="field">
          <label htmlFor="ts">Taktart</label>
          <select id="ts" value={params.time_signature}
            onChange={(e) => onChange({ time_signature: e.target.value })}>
            {TIME_SIGNATURES.map((ts) => <option key={ts} value={ts}>{ts}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="key">Tonart</label>
          <select id="key" value={params.key ?? ""}
            onChange={(e) => onChange({ key: e.target.value || null })}>
            <option value="">Automatisch{info && params.key === null ? ` (${info.key_name})` : ""}</option>
            {KEY_OPTIONS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="grid">Raster</label>
          <select id="grid" value={params.grid}
            onChange={(e) => onChange({ grid: e.target.value as GridMode })}>
            {GRIDS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="split">Händetrennung</label>
          <div className="inline">
            <select id="split" value={params.hand_split.mode}
              onChange={(e) => onChange({ hand_split: { mode: e.target.value as "auto" | "fixed" } })}>
              <option value="auto">Automatisch</option>
              <option value="fixed">Fest bei</option>
            </select>
            <select aria-label="Split-Note" value={params.hand_split.pitch}
              disabled={params.hand_split.mode !== "fixed"}
              onChange={(e) => onChange({ hand_split: { pitch: Number(e.target.value) } })}>
              {SPLIT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="minlen">Mindestlänge</label>
          <div className="inline">
            <input id="minlen" type="range" min={0} max={300} step={10} value={params.min_note_ms}
              onChange={(e) => onChange({ min_note_ms: Number(e.target.value) })} />
            <span className="unit">{params.min_note_ms} ms</span>
          </div>
        </div>
        <div className="field">
          <label htmlFor="minvel">Mindestlautstärke</label>
          <div className="inline">
            <input id="minvel" type="range" min={0} max={80} step={1} value={params.min_velocity}
              onChange={(e) => onChange({ min_velocity: Number(e.target.value) })} />
            <span className="unit">{params.min_velocity}</span>
          </div>
        </div>
        <div className="field">
          <label htmlFor="transpose">Transponieren</label>
          <div className="inline">
            <input id="transpose" type="number" min={-12} max={12} step={1} value={params.transpose}
              onChange={(e) => onChange({ transpose: clamp(Number(e.target.value), -12, 12) })} />
            <span className="unit">Halbtöne</span>
          </div>
        </div>
        <div className="field">
          <label className="checkbox">
            <input type="checkbox" checked={params.pedal} onChange={(e) => onChange({ pedal: e.target.checked })} />
            Pedalzeichen
          </label>
        </div>
        <div className="field">
          <label htmlFor="title">Titel</label>
          <input id="title" type="text" key={params.title} defaultValue={params.title}
            onBlur={(e) => e.target.value !== params.title && onChange({ title: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="composer">Komponist</label>
          <input id="composer" type="text" key={params.composer} defaultValue={params.composer}
            onBlur={(e) => e.target.value !== params.composer && onChange({ composer: e.target.value })} />
        </div>
      </fieldset>
    </section>
  );
}

function clamp(value: number, lo: number, hi: number): number {
  return Number.isFinite(value) ? Math.max(lo, Math.min(hi, Math.round(value))) : 0;
}

function formatQuarters(q: number): string {
  if (q === 1) return "1 Viertel";
  if (q === 0.5) return "1 Achtel";
  return `${q.toLocaleString("de-DE")} Viertel`;
}
