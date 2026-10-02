// Export: PDF (Verovio → jsPDF), MusicXML (für MuseScore), MIDI quantisiert und roh.

import { useState } from "react";

import { api } from "../api/client";
import { saveFile } from "../bridge";

interface Props {
  projectId: string;
  baseName: string;
  enabled: boolean;
  musicxml: string | null;
}

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "Noten";
}

export function ExportPanel({ projectId, baseName, enabled, musicxml }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const name = safeName(baseName);

  const run = async (label: string, task: () => Promise<boolean>) => {
    setBusy(label);
    setMessage(null);
    try {
      const saved = await task();
      setMessage(saved ? `${label} gespeichert.` : null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="panel export-panel" aria-label="Export">
      <h2>Export</h2>
      <div className="export-buttons">
        <button type="button" className="btn primary" disabled={!enabled || !musicxml || busy !== null}
          onClick={() => run("PDF", async () => {
            const { renderPdf } = await import("../lib/pdf"); // jsPDF erst bei Bedarf laden
            return saveFile(`${name}.pdf`, "PDF (*.pdf)", await renderPdf(musicxml!));
          })}>
          {busy === "PDF" ? "PDF wird erstellt …" : "PDF"}
        </button>
        <button type="button" className="btn" disabled={!enabled || busy !== null}
          title="Zum Weiterbearbeiten, z. B. in MuseScore"
          onClick={() => run("MusicXML", async () =>
            saveFile(`${name}.musicxml`, "MusicXML (*.musicxml)", await api.file(projectId, "score.musicxml")))}>
          MusicXML
        </button>
        <button type="button" className="btn" disabled={!enabled || busy !== null}
          onClick={() => run("MIDI", async () =>
            saveFile(`${name}.mid`, "MIDI (*.mid)", await api.file(projectId, "score.mid")))}>
          MIDI (quantisiert)
        </button>
        <button type="button" className="btn" disabled={!enabled || busy !== null}
          title="Die unbearbeitete Transkription mit originalem Timing"
          onClick={() => run("MIDI (roh)", async () =>
            saveFile(`${name} (roh).mid`, "MIDI (*.mid)", await api.file(projectId, "raw.mid")))}>
          MIDI (roh)
        </button>
      </div>
      {message && <p className="hint">{message}</p>}
    </section>
  );
}
