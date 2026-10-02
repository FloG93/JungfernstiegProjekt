# PianoScribe – Umsetzungsplan für Claude Code

> Arbeitstitel „PianoScribe“ (frei änderbar). Diese Datei ins Repo-Root legen und Claude Code damit starten:
> *„Lies PLAN.md und setze Phase 0 um.“*

## 1. Ziel

Eine **private, vollständig lokale Windows-Desktop-App (.exe)**, die:

1. eine Audiodatei (MP3, M4A, FLAC, WAV, OGG) lädt,
2. per Wellenform einen Ausschnitt mit dem Klavierteil trimmen lässt,
3. das Klavier aus dem Mix isoliert (Source Separation),
4. das isolierte Klavier in MIDI transkribiert,
5. daraus ein **lesbares Klaviernotenblatt** (Violin- und Bassschlüssel) erzeugt,
6. die Noten **in der App anzeigt** und abspielbar macht (A/B-Vergleich mit dem Original),
7. als **PDF** exportiert, zusätzlich als MusicXML und MIDI.

Die App nutzt keine Cloud-Dienste und keine kommerziellen Tools. Nach dem einmaligen Modell-Download läuft sie komplett offline.

**Zielsystem:** Windows 11 64-bit, NVIDIA-GPU (CUDA). Ohne GPU läuft sie langsam auf der CPU weiter.

---

## 2. Architekturentscheidungen (bereits getroffen)

| Bereich | Entscheidung | Begründung |
|---|---|---|
| Desktop-Hülle | **pywebview** (Edge WebView2, auf Win 11 vorinstalliert) | Ein Python-Prozess, keine Rust- oder Node-Runtime zur Laufzeit, natives Fenster und Dateidialoge |
| Backend | **Python 3.11 + FastAPI + uvicorn**, im selben Prozess auf `127.0.0.1:<zufälliger Port>` | Alle ML-Modelle sind Python/PyTorch; 3.11 ist die sicherste Version für die Modell-Pakete |
| Frontend | **React + Vite + TypeScript**, als statischer Build von FastAPI ausgeliefert | Bekannter Stack |
| Paketmanager | **uv** (Python), **npm** (Frontend) | Schnell, reproduzierbar mit Lockfiles |
| Separation | **Demucs `htdemucs_6s`** (liefert einen eigenen `piano`-Stem) | Beste frei verfügbare Option mit dediziertem Piano-Stem |
| Transkription | **ByteDance Piano Transcription** (`piano_transcription_inference`) | Auf Klavier spezialisiert, sehr präzise, erkennt das Sustain-Pedal |
| Beat-/Takterkennung | **beat_this** (CPJKU, ISMIR 2024) | Modern, PyTorch-basiert, liefert Beats **und** Downbeats; madmom ist veraltet |
| MIDI → Notation | **Eigene Quantisierungsstufe + music21** → MusicXML | Das ist der Kern der Qualität und wird selbst gebaut (siehe Abschnitt 5) |
| Notenanzeige | **Verovio** (npm `verovio`, WASM) | Rendert MusicXML zu SVG, sauberer Notensatz, liefert auch Seitenumbrüche |
| PDF-Export | **Verovio-SVG-Seiten → jsPDF + svg2pdf.js** im Frontend, Speichern über den pywebview-Dateidialog | Das PDF sieht exakt so aus wie die Anzeige; keine Cairo-DLLs nötig |
| Wellenform & Trimmen | **wavesurfer.js v7** + Regions-Plugin | Standard, gut dokumentiert |
| MIDI-Wiedergabe | **Tone.js** + `@tonejs/midi` + lokal gebündelte Salamander-Piano-Samples (CC-BY) | Offline, gut klingend |
| Audio-Dekodierung | **ffmpeg.exe** (gebündelt), Aufruf per subprocess | Robuste Unterstützung aller Formate |
| Packaging | **PyInstaller (onedir) + Inno Setup** | Bewährt für PyTorch-Apps; Modelle werden beim ersten Start geladen, nicht gebündelt |

Die Separation und die Transkription werden **hinter Interfaces** gekapselt (`Separator`, `Transcriber`), damit später bessere Modelle eingesteckt werden können (z. B. RoFormer-Separatoren, hFT-Transformer, Basic Pitch als leichter Fallback).

---

## 3. Gesamtablauf (Pipeline)

```
Audiodatei
  │ ffmpeg → WAV 44.1 kHz Stereo (Arbeitskopie)
  ▼
[1] Trim            Start/Ende aus der UI (Sekunden) → trimmed.wav
  ▼
[2] Separation      Demucs htdemucs_6s → piano.wav   (optional überspringbar,
  │                                                   wenn der Ausschnitt reines Klavier ist)
  ▼
[3] Transkription   piano_transcription_inference (16 kHz mono) → raw.mid
  │                 (Noten mit Onset/Offset/Velocity + Pedal-Events)
  ▼
[4] Rhythmusanalyse beat_this auf trimmed.wav (NICHT auf piano.wav, der volle Mix
  │                 hat die klareren Beats) → beats[], downbeats[]
  ▼
[5] Notation        raw.mid + Beats + Nutzerparameter → Quantisierung,
  │                 Händetrennung, Tonart, Takt → score.musicxml
  ▼
[6] Anzeige/Export  Verovio (SVG) · PDF · MusicXML · MIDI (quantisiert + roh)
```

**Wichtigstes Designprinzip: Stufen-Caching.** Jede Stufe schreibt ihr Ergebnis in den Projektordner und merkt sich einen Hash ihrer Eingaben und Parameter. Ändert der Nutzer nur Notationsparameter (Tempo, Raster, Split-Punkt, Tonart), läuft **nur Stufe 5** neu. Sie braucht unter einer Sekunde, ohne GPU. Das macht das iterative Nachjustieren in der UI flüssig.

---

## 4. Projekt- und Datenstruktur

### Repo-Layout

```
pianoscribe/
├─ PLAN.md
├─ CLAUDE.md                 # Konventionen/Befehle für Claude Code (in Phase 0 anlegen)
├─ backend/
│  ├─ pyproject.toml         # uv, Python 3.11, gepinnte Versionen
│  ├─ pianoscribe/
│  │  ├─ main.py             # Einstieg: startet uvicorn-Thread + pywebview-Fenster
│  │  ├─ api/                # FastAPI-Routen
│  │  ├─ jobs.py             # Job-Queue (1 Worker-Thread, GPU-seriell)
│  │  ├─ project.py          # Projektordner, Manifest, Stufen-Cache
│  │  ├─ audio.py            # ffmpeg-Wrapper, Trim, Resampling
│  │  ├─ separation/         # Separator-Interface + DemucsSeparator
│  │  ├─ transcription/      # Transcriber-Interface + ByteDanceTranscriber
│  │  ├─ rhythm.py           # beat_this-Wrapper
│  │  ├─ notation/           # quantize.py, hands.py, key.py, build_score.py
│  │  ├─ models.py           # Modell-Download/-Verwaltung, Pfade
│  │  └─ cli.py              # CLI für die Pipeline ohne UI (Tests/Debugging)
│  └─ tests/
├─ frontend/
│  ├─ package.json
│  └─ src/
│     ├─ api/                # typisierter API-Client
│     ├─ components/         # Waveform, ScoreView, Player, ParamsPanel, JobProgress
│     └─ pages/              # Start (Projektliste), Editor
├─ packaging/
│  ├─ pianoscribe.spec       # PyInstaller
│  └─ installer.iss          # Inno Setup
└─ assets/
   ├─ ffmpeg/                # ffmpeg.exe (nicht einchecken, Download-Skript)
   └─ samples/salamander/    # Piano-Samples für die Wiedergabe
```

### Laufzeitdaten (außerhalb des Programmordners)

```
%LOCALAPPDATA%\PianoScribe\
├─ models\                   # Demucs-, ByteDance- und beat_this-Gewichte
├─ projects\<uuid>\
│  ├─ project.json           # Manifest (siehe unten)
│  ├─ source.<ext>           # Originaldatei (Kopie)
│  ├─ work.wav               # dekodiert
│  ├─ trimmed.wav
│  ├─ stems\piano.wav        # (+ die übrigen Stems, für ein späteres Feature)
│  ├─ raw.mid
│  ├─ beats.json
│  ├─ score.musicxml
│  └─ score.mid              # quantisiert
└─ settings.json
```

### `project.json` (Manifest)

```json
{
  "id": "uuid",
  "name": "Songtitel – Intro",
  "created": "ISO-8601",
  "source": { "file": "source.mp3", "duration_s": 213.4 },
  "trim": { "start_s": 42.1, "end_s": 71.8 },
  "options": {
    "separate": true,
    "separator": "htdemucs_6s",
    "transcriber": "bytedance"
  },
  "notation": {
    "tempo_bpm": null,                // null = automatisch
    "time_signature": "4/4",
    "first_downbeat_s": null,         // null = automatisch
    "key": null,                      // null = automatisch, sonst z. B. "E- major"
    "grid": "auto",                   // "1/8" | "1/16" | "1/16+triplets" | "auto"
    "hand_split": { "mode": "auto", "pitch": 60 },
    "min_note_ms": 50,
    "min_velocity": 20,
    "transpose": 0,
    "title": "", "composer": ""
  },
  "stages": {
    "separate":   { "hash": "…", "done": true },
    "transcribe": { "hash": "…", "done": true },
    "rhythm":     { "hash": "…", "done": true },
    "notate":     { "hash": "…", "done": true }
  }
}
```

---

## 5. Die Notationsstufe (Kern der Qualität)

Aus korrektem MIDI ein **lesbares** Notenblatt zu machen, ist der schwierigste Teil. Hier die vorgegebene Logik. Jeder Schritt steht in einer eigenen Funktion mit Unit-Tests.

1. **Aufräumen:** Noten unter `min_note_ms` und unter `min_velocity` verwerfen (Geisternoten aus Separations-Artefakten). Doppelte Noten gleicher Tonhöhe, die sich überlappen, verschmelzen.
2. **Beat-Raster:** Beats aus beat_this übernehmen. Wenn der Nutzer `tempo_bpm` oder `first_downbeat_s` setzt, ein starres Raster daraus erzeugen (manuelle Werte haben Vorrang). Der erste Downbeat definiert Takt 1. Noten davor bilden einen Auftakt.
3. **Onset-Quantisierung:** Onsets auf die Beat-Position mappen (Beat-Index + Bruchteil, zwischen zwei Beats linear interpoliert, damit Tempo-Schwankungen abgefangen werden). Dann **pro Beat** das Raster wählen, das den kleinsten Fehler ergibt: 1/4-Teilung (Sechzehntel) oder 1/3-Teilung (Achteltriolen), mit einer Straf-Gewichtung gegen Triolen. So entstehen Triolen nur, wo sie wirklich hörbar sind. Bei `grid` ≠ `auto` gilt das feste Raster.
4. **Akkorde:** Onsets, die nach der Quantisierung auf dieselbe Rasterposition fallen, bilden einen Akkord.
5. **Dauern:** Die Offsets werden **ohne Pedal-Verlängerung** quantisiert. Notiert wird die gespielte Dauer, begrenzt auf den nächsten Onset derselben Hand. Pedal-Events werden als Pedalzeichen (Ped./*) notiert, nicht als lange Noten. Dauern auf notierbare Werte runden, Überhänge über Taktgrenzen mit Haltebögen darstellen.
6. **Händetrennung** (`hands.py`):
   - `mode: "fixed"`: Split bei `pitch` (Standard C4 = 60).
   - `mode: "auto"` (Standard): Pro Akkord oder Zeitfenster einen dynamischen Split bestimmen. Grundlage sind ein Abstandsmaß zum Median der letzten Noten jeder Hand (Hysterese) und die Regel, dass eine Hand maximal eine Dezime (~16 Halbtöne) umspannt. Einfach und nachvollziehbar halten; keine ML-Lösung im MVP.
7. **Stimmen:** Das MVP arbeitet mit einer Stimme pro Hand. Überlappende Noten mit unterschiedlichem Onset in derselben Hand werden gekürzt. Mehrere Stimmen pro System sind ein Ausbauthema.
8. **Tonart:** `music21` Key-Analyse (Krumhansl) auf den Tonhöhen, vom Nutzer überschreibbar. Die Tonart bestimmt die Schreibweise der Vorzeichen (Fis vs. Ges). Beim Transponieren die Tonart mitverschieben.
9. **Score bauen:** Mit `music21` eine Klavier-Partitur erzeugen: zwei `PartStaff`s (Violin- und Bassschlüssel) mit geschweifter Klammer in einer `StaffGroup`, dazu Taktart, Tonart, Tempoangabe, Titel und Pedalzeichen. Export als MusicXML. Zusätzlich die quantisierte Fassung als `score.mid` schreiben.

Alle Parameter kommen aus `project.json → notation`. Die Stufe ist eine **reine Funktion** `(raw_notes, beats, params) → musicxml` und damit gut testbar.

---

## 6. API (FastAPI)

Alle Routen liegen unter `/api`. Das Frontend wird unter `/` ausgeliefert.

| Methode | Route | Zweck |
|---|---|---|
| GET | `/api/health` | Status, GPU-Info (`torch.cuda.is_available()`, Name, VRAM), Modelle vorhanden? |
| GET | `/api/models` | Status der Modell-Downloads |
| POST | `/api/models/download` | Fehlende Modelle laden (Job) |
| GET | `/api/projects` | Projektliste |
| POST | `/api/projects` | Neues Projekt: `{ path }` eines lokalen Files (kommt vom nativen Dateidialog) → kopieren und dekodieren |
| GET | `/api/projects/{id}` | Manifest |
| PATCH | `/api/projects/{id}` | Trim, Optionen, Notationsparameter ändern |
| DELETE | `/api/projects/{id}` | Projekt löschen |
| GET | `/api/projects/{id}/audio/{kind}` | `source` · `trimmed` · `piano` (mit Range-Requests für wavesurfer) |
| GET | `/api/projects/{id}/waveform` | Vorberechnete Peaks (JSON), damit lange Songs sofort erscheinen |
| POST | `/api/projects/{id}/run` | Pipeline starten; `{ from_stage? }`. Führt nur Stufen mit geändertem Hash aus |
| GET | `/api/jobs/{job_id}` | Status: Stufe, Fortschritt 0–1, Log, Fehler |
| WS | `/api/ws` | Push-Events für Job-Fortschritt (Polling als Fallback) |
| GET | `/api/projects/{id}/score.musicxml` | MusicXML |
| GET | `/api/projects/{id}/score.mid` / `raw.mid` | MIDI-Dateien |

**Job-System:** eine In-Process-Queue mit **genau einem GPU-Worker-Thread**, damit sich die Modelle nicht um VRAM streiten. Die Notationsstufe (CPU) darf sofort und synchron laufen. Jobs sind abbrechbar (Cancel-Flag, zwischen den Stufen geprüft). Fehler landen strukturiert im Job-Status und werden in der UI verständlich angezeigt, zum Beispiel: „CUDA out of memory → Ausschnitt kürzen oder CPU-Modus“.

**pywebview-Bridge (`js_api`)** nur für native Funktionen:
- `open_audio_dialog() → path`
- `save_file_dialog(default_name, filetypes) → path`
- `write_file(path, base64)` für PDF, MusicXML und MIDI aus dem Frontend

---

## 7. Frontend (React + Vite + TS)

Die Oberfläche ist deutschsprachig, der Code englisch.

**Startseite:** Projektliste mit „Neues Projekt“ (nativer Dateidialog). Beim ersten Start zeigt ein Einrichtungsdialog den GPU-Status und startet den Modell-Download mit Fortschrittsanzeige.

**Editor-Seite**, von oben nach unten:
1. **Wellenform** (wavesurfer.js) des ganzen Songs mit **Trim-Region**, Zoom und Abspielen der Region. Ein Button „Ersten Taktschlag hier“ setzt `first_downbeat_s` per Klick oder Playhead. Optional: Tap-Tempo.
2. **Optionen:** „Klavier isolieren“ (an/aus) und ein Button „Transkribieren“ mit Fortschritt pro Stufe (Dekodieren → Isolieren → Transkribieren → Rhythmus → Noten).
3. **Notenansicht** (Verovio): seitenweise oder als Endlos-Scroll, mit Zoom. Beim Abspielen läuft ein Cursor mit und hebt die aktuelle Note hervor (Verovio liefert die Timemap).
4. **Player** mit Umschalter **Original · isoliertes Klavier · Noten (synthetisiert)**, synchron. Das ist das wichtigste Werkzeug, um die Transkription zu beurteilen.
5. **Parameter-Panel** (live, löst nur die Notationsstufe aus, mit Debounce): Tempo, Taktart, Tonart, Raster, Händetrennung (Auto/Fest + Split-Note), Mindestlänge und -lautstärke, Transponieren, Titel und Komponist.
6. **Export:** PDF · MusicXML (zum Nachbearbeiten in MuseScore) · MIDI (quantisiert) · MIDI (roh).

**PDF-Export:** Verovio mit A4-Seitenoptionen (`pageWidth`/`pageHeight` passend zu A4, Titel im Kopf) → `renderToSVG(page)` für jede Seite → jsPDF + svg2pdf.js → base64 → `write_file` über die Bridge.

---

## 8. Modelle und Abhängigkeiten – bekannte Stolpersteine

Das nimmt Claude Code die Recherche ab. **Die Versionen müssen trotzdem in Phase 0 per Spike verifiziert und dann gepinnt werden.**

- **PyTorch mit CUDA:** Über den offiziellen PyTorch-Index installieren (CUDA-12.x-Wheels), in `pyproject.toml` via uv-Index-Konfiguration. `torch`, `torchaudio` und die CUDA-Variante zusammen pinnen. Ohne GPU auf CPU zurückfallen, mit Warnung in der UI.
- **Demucs:** Das PyPI-Paket (`demucs` 4.0.x) ist älter als der GitHub-Stand. Die CLI-Funktion `demucs.api` gibt es im PyPI-Release nicht. Deshalb programmatisch über `demucs.pretrained.get_model("htdemucs_6s")` + `demucs.apply.apply_model` arbeiten. **Audio-I/O mit `soundfile` statt `torchaudio.save`**, weil neuere torchaudio-Versionen das Speichern umgebaut haben. Bekannte Schwäche: Die Demucs-Autoren selbst bezeichnen den Piano-Stem als die schwächste Quelle. Deshalb die Option „Separation überspringen“ und das austauschbare Interface.
- **VRAM:** Demucs mit `segment` und `split=True` betreiben. Bei OOM automatisch mit kleinerem Segment oder auf CPU wiederholen.
- **piano_transcription_inference:** erwartet 16 kHz mono (`load_audio(..., sr=16000, mono=True)`). Der Checkpoint (~170 MB) wird beim ersten Lauf von Zenodo geladen. Diesen Download in `models.py` kontrolliert übernehmen (Zielpfad unter `%LOCALAPPDATA%`, Fortschritt, Prüfsumme). Das Paket ist älter; seine `librosa`/`numpy`-Abhängigkeiten auf Kompatibilität mit dem restlichen Stack prüfen. Notfalls die Inferenz-Klasse vendoren, sie ist klein.
- **beat_this:** von GitHub installieren (nicht auf PyPI), Commit pinnen. Gewichte werden beim ersten Lauf geladen, ebenfalls in den Modellordner umleiten.
- **ffmpeg:** statischen Windows-Build per Skript nach `assets/ffmpeg/` laden. Nicht einchecken. Den Pfad in Dev und im PyInstaller-Bundle über eine Helper-Funktion auflösen (`sys._MEIPASS`).
- **Verovio (npm):** WASM-Modul asynchron initialisieren. Die Instanz für Rendern und Timemap wiederverwenden.
- **Salamander-Samples:** eine reduzierte Auswahl (jede kleine Terz, eine Velocity-Stufe) als MP3/OGG lokal bündeln; Tone.js `Sampler` interpoliert den Rest. Lizenzhinweis (CC-BY 3.0) in der About-Box.
- **PyInstaller + PyTorch:** Das Bundle wird mehrere GB groß (CUDA-DLLs). Das ist bei einer privaten App akzeptabel. `onedir` statt `onefile` wählen, weil `onefile` bei jedem Start Gigabytes entpacken würde. Hidden-Imports und Datendateien von demucs, music21 und beat_this in der `.spec` pflegen. music21 braucht keine externe Konfiguration (kein MuseScore-Pfad).

---

## 9. Phasenplan

Jede Phase endet lauffähig und getestet. **Keine Phase beginnen, bevor die vorherige grün ist.**

### Phase 0 – Setup & Spikes
- Repo-Struktur, `CLAUDE.md` (Befehle: `uv run …`, `npm run dev`, Tests, Lint), `.gitignore`.
- uv-Projekt mit Python 3.11, PyTorch CUDA; `torch.cuda.is_available()` verifizieren.
- **Spike-Skripte** (Wegwerfcode in `spikes/`): je ein Minimalaufruf von Demucs, ByteDance-Transkription, beat_this und music21 → MusicXML auf einer Testdatei. Laufzeiten und VRAM notieren, **funktionierende Versionen pinnen**.
- Ergebnis: `spikes/RESULTS.md` mit Versionen, Laufzeiten und Auffälligkeiten.

### Phase 1 – Pipeline als CLI
- `audio.py`, `separation/`, `transcription/`, `rhythm.py`, `project.py` mit Stufen-Cache.
- `cli.py`: `pianoscribe run <datei> --start 42.1 --end 71.8 [--no-separate]` → Projektordner mit allen Zwischenergebnissen.
- Notationsstufe zunächst naiv (festes 1/16-Raster, Split bei C4), damit die Kette Ende-zu-Ende steht.

### Phase 2 – Notationsqualität
- Abschnitt 5 vollständig umsetzen: adaptives Raster, Triolen, Auto-Händetrennung, Pedal, Haltebögen, Tonart.
- **Evaluations-Setup:** ein paar kurze Klavieraufnahmen mit Ground-Truth-MIDI als Fixtures (z. B. Ausschnitte aus dem MAESTRO-Datensatz). Mit `mir_eval` Note-F1 der Transkription messen. Für die Notation Unit-Tests auf synthetischen MIDI-Eingaben mit bekanntem Ergebnis (z. B. „gespielte Achtel mit ±20 ms Jitter → saubere Achtel“).
- Die CLI bekommt `--notate-only`, um Parameter schnell zu iterieren.

### Phase 3 – API & Jobs
- FastAPI-Routen aus Abschnitt 6, Job-Queue, WebSocket-Fortschritt, Range-Requests für Audio, Waveform-Peaks.
- API-Tests mit `httpx`/`pytest`; die GPU-Stufen in Tests mocken.

### Phase 4 – Frontend
- Vite + React + TS, typisierter API-Client.
- Reihenfolge: Projektliste → Wellenform + Trim → Pipeline-Start mit Fortschritt → Verovio-Anzeige → Player mit A/B/C-Umschaltung und mitlaufendem Cursor → Parameter-Panel (live) → Export (MusicXML/MIDI zuerst, dann PDF).
- In dieser Phase läuft alles noch im normalen Browser gegen `uvicorn` (schnelle Iteration). Die Bridge-Funktionen haben einen Browser-Fallback (Download-Link).

### Phase 5 – Desktop-Hülle
- `main.py`: freien Port wählen, uvicorn im Thread starten, pywebview-Fenster öffnen, `js_api` registrieren, beim Schließen sauber beenden (laufende Jobs abbrechen).
- Native Dialoge statt Browser-Fallback. Einrichtungsdialog mit Modell-Download beim ersten Start.

### Phase 6 – Packaging
- PyInstaller-`.spec` (onedir), Frontend-Build eingebettet, ffmpeg und Samples als Daten.
- Inno-Setup-Installer mit Startmenü-Eintrag und Deinstallation (die Modelle in `%LOCALAPPDATA%` optional mitlöschen).
- Smoke-Test auf einem sauberen Windows-Benutzerkonto.

### Phase 7 – Feinschliff (optional)
- Logging nach `%LOCALAPPDATA%\PianoScribe\logs`, verständliche Fehlermeldungen.
- Tastenkürzel (Leertaste = Play, `[`/`]` = Trim-Grenzen).
- Weitere Ideen fürs Backlog: alternative Separatoren (RoFormer), zwei Stimmen pro Hand, Akkordsymbole, Tempo-Map statt Einzeltempo, Übernahme der übrigen Stems, einfaches Korrigieren von Noten direkt in der App.

---

## 10. Qualitätsregeln für Claude Code

- Python: Type Hints überall, `ruff` + `pytest`. TypeScript strict, `eslint`.
- Keine Netzwerkzugriffe außer dem expliziten Modell-Download.
- Alle Pfade über eine zentrale `paths.py` (Dev vs. PyInstaller-Bundle vs. `%LOCALAPPDATA%`).
- GPU-Code nie im Request-Thread, immer über die Job-Queue.
- Jede Pipeline-Stufe ist einzeln per CLI aufrufbar und testbar.
- Nach jeder Phase: kurze Notiz in `CHANGELOG.md` und Tests grün.

## 11. Erwartungsmanagement

- Die beste Ergebnisqualität gibt es bei **klar hörbarem, prominentem Klavier**. Bei dichten Mixes entstehen Geisternoten; die Mindestlänge- und Mindestlautstärke-Filter und das Umschalten auf den Original-Mix im Player helfen bei der Beurteilung.
- Ziel ist eine **gute spielbare Vorlage**, keine druckfertige Edition. Für Feinkorrekturen gibt es den MusicXML-Export nach MuseScore.
- Rechtlich: Die App verarbeitet nur eigene lokale Dateien; die erzeugten Noten sind für den privaten Gebrauch.
