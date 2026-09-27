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
uv run pytest

cd ../frontend
npm ci
npm run dev                                # zusammen mit: uv run pianoscribe serve --dev
```

Weitere Befehle stehen in [`CLAUDE.md`](CLAUDE.md).

## Lizenzen der verwendeten Modelle und Daten

- Demucs (Meta, MIT), ByteDance Piano Transcription / piano_transcription_inference
  (Qiuqiang Kong, MIT, gevendort), beat_this (CPJKU, MIT), music21 (BSD), Verovio (LGPL).
- Salamander Grand Piano V3 (Alexander Holm, CC BY 3.0) für die Wiedergabe.

Die App verarbeitet nur eigene lokale Dateien. Die erzeugten Noten sind für den privaten Gebrauch
bestimmt.
