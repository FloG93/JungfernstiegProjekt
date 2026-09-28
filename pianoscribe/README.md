# PianoScribe

Private, vollständig lokale Windows-Desktop-App, die aus einer Audiodatei ein lesbares
Klaviernotenblatt macht:

1. Audiodatei laden (MP3, M4A, FLAC, WAV, OGG) und den Klavierteil auf der Wellenform trimmen
2. Klavier aus dem Mix isolieren (Demucs `htdemucs_6s`, abschaltbar)
3. Klavier nach MIDI transkribieren (ByteDance Piano Transcription, inkl. Sustain-Pedal)
4. Beats und Takte erkennen (beat_this)
5. Quantisieren, Hände trennen, Tonart bestimmen und daraus Noten in Violin- und Bassschlüssel
   setzen (music21 → MusicXML)
6. Noten in der App anzeigen (Verovio) und abspielen, im A/B/C-Vergleich
   Original · isoliertes Klavier · Noten
7. Export als PDF, MusicXML (z. B. für MuseScore) und MIDI

Nach dem einmaligen Modell-Download (~300 MB) läuft alles offline, ohne Cloud-Dienste.
Zielsystem ist Windows 11 64-bit mit NVIDIA-GPU (CUDA 13, Treiber ≥ 580). Ohne GPU läuft die
App auf der CPU, dann aber deutlich langsamer.

Plan und Architektur: [`PLAN.md`](PLAN.md) · Spike-Ergebnisse: [`spikes/RESULTS.md`](spikes/RESULTS.md) ·
Änderungen: [`CHANGELOG.md`](CHANGELOG.md)

## Entwicklung

Voraussetzungen: [uv](https://docs.astral.sh/uv/), Node.js 20+, ffmpeg (unter Linux aus dem
Paketmanager; unter Windows lädt `scripts/fetch_assets.py` einen statischen Build).

```bash
cd pianoscribe/backend
uv sync
uv run python ../scripts/fetch_assets.py   # Piano-Samples (+ ffmpeg unter Windows)
uv run pianoscribe models download         # Modellgewichte (~300 MB)
uv run pianoscribe selftest                # Installation prüfen
uv run pytest

cd ../frontend
npm ci
npm run dev                                # zusammen mit: uv run pianoscribe serve --dev
```

Weitere Befehle stehen in [`CLAUDE.md`](CLAUDE.md).

## Windows: Build und Installer

Der Build erzeugt einen Programmordner (PyInstaller, onedir) und daraus einen Installer
(Inno Setup). Wegen der CUDA-Bibliotheken von PyTorch ist der Ordner mehrere GB groß; der
Installer wird deshalb in `PianoScribe-Setup-<Version>.exe` plus `.bin`-Dateien aufgeteilt, die
zusammen im selben Ordner liegen müssen.

**Fertiger Installer aus GitHub Actions:** Der Workflow „PianoScribe Windows-Build“ baut bei
Änderungen am Packaging (oder von Hand gestartet) unter Windows, führt den Selbsttest mit echten
Modellen aus und stellt das Artefakt `PianoScribe-Setup-Windows` 14 Tage lang bereit
(Actions → Lauf auswählen → Artifacts). ZIP entpacken und die Setup-Datei starten.

**Selbst bauen** (Windows 10/11, etwa 20 GB freier Platz, 15–30 Minuten):

```powershell
winget install astral-sh.uv
winget install OpenJS.NodeJS.LTS
winget install JRSoftware.InnoSetup
winget install Git.Git
# neues Terminal öffnen, damit die Programme im PATH sind
git clone https://github.com/FloG93/JungfernstiegProjekt.git
cd JungfernstiegProjekt
powershell -ExecutionPolicy Bypass -File pianoscribe\packaging\build.ps1
```

`build.ps1` baut die Oberfläche, legt eine eigene Build-Umgebung an (`packaging\.venv-build`,
nur Laufzeit-Pakete aus `uv.lock` plus PyInstaller), lädt Klavier-Samples und ffmpeg, ruft
PyInstaller auf, testet das fertige Programm mit `pianoscribe-cli.exe selftest` und baut den
Installer. Optionen: `-SkipInstaller` (nur Programmordner), `-ModelTest` (Selbsttest mit
Modellen), `-SkipFrontend`, `-SkipSelfTest`, `-Iscc <Pfad zu ISCC.exe>`.

Ergebnis:

- `pianoscribe\packaging\Output\PianoScribe-Setup-<Version>.exe` (+ `.bin`) – Installer
- `pianoscribe\packaging\dist\PianoScribe\` – Programmordner, auch ohne Installation lauffähig:
  `PianoScribe.exe` (Fenster) und `pianoscribe-cli.exe` (Kommandozeile, gleiche Befehle wie
  `pianoscribe` in der Entwicklung)

### Installation und erster Start

- Installiert pro Benutzer ohne Administratorrechte nach `%LOCALAPPDATA%\Programs\PianoScribe`,
  mit Startmenü-Eintrag (Desktop-Verknüpfung optional).
- Voraussetzungen: Windows 10/11 64-bit und die Microsoft Edge WebView2 Runtime (bei Windows 11
  vorinstalliert; Installer und App weisen darauf hin, falls sie fehlt). Für die GPU ein
  NVIDIA-Treiber ab Version 580 (CUDA 13), sonst rechnet PianoScribe auf der CPU.
- Beim ersten Start lädt der Einrichtungsdialog die Modelle (~300 MB). Danach läuft alles offline.
- Laufzeitdaten liegen in `%LOCALAPPDATA%\PianoScribe` (`models`, `projects`, `logs`,
  `settings.json`). Die Deinstallation (Windows-Einstellungen → Apps) fragt, ob sie mitgelöscht
  werden sollen.

### Rauchtest und Fehlersuche

```powershell
$cli = "$env:LOCALAPPDATA\Programs\PianoScribe\pianoscribe-cli.exe"
& $cli selftest --models          # Dateien, ffmpeg, GPU, WebView2, Notation, alle drei Modelle
& $cli info                       # GPU, VRAM und Modellstatus als JSON
& $cli run lied.mp3 --start 30 --end 60 --timings   # Laufzeiten und VRAM je Stufe
```

Für den Test auf einem sauberen Benutzerkonto: Installer ausführen, `selftest --models`
aufrufen, dann in der App ein Projekt anlegen, transkribieren, abspielen und als PDF exportieren.
Das Log steht in `%LOCALAPPDATA%\PianoScribe\logs\pianoscribe.log`; mit der
Umgebungsvariable `PIANOSCRIBE_DEBUG=1` öffnen sich im Fenster die Entwicklerwerkzeuge.

## Continuous Integration

- `.github/workflows/pianoscribe.yml` – bei jeder Änderung unter `pianoscribe/`: Backend (ruff,
  mypy, pytest mit CPU-PyTorch und ffmpeg) und Frontend (eslint, tsc, vitest, Build).
- `.github/workflows/pianoscribe-windows.yml` – Windows-Build mit Selbsttest und Installer
  (bei Änderungen an Packaging oder Abhängigkeiten sowie von Hand).

## Lizenzen der verwendeten Modelle und Daten

- Demucs (Meta, MIT), ByteDance Piano Transcription / piano_transcription_inference
  (Qiuqiang Kong, MIT, gevendort), beat_this (CPJKU, MIT), music21 (BSD), Verovio (LGPL).
- Salamander Grand Piano V3 (Alexander Holm, CC BY 3.0) für die Wiedergabe.

Die App verarbeitet nur eigene lokale Dateien. Die erzeugten Noten sind für den privaten Gebrauch
bestimmt.
