# CLAUDE.md – PianoScribe

Konventionen und Befehle für Claude Code. Der Projektplan steht in `PLAN.md`, die verifizierten
Versionen und Messwerte in `spikes/RESULTS.md`. Der Rest des Repos (`kindle_meta/` usw.) ist ein
anderes Projekt und wird hier nicht angefasst.

## Aufbau

- `backend/` – Python 3.11, uv-Projekt, Paket `pianoscribe` (FastAPI, Pipeline, CLI, pywebview-Start)
  - `pianoscribe/notation/` – Quantisierung, Händetrennung, Tonart, Score-Aufbau (Kern der Qualität)
  - `pianoscribe/transcription/bytedance_vendor/` – gevendorte ByteDance-Inferenz (MIT, siehe LICENSE)
  - `evaluation/` – synthetisches Test-Audio (Salamander-Sampler) und Metriken (mir_eval); kein App-Code
  - `tests/` – pytest; Tests mit echten Modellen tragen den Marker `models`
- `frontend/` – React + Vite + TypeScript (strict), Verovio, wavesurfer.js, Tone.js
- `packaging/` – PyInstaller-Spec (onedir), Inno-Setup-Skript, `build.ps1`
- `scripts/fetch_assets.py` – lädt Salamander-Samples und (Windows) ffmpeg nach `assets/`
- `spikes/` – Wegwerfcode aus Phase 0 plus `RESULTS.md`

## Befehle

Backend (im Ordner `backend/`):

```bash
uv sync                                   # Umgebung (Linux: CPU-torch, Windows: CUDA 13.0)
uv run pytest                             # Tests ohne Modelle (schnell)
PIANOSCRIBE_MODELS=<ordner> uv run pytest -m models   # mit echten Modellen (langsam)
uv run ruff check .                       # Lint
uv run mypy pianoscribe                   # Typprüfung
uv run python ../scripts/fetch_assets.py  # Samples (+ ffmpeg unter Windows) laden
uv run pianoscribe models download        # Modellgewichte laden
uv run pianoscribe run song.mp3 --start 42.1 --end 71.8 [--no-separate]
uv run pianoscribe run --project <id> --notate-only --grid 1/8   # nur Notation neu
uv run pianoscribe serve --dev            # API auf http://127.0.0.1:8765 (für npm run dev)
uv run pianoscribe app                    # Desktop-Fenster (pywebview)
```

Frontend (im Ordner `frontend/`):

```bash
npm ci
npm run dev        # Vite auf :5173, leitet /api an :8765 weiter
npm run build      # nach frontend/dist (wird von FastAPI ausgeliefert)
npm run lint
npm run typecheck
npm test           # vitest
node e2e/smoke.mjs [url] [projektname]      # Browser-Rauchtest (Playwright, laufendes Backend)
node e2e/new-project.mjs <audio> [url]      # neues Projekt komplett durchrechnen
```

Playwright braucht einen Chromium; in der Cloud-Umgebung
`PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` setzen.

Windows-Build: `packaging\build.ps1` (Frontend bauen, Assets laden, PyInstaller, Inno Setup).

## Konventionen

- Bezeichner englisch, Docstrings, Kommentare und die gesamte Oberfläche deutsch.
- Python: Type Hints überall, `ruff` und `pytest` grün vor jedem Commit. TypeScript: `strict`,
  `eslint` grün.
- Alle Pfade über `pianoscribe/paths.py` (Dev, PyInstaller-Bundle, `%LOCALAPPDATA%`).
- Netzwerkzugriffe nur für den expliziten Modell-Download (`pianoscribe/models.py`).
- GPU-Code läuft nie im Request-Thread, sondern immer über die Job-Queue (`jobs.py`, ein Worker).
- Jede Pipeline-Stufe ist über die CLI einzeln aufrufbar und testbar. Stufen schreiben ihr Ergebnis
  in den Projektordner und merken sich einen Hash ihrer Eingaben (`project.py`).
- Die Notationsstufe ist eine reine Funktion `(raw_notes, beats, params) → Score` und kommt ohne
  GPU und Modelle aus.
- Zeiten im Projekt: `trim`, `first_downbeat_s` und Audio-Zeiten in der API beziehen sich auf die
  **Originaldatei**; Noten und Beats in `raw_notes.json`/`beats.json` auf den **getrimmten**
  Ausschnitt (0 = Trim-Start).
- Nach jeder Phase: Eintrag in `CHANGELOG.md`, Tests grün.
