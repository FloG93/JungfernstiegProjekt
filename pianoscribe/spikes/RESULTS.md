# Phase 0 – Spike-Ergebnisse

Stand: 2026-09-27. Gemessen im Linux-Cloud-Container (4 vCPU, 15 GB RAM, **keine GPU**),
Python 3.11.15, uv 0.8.17. GPU-Laufzeiten und VRAM fehlen deshalb noch; wie man sie auf dem
Windows-Rechner nachmisst, steht ganz unten.

Testmaterial: synthetisches Demo-Stück aus `backend/evaluation/synth.py` (Ballade in Es-Dur,
4/4, 96 BPM, ein Viertel Auftakt, 8 Takte, Triolen/Synkopen/Sechzehntel, Sustain-Pedal), gerendert
mit den Salamander-Samples. Dazu ein Mix mit Schlagzeug, Bass und (optional) einem Pad im
Klavierregister. Weil das Stück aus MIDI entsteht, ist die Ground Truth exakt bekannt.

## Gepinnte Versionen

| Paket | Version | Anmerkung |
|---|---|---|
| torch / torchaudio | **2.11.0** (`+cu130` unter Windows, `+cpu` unter Linux) | torch ist schon bei 2.14, **torchaudio erscheint aber nur noch bis 2.11**. beat_this braucht torchaudio (MelSpectrogram), deshalb bleibt torch auf 2.11. cu130 passt zu RTX 20xx–50xx (Treiber ≥ 580). |
| demucs | **4.1.0** | Neuer als im Plan angenommen (4.0.x). Braucht kein torchaudio mehr, `apply_model` hat einen `callback` pro Segment. Laden über `get_model(name, repo=Path)` aus einem lokalen Ordner. |
| beat-this | **1.1.0** | Inzwischen **auf PyPI**; die GitHub-Installation ist nicht mehr nötig. |
| piano_transcription_inference | – (**gevendort**) | Originalpaket 0.0.6 ist mit librosa ≥ 0.10 **defekt** (`librosa.core.audio` fehlt) und lädt Gewichte per `wget` (nicht unter Windows). Inferenz gevendort nach `pianoscribe/transcription/bytedance_vendor/` (MIT). |
| music21 | **10.5.0** | Pedal-Spanner (`expressions.PedalMark`) werden exportiert. `note.Tie` heißt jetzt `tie.Tie`. |
| numpy | 2.4.6 | |
| fastapi / uvicorn | 0.141.1 / 0.54.0 | |
| pywebview | 6.2.1 | zieht unter Windows pythonnet 3.1.0 |
| verovio (Python, nur dev) | 6.3.0 | Für Tests: MusicXML → SVG mit derselben Engine wie im Frontend |

Die exakten Versionen aller Pakete stehen in `backend/uv.lock`, für Windows und Linux.

## Modelle

| Modell | Datei | Größe | SHA-256 | Quelle |
|---|---|---|---|---|
| Demucs htdemucs_6s | `5c90dfd2-34c22ccb.th` | 54 996 327 B | `34c22ccb381c6f9fdbf324f04e1e2fe21aaaf293f5ded163a162697ff9a02ddd` | `https://dl.fbaipublicfiles.com/demucs/hybrid_transformer/5c90dfd2-34c22ccb.th` |
| ByteDance Piano Transcription | `note_F1=0.9677_pedal_F1=0.9186.pth` | 171 966 578 B | `c3fa9730725bf4a762f1c14bc80cd5986eacda01b026f5a4a2525cd607876141` | Zenodo 4034264 |
| beat_this final0 | `final0.ckpt` | 81 058 141 B | `8c328b45f59d8dd3dff219253ff6a8d6482be57d0133a29140e2febbf8eb8331` | `https://cloud.cp.jku.at/public.php/dav/files/7ik4RrBKTS273gp/final0.ckpt` |

Zusammen etwa 300 MB. Alle drei Checkpoints lassen sich mit `torch.load(..., weights_only=True)` laden.

## Laufzeiten (CPU, 4 Threads, 25,5 s Audio)

| Stufe | Zeit | Echtzeitfaktor | Bemerkung |
|---|---|---|---|
| Demucs htdemucs_6s (`split=True`, `overlap=0.25`, `shifts=0`) | 14,9 s | 0,58 | RAM-Spitze 1,3 GB; Modell lädt in 1,4 s |
| Demucs mit `shifts=2` | ~40 s | ~1,6 | kaum besser (F1 0,61 → 0,63) → nicht Standard |
| ByteDance-Transkription (gevendort) | 18,4 s | 0,72 | Original: 19,8 s; Modell lädt in ~5 s |
| beat_this final0 (`dbn=False`) | 0,74 s | 0,03 | lädt in 0,3 s |
| music21: Partitur bauen + MusicXML | 0,7 s für 1 200 Noten, 2,9 s für 4 800 Noten | – | MIDI-Export über music21 ist ähnlich langsam → `score.mid` direkt mit mido schreiben |

Hochgerechnet auf einen 30-s-Ausschnitt ergibt das etwa 45 s auf der CPU. Mit GPU sollten es
nur wenige Sekunden sein (noch nachzumessen).

## Qualität

Noten-F1 mit `mir_eval` (Onset ±50 ms, ohne Offset):

| Eingabe | F1 | Precision | Recall |
|---|---|---|---|
| Klavier solo | **0,990** | 0,981 | 1,000 |
| Mix ohne Pad, Demucs-Klavier-Stem | 0,789 | 0,669 | 0,960 |
| Mix ohne Pad, ohne Separation | 0,618 | 0,604 | 0,634 |
| Mix mit Pad, Demucs-Klavier-Stem | 0,610 | 0,464 | 0,891 |
| Mix mit Pad, ohne Separation | 0,519 | 0,557 | 0,485 |

Beat-Erkennung (F-Measure, ±70 ms):

| Eingabe | Beats | Downbeats | Tempo |
|---|---|---|---|
| Mix | 0,944 | 0,947 | 96,8 BPM (Soll 96) |
| Klavier-Stem | 1,000 | 1,000 | 96,8 |
| Klavier solo | 0,903 | 0,941 | 96,8 |

Gevendorte Transkription gegen das Originalpaket: **bitgenau identisch** auf allen drei Eingaben
(gleiche Noten, Zeiten, Tonhöhen, Velocities und Pedal-Events).

## Auffälligkeiten → Konsequenzen für die Umsetzung

1. **Offsets sind pedalverlängert.** Die Notendauern der Transkription (Median 0,93 s) sind viel
   länger als die gespielten Tastendauern (0,30 s). Unter gedrücktem Pedal ist das Loslassen der
   Taste akustisch nicht hörbar, kein Modell kann es rekonstruieren. → In der Notationsstufe ist die
   Begrenzung „bis zum nächsten Onset derselben Hand“ entscheidend. Noten, deren Ende mit einem
   Pedal-Loslassen zusammenfällt, werden als pedalgehalten behandelt und für die Notation gekürzt.
2. **Geisternoten durch die Separation.** Der Klavier-Stem erhöht den Recall stark, enthält aber
   Reste von Bass, Schlagzeug und vor allem von Pads im Klavierregister. Die Velocity der
   Geisternoten liegt niedriger (Median 46 gegenüber 58), die Verteilungen überlappen aber. → Die
   Filter `min_velocity` und `min_note_ms` bleiben Nutzerparameter; der Player-Umschalter zum
   Original ist wichtig. Ein besserer Separator (RoFormer) bleibt Ausbauthema.
3. **Pedal-Erkennung auf synthetischem Audio ist unzuverlässig.** Der Sampler verlängert nur die
   Töne und hat keine Saitenresonanz, auf die das Modell reagiert. → Die Pedal-Genauigkeit lässt
   sich nur mit echten Aufnahmen beurteilen; Pedalzeichen bleiben abschaltbar.
4. **beat_this setzt einzelne Beats vor den Musikbeginn** (0,38 s, obwohl die Musik bei 1,0 s
   beginnt) und kann bei reinem Klavier den Auftakt-Beat verpassen. → Das Raster muss
   extrapolieren können und Beats ohne Noten tolerieren.
5. **music21:** `PartStaff`s in einer `StaffGroup` werden als *ein* `<part>` mit
   `<staves>2</staves>` exportiert (korrekt für Klavier; Verovio zeichnet die Klammer). Der
   Auftakttakt braucht `measure.showNumber = ShowNumber.NEVER`, sonst steht `implicit="no"`.
6. **Verovio-Timemap:** Die Einträge enthalten `qstamp` (Viertel ab Partiturbeginn, Auftakt ab 0),
   `tstamp` (ms beim notierten Tempo) und `on`/`off`-Element-IDs. → Für den mitlaufenden Cursor wird
   die Audiozeit über die Beat-Liste auf `qstamp` abgebildet, nicht über `tstamp`.
7. **ByteDance-Eigenheiten, die erhalten bleiben müssen:** BatchNorm2d mit `eps=0.01` (im Original
   versehentlich positionsbedingt so gesetzt, die Gewichte sind darauf trainiert). Noten ohne
   erkanntes Ende enden nach 6 s. Die Gewichte für STFT und Mel-Filter stecken im Checkpoint,
   deshalb braucht es kein librosa.
8. **demucs 4.1:** Der lokale Modellordner braucht `htdemucs_6s.yaml` und die `.th`-Datei.
   `LocalRepo` prüft den SHA-256-Präfix im Dateinamen. Der `callback` liefert
   `segment_offset`/`state` je Segment; damit gibt es Fortschritt und einen Abbruchpunkt.

## GPU-Werte auf dem Windows-Rechner nachmessen

Voraussetzung: Die Modelle liegen unter `%LOCALAPPDATA%\PianoScribe\models` (Einrichtungsdialog der
App oder `uv run pianoscribe models download`). Dann in `pianoscribe\backend`:

```powershell
uv sync
uv run python -c "import torch; print(torch.__version__, torch.cuda.is_available(), torch.cuda.get_device_name(0))"
uv run pianoscribe run ..\pfad\zum\song.mp3 --start 30 --end 60 --timings
```

`--timings` gibt Laufzeit und VRAM-Spitze je Stufe aus. Die Werte bitte hier ergänzen.
