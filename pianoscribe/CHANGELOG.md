# Changelog

## Phase 1 – Pipeline als CLI

- `paths.py` (Dev/Bundle/`%LOCALAPPDATA%`, Overrides `PIANOSCRIBE_HOME`, `PIANOSCRIBE_MODELS`,
  `PIANOSCRIBE_FFMPEG`), `audio.py` (ffmpeg-Dekodierung ohne Konsolenfenster, Trim mit Fades,
  soxr-Resampling, Wellenform-Peaks), `models.py` (Katalog, Download mit Fortschritt, Abbruch und
  SHA-256).
- `project.py`: Manifest als pydantic-Modell, atomares Speichern, Lock pro Projekt,
  PATCH-Semantik mit Validierung, Stufen-Hashes (Notationsparameter lösen nur `notate` aus,
  `separate` aus → Rhythmus bleibt gecacht).
- Austauschbare Stufen hinter Interfaces: `Separator` (Demucs mit Segment-Fortschritt, Abbruch
  und CPU-Fallback bei Grafikspeichermangel), `Transcriber` (gevendorte ByteDance-Inferenz,
  Batch 4 auf CUDA), `BeatTracker` (beat_this).
- `pipeline.py`: Stufen Trim → Separation → Transkription → Rhythmus → Notation mit Cache,
  Fortschritts-Events, Abbruch, verständlichen Fehlern bei fehlenden Vorstufen, Laufzeit- und
  VRAM-Messung.
- Notationsstufe als reine Funktion (Phase-1-Umfang: festes Raster, Split bei C4) mit eigenem
  Taktgerüst, Auftakt, Rhythmus-Schreibweise mit Haltebögen, Tonart-Erkennung und -Schreibweise,
  music21-Partitur (zwei Systeme mit Klammer) → `score.musicxml`, `score.mid`, `score.json`
  (Wiedergabe-/Cursor-Daten), `raw.mid`.
- CLI `pianoscribe`: `run` (inkl. `--start/--end`, `--no-separate`, `--notate-only`, `--only`,
  `--from-stage`, alle Notationsparameter, `--timings`), `projects`, `show`, `delete`,
  `models [download]`, `info`.
- Tests: 73 schnelle Tests (Fakes statt Modelle) plus Ende-zu-Ende-Tests mit echten Modellen
  (`-m models`).

## Phase 0 – Setup & Spikes

- Projektstruktur `pianoscribe/` (Backend, Frontend, Packaging, Skripte, Spikes), `CLAUDE.md`,
  `.gitignore`.
- uv-Projekt mit Python 3.11; torch/torchaudio 2.11.0 mit CUDA 13.0 unter Windows und CPU-Wheels
  unter Linux, universelles `uv.lock`.
- Spikes für Demucs, ByteDance-Transkription, beat_this und music21 → MusicXML (mit Verovio-Prüfung).
  Ergebnisse, Versionen, Laufzeiten und Prüfsummen stehen in `spikes/RESULTS.md`.
- Abweichungen vom Plan: demucs 4.1.0 statt 4.0.x; beat_this von PyPI;
  piano_transcription_inference gevendort (Originalpaket mit aktuellem librosa defekt), bitgenau
  gegen das Original verifiziert; torch bleibt auf 2.11, weil torchaudio nicht mehr erscheint.
- `scripts/fetch_assets.py` lädt Salamander-Samples und unter Windows ffmpeg.
- `backend/evaluation/`: synthetisches Test-Audio mit Ground Truth (Salamander-Sampler, Drums,
  Bass, Pad) und Metriken (mir_eval).
