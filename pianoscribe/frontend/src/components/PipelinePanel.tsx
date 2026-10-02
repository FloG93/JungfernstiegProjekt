// Optionen und Start der Berechnung mit Fortschritt pro Stufe.

import type { Job, ProjectPayload, StageName } from "../api/types";
import { STAGES } from "../api/types";

const TITLES: Record<StageName, string> = {
  trim: "Dekodieren",
  separate: "Isolieren",
  transcribe: "Transkribieren",
  rhythm: "Rhythmus",
  notate: "Noten",
};

const STATE_LABEL: Record<string, string> = {
  pending: "wartet",
  running: "läuft",
  done: "fertig",
  cached: "unverändert",
  skipped: "übersprungen",
  error: "Fehler",
  cancelled: "abgebrochen",
};

interface Props {
  payload: ProjectPayload;
  job: Job | null;
  busy: boolean;
  onToggleSeparate(value: boolean): void;
  onRun(): void;
  onCancel(): void;
}

export function PipelinePanel({ payload, job, busy, onToggleSeparate, onRun, onCancel }: Props) {
  const { manifest, pending, has_score } = payload;
  const running = job !== null && (job.status === "queued" || job.status === "running");
  const needsRun = pending.length > 0;
  const label = !has_score ? "Transkribieren" : needsRun ? "Neu berechnen" : "Noten sind aktuell";

  return (
    <section className="panel pipeline-panel" aria-label="Berechnung">
      <h2>Berechnung</h2>
      <label className="checkbox">
        <input type="checkbox" checked={manifest.options.separate} disabled={running || busy}
          onChange={(e) => onToggleSeparate(e.target.checked)} />
        Klavier isolieren
        <span className="help" title="Trennt das Klavier mit Demucs vom Rest des Mixes. Abschalten, wenn der Ausschnitt nur Klavier enthält – das ist schneller und oft genauer.">?</span>
      </label>
      <div className="pipeline-actions">
        {running ? (
          <button type="button" className="btn danger" onClick={onCancel}>Abbrechen</button>
        ) : (
          <button type="button" className="btn primary" disabled={!needsRun || busy} onClick={onRun}>
            {label}
          </button>
        )}
      </div>
      {(job || has_score) && (
        <ol className="stages">
          {STAGES.map((stage) => {
            const state = job?.stages[stage] ?? (pending.includes(stage) ? "pending" : "done");
            const skipped = stage === "separate" && !manifest.options.separate;
            const shown = skipped ? "skipped" : state;
            return (
              <li key={stage} className={`stage stage-${shown}`}>
                <span className="stage-name">{TITLES[stage]}</span>
                <span className="stage-state">
                  {shown === "running" && job
                    ? `${Math.round(job.stage_progress * 100)} %`
                    : STATE_LABEL[shown] ?? shown}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {running && job && (
        <div className="progress" role="progressbar" aria-valuenow={Math.round(job.progress * 100)}>
          <div className="progress-bar" style={{ width: `${Math.round(job.progress * 100)}%` }} />
        </div>
      )}
      {job?.status === "error" && job.error && (
        <div className="error-box" role="alert">
          <strong>{job.error.message}</strong>
          {job.error.hint && <p>{job.error.hint}</p>}
        </div>
      )}
      {job?.log && job.log.length > 0 && job.status !== "error" && (
        <p className="hint">{job.log[job.log.length - 1]}</p>
      )}
    </section>
  );
}
