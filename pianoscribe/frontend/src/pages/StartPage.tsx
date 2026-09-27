// Startseite: Projektliste und „Neues Projekt“ (nativer Dateidialog bzw. Upload im Browser).

import { useCallback, useEffect, useState } from "react";

import { api } from "../api/client";
import type { ProjectSummary } from "../api/types";
import { pickAudioFile } from "../bridge";
import { formatTime } from "../lib/timing";

export function StartPage({ onOpen }: { onOpen(id: string): void }) {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    api.projects().then(setProjects).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(reload, [reload]);

  const create = async () => {
    setError(null);
    const picked = await pickAudioFile();
    if (!picked) return;
    setCreating(true);
    try {
      const payload = picked.kind === "path"
        ? await api.createProject(picked.path)
        : await api.uploadProject(picked.file);
      onOpen(payload.manifest.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Die Datei konnte nicht geöffnet werden.");
    } finally {
      setCreating(false);
    }
  };

  const remove = async (project: ProjectSummary) => {
    if (!window.confirm(`Projekt „${project.name}“ wirklich löschen?`)) return;
    try {
      await api.deleteProject(project.id);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    }
  };

  return (
    <main className="start-page">
      <div className="start-header">
        <div>
          <h1>Projekte</h1>
          <p className="muted">Audiodatei öffnen, Klavierteil auswählen, Noten erhalten.</p>
        </div>
        <button type="button" className="btn primary large" disabled={creating} onClick={() => void create()}>
          {creating ? "Datei wird eingelesen …" : "＋ Neues Projekt"}
        </button>
      </div>
      {error && <div className="error-box" role="alert">{error}</div>}
      {projects === null ? (
        <p className="muted">Lade …</p>
      ) : projects.length === 0 ? (
        <div className="empty large">
          Noch keine Projekte. Mit „Neues Projekt“ eine MP3-, M4A-, FLAC-, WAV- oder OGG-Datei öffnen.
        </div>
      ) : (
        <ul className="project-list">
          {projects.map((p) => (
            <li key={p.id} className="project-card">
              <button type="button" className="project-open" onClick={() => onOpen(p.id)}>
                <span className="project-name">{p.name}</span>
                <span className="muted">
                  {p.source} · {formatTime(p.duration_s)} · Ausschnitt {formatTime(p.trim.start_s)}–{formatTime(p.trim.end_s)}
                </span>
                <span className="muted">{new Date(p.created).toLocaleString("de-DE")}</span>
              </button>
              {p.has_score && <span className="badge">Noten</span>}
              <button type="button" className="btn subtle" title="Projekt löschen" onClick={() => void remove(p)}>
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
