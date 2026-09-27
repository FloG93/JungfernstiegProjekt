// Einrichtungsdialog (GPU-Status, Modell-Download) und About-Box mit Lizenzhinweisen.

import { useEffect, useState } from "react";

import { api } from "../api/client";
import { isFinal, watchJob } from "../api/jobs";
import type { Health, Job, ModelStatus } from "../api/types";

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal">
        <header>
          <h2>{title}</h2>
          {onClose && <button type="button" className="btn subtle" onClick={onClose} aria-label="Schließen">✕</button>}
        </header>
        {children}
      </div>
    </div>
  );
}

function mb(bytes: number): string {
  return `${Math.round(bytes / 2 ** 20)} MB`;
}

export function SetupDialog({ health, onDone }: { health: Health; onDone: () => void }) {
  const [models, setModels] = useState<ModelStatus[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [device, setDevice] = useState(health.settings.device);
  const gpu = health.gpu;

  useEffect(() => {
    void api.models().then(setModels);
  }, []);

  useEffect(() => {
    if (!job || isFinal(job)) return;
    return watchJob(job, (update) => {
      setJob(update);
      if (update.status === "done") void api.models().then(setModels);
    });
  }, [job?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const missing = models.filter((m) => !m.installed);
  const total = missing.reduce((sum, m) => sum + m.size, 0);
  const downloading = job !== null && !isFinal(job);

  const finish = async () => {
    await api.patchSettings({ device, setup_done: true });
    onDone();
  };

  return (
    <Modal title="Einrichtung">
      <section className="setup-section">
        <h3>Grafikkarte</h3>
        {gpu.cuda_available ? (
          <p className="ok">
            ✔ {gpu.name} erkannt{gpu.vram_total_mb ? ` (${(gpu.vram_total_mb / 1024).toFixed(1)} GB VRAM)` : ""}.
            Die Berechnung läuft auf der GPU.
          </p>
        ) : (
          <p className="warning">
            Keine nutzbare NVIDIA-GPU gefunden – PianoScribe rechnet auf der CPU. Das funktioniert,
            dauert aber deutlich länger (etwa 1–2 Minuten pro 30 Sekunden Musik).
          </p>
        )}
        <label className="field-inline">
          Rechnen auf
          <select value={device} onChange={(e) => setDevice(e.target.value as typeof device)}>
            <option value="auto">Automatisch (GPU, wenn vorhanden)</option>
            <option value="cpu">Immer CPU</option>
          </select>
        </label>
      </section>
      <section className="setup-section">
        <h3>Modelle</h3>
        <ul className="model-list">
          {models.map((m) => (
            <li key={m.key} className={m.installed ? "ok" : ""}>
              {m.installed ? "✔" : "○"} {m.title} <span className="muted">({mb(m.size)}, {m.license})</span>
            </li>
          ))}
        </ul>
        {missing.length > 0 && (
          <p>Einmaliger Download von {mb(total)}. Danach arbeitet PianoScribe komplett offline.</p>
        )}
        {downloading && job && (
          <>
            <div className="progress"><div className="progress-bar" style={{ width: `${Math.round(job.progress * 100)}%` }} /></div>
            <p className="hint">{job.message} – {Math.round(job.progress * 100)} %</p>
          </>
        )}
        {job?.status === "error" && job.error && (
          <div className="error-box"><strong>{job.error.message}</strong><p>{job.error.hint}</p></div>
        )}
      </section>
      <footer className="modal-actions">
        {missing.length > 0 ? (
          downloading ? (
            <button type="button" className="btn danger" onClick={() => job && void api.cancelJob(job.id)}>Abbrechen</button>
          ) : (
            <button type="button" className="btn primary" onClick={() => void api.downloadModels().then(setJob)}>
              Modelle herunterladen
            </button>
          )
        ) : (
          <button type="button" className="btn primary" onClick={() => void finish()}>Fertig</button>
        )}
      </footer>
    </Modal>
  );
}

export function AboutDialog({ version, onClose }: { version: string; onClose: () => void }) {
  return (
    <Modal title="Über PianoScribe" onClose={onClose}>
      <p>Version {version}. Macht aus Audiodateien Klaviernoten – lokal, ohne Cloud.</p>
      <h3>Verwendete Modelle und Bibliotheken</h3>
      <ul className="licenses">
        <li>Demucs (Meta) – MIT</li>
        <li>ByteDance Piano Transcription / piano_transcription_inference (Qiuqiang Kong) – MIT</li>
        <li>beat_this (CPJKU, Johannes Kepler Universität Linz) – MIT</li>
        <li>music21 – BSD · Verovio – LGPL · wavesurfer.js – BSD · Tone.js – MIT · jsPDF / svg2pdf.js – MIT</li>
        <li>
          Klavierklang: <strong>Salamander Grand Piano V3</strong> von Alexander Holm, lizenziert unter
          Creative Commons Attribution 3.0 (CC BY 3.0).
        </li>
      </ul>
      <p className="muted">Die erzeugten Noten sind für den privaten Gebrauch bestimmt.</p>
    </Modal>
  );
}
