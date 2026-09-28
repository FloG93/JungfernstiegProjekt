# Changelog

## Phase 6 – Packaging & CI

- PyInstaller-Spec (`packaging/pianoscribe.spec`, onedir): ein Programmordner mit
  `PianoScribe.exe` (Fenster, ohne Konsole) und `pianoscribe-cli.exe` (Kommandozeile) aus
  demselben Launcher; eingebettet sind Oberfläche, Klavier-Samples, ffmpeg (Windows) und die
  Modellbeschreibungen von demucs, Entwicklungswerkzeuge und fremde GUI-Toolkits sind
  ausgeschlossen. Windows-Dateieigenschaften (Version) und App-Icon (`pianoscribe.svg/.ico`,
  auch als Favicon).
- Inno-Setup-Installer (`packaging/installer.iss`): Installation pro Benutzer ohne
  Administratorrechte, Startmenü-Eintrag, optionale Desktop-Verknüpfung, Aufräumen alter
  Bundle-Dateien bei Updates, Hinweis mit Download-Link, falls die WebView2-Runtime fehlt. Die
  Deinstallation fragt, ob Projekte, Modelle, Einstellungen und Logs in
  `%LOCALAPPDATA%\PianoScribe` mitgelöscht werden. Wegen der Größe (CUDA) in Setup-EXE plus
  `.bin`-Dateien aufgeteilt.
- `packaging/build.ps1`: Oberfläche bauen, eigene Build-Umgebung aus `uv.lock` (ohne
  Dev-Pakete), Assets laden, PyInstaller, Rauchtest des fertigen Programms, Installer.
- Neuer Befehl `pianoscribe selftest [--models]`: prüft Programmdateien, Datenordner, ffmpeg
  (inkl. Dekodieren), PyTorch/GPU, Bibliotheken, WebView2 und die Notation; mit `--models`
  rechnen alle drei Modelle kurz synthetisches Audio. Grundlage für den Rauchtest im Build, in
  CI und beim Nutzer.
- Desktop-Hülle: prüft vor dem Fensterstart, ob Edge WebView2 verfügbar ist (sonst fiele
  pywebview still auf den IE-Renderer zurück) und zeigt sonst eine Meldung mit Download-Link;
  WebView2-Profil unter `<Datenordner>/webview` statt eines neuen Temp-Ordners bei jedem Start.
- GitHub Actions: `pianoscribe.yml` (Backend ruff/mypy/pytest, Frontend lint/typecheck/test/
  build) und `pianoscribe-windows.yml` (Windows-Build mit Modell-Selbsttest, Installer als
  Artefakt).
- Linux-Probebuild der Spec (CPU-PyTorch, 0,85 GB): `selftest --models` grün, Browser-Tests
  (`e2e/smoke.mjs`, `e2e/new-project.mjs`) gegen den Server aus dem Bundle grün.
- Kleinigkeit: Zahlen in der Oberfläche mit Dezimalkomma (Ausschnittsdauer, VRAM).

## Phase 5 – Desktop-Hülle

- `main.py`: freier Port, uvicorn im Hintergrund-Thread, pywebview-Fenster (Edge WebView2 unter
  Windows) mit Sitzungs-Token in der URL, deutsche Dialogtexte, Nachfrage beim Schließen während
  einer Berechnung, danach Jobs abbrechen und Server beenden.
- `js_api`-Bridge: `open_audio_dialog`, `save_file_dialog`, `write_file`. Geschrieben wird nur
  an vom Nutzer im Dialog gewählte Pfade mit erlaubten Endungen (PDF, MusicXML, MIDI).
- Datei-Log unter `<Datenordner>/logs/pianoscribe.log` (rotierend); im Fenster-Modus werden
  fehlende stdout/stderr abgefangen (sonst stürzen tqdm & Co. in der PyInstaller-App ab).
- Tests mit Fake-`webview` (Start/Stopp mit echtem Server und Token, Bridge-Regeln) sowie ein
  manueller Test mit echtem pywebview-Fenster (Qt-Backend unter Xvfb): Bridge-Funktionen
  vorhanden, Oberfläche und Projektliste laden, sauberes Beenden.

## Phase 4 – Frontend

- React 19 + Vite 8 + TypeScript 6 (strict), ESLint (typescript-eslint strict, React-Hooks v7),
  Vitest. Typisierter API-Client mit Sitzungs-Token, WebSocket-Jobs mit Polling-Fallback.
- Startseite mit Projektliste; „Neues Projekt“ über den nativen Dialog (pywebview) bzw.
  Upload-Fallback im Browser.
- Editor: Wellenform (wavesurfer.js 7, vorberechnete Peaks) mit Trim-Bereich, Zoom, Abspielen
  des Ausschnitts, Marker „Ersten Taktschlag hier“ und Tap-Tempo; Berechnung mit Fortschritt je
  Stufe, Abbruch und verständlichen Fehlern; Notenansicht mit Verovio (Endlos/Seiten, Größe,
  mitlaufende Hervorhebung, Klick auf Note springt dorthin); Player mit A/B/C-Umschaltung
  Original · Klavier · Noten (Tone.js, Salamander-Samples, synchron am Transport);
  Parameter-Panel live (nur Notationsstufe, mit Debounce); Export PDF (Verovio → jsPDF +
  svg2pdf.js), MusicXML, MIDI quantisiert und roh.
- Einrichtungsdialog (GPU-Status, CPU-Modus, Modell-Download mit Fortschritt), About-Box mit
  Lizenzhinweisen (Salamander CC BY 3.0), Tastenkürzel Leertaste und [ / ].
- PDF-Details: verschachtelte Verovio-SVGs werden für svg2pdf abgeflacht, Tempo-Glyphen als
  Text („Viertel = 96“), jsPDF wird erst bei Bedarf geladen.
- Backend liefert die Salamander-Samples unter `/samples` aus.
- Tests: 12 Vitest-Tests, Browser-Rauchtests mit Playwright (`e2e/smoke.mjs`,
  `e2e/new-project.mjs`) gegen das echte Backend.

## Phase 3 – API & Jobs

- FastAPI-App (`pianoscribe.api`) mit allen Routen aus Abschnitt 6: Health (GPU, Modelle,
  ffmpeg), Modellstatus und -download als Job, Projekte (anlegen per Pfad oder Upload-Fallback,
  PATCH, löschen), Audio mit Range-Requests, Wellenform-Peaks, Pipeline-Start, Jobs (Status,
  Liste, Abbruch), Ergebnisdateien, Einstellungen (CPU-Modus).
- Job-Queue mit genau einem GPU-Worker-Thread, Abbruch-Flag, gewichteter Gesamtfortschritt,
  verständliche deutsche Fehlermeldungen mit Hinweis (z. B. CUDA-Speicher → Ausschnitt kürzen
  oder CPU-Modus). Reine Notationsänderungen laufen sofort synchron.
- WebSocket `/api/ws` für Push-Fortschritt (Polling bleibt möglich).
- Schutz des lokalen Servers: Host-Prüfung (DNS-Rebinding), Sitzungs-Token (Header oder
  `?token=`), Konflikte (409) bei Änderungen von Ausschnitt/Optionen während einer Berechnung.
- `pianoscribe serve [--dev]`, Hintergrund-Server für die Desktop-Hülle (`server.py`).
- 12 API-Tests (TestClient, gemockte GPU-Stufen) plus Rauchtest mit echtem uvicorn und Modellen.

## Phase 2 – Notationsqualität

- Adaptives Raster: Viterbi über die Schläge wählt je Schlag Viertel/Achtel/Sechzehntel oder
  Achteltriolen (Zeitfehler in Sekunden, Komplexitäts- und Wechselstrafe); feste Raster `1/8`,
  `1/16`, `1/16+triplets`. Offsets auf dem feinen Raster.
- Händetrennung **vor** der Quantisierung, Raster **pro Hand** (Triolen gegen Achtel).
  Auto-Split mit Hysterese (Median + letzter Ton), Dezimen-Spanne, höchstens fünf Töne und
  Registerregel gegen Geisternoten.
- Beat-Raster: verpasste Beats auffüllen, Doppel-Beats entfernen, Frame-Jitter glätten (±25 ms).
- Dauern: Lücken bis ein Sechzehntel zum nächsten Anschlag bzw. Schlag schließen; Überhang nach
  dem letzten Takt kappen; Synkopen- und Pausenregeln in der Rhythmus-Schreibweise.
- Pedal: Ereignisse auf Anschläge einrasten, zu kurze verwerfen, als Pedal-Klammern setzen.
- Keine Instrumentenbezeichnung, explizite Triolenklammern.
- Pegel-Normalisierung vor Beat-Erkennung (0,9) und Transkription (0,4) – gemessen.
- Evaluation: MAESTRO-Ausschnitte (Test-Split) als Fixtures, `evaluation/evaluate.py` (F1 solo,
  im Mix, mit Separation), Notationsvergleich gegen die Partitur des Demo-Stücks. Ergebnisse in
  `backend/evaluation/README.md`.
- 19 neue Qualitätstests auf synthetischem MIDI (u. a. „Achtel mit ±20 ms Jitter → saubere
  Achtel“, Triolen, Polyrhythmus, Hände, Auftakt/Bindebögen, 3/4 und 6/8, Tonart, Transposition,
  Pedal, manuelles Tempo) plus Regressionstest „Demo-Stück wird exakt notiert“.

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
