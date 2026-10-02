# Evaluation

Werkzeuge, um Transkription und Notation mit bekannter Ground Truth zu messen. Kein App-Code.

| Datei | Zweck |
|---|---|
| `synth.py` | Test-Audio: Klavier aus MIDI über die Salamander-Samples, dazu Schlagzeug, Bass, Pad; das Demo-Stück (Es-Dur, 96 BPM, Auftakt, Triolen) mit exakt bekannter Partitur |
| `metrics.py` | Noten-F1 (`mir_eval`, Onset ±50 ms, optional Offsets) und Beat-F-Measure |
| `notation_eval.py` | Vergleich der fertigen Notation (Viertelpositionen, Hände, Dauern) mit der Partitur des Demo-Stücks |
| `make_fixtures.py` | schneidet 20-s-Ausschnitte aus MAESTRO v3.0.0 (Test-Split) nach `fixtures/` |
| `evaluate.py` | rendert alle Fixtures, transkribiert (optional im Mix und/oder mit Separation) und gibt eine Tabelle aus |

```bash
PIANOSCRIBE_MODELS=<ordner> uv run python -m evaluation.evaluate [--mix] [--separate] [--out bericht.json]
```

## Fixtures

`fixtures/maestro_*.mid` sind Ausschnitte aus dem MAESTRO-Datensatz v3.0.0 (Curtis Hawthorne et
al., Google Magenta), Lizenz **CC BY-NC-SA 4.0**
(https://creativecommons.org/licenses/by-nc-sa/4.0/). Sie dienen nur der nicht-kommerziellen
Evaluation.

| Datei | Stück | Ausschnitt |
|---|---|---|
| `maestro_chopin_op15_1.mid` | Chopin, Nocturne op. 15 Nr. 1 | ab 8 s, 20 s |
| `maestro_chopin_op27_1.mid` | Chopin, Nocturne op. 27 Nr. 1 | ab 10 s, 20 s |
| `maestro_bach_bwv858.mid` | Bach, Präludium Fis-Dur BWV 858 | ab 5 s, 20 s |

## Ergebnisse (Stand Phase 2, CPU)

Noten-F1 der Transkription (Onset ±50 ms). „Mix“ = Klavier plus Schlagzeug und Bass.

| Fall | Klavier solo | Mix ohne Separation | Mix mit Separation |
|---|---|---|---|
| Demo-Stück | 0,995 | 0,772 | 0,892 |
| Bach BWV 858 | 0,973 | 0,867 | 0,895 |
| Chopin op. 15/1 | 0,918 | 0,847 | 0,856 |
| Chopin op. 27/1 | 0,961 | 0,861 | 0,832 |

Notation des Demo-Stücks (101 Noten): solo **101/101** Onsets, Hände und Dauern exakt; im Mix
mit Separation 99 Onsets, 97 Hände, 90 Dauern korrekt; ohne Separation 75/71/59.

Wichtige Befunde beim Tuning:

- **Beat-Regularisierung** (verpasste Beats auffüllen, Doppel-Beats entfernen, Frame-Jitter
  glätten) hob die Notationsgenauigkeit auf sauberem Klavier von 57 % auf 98 %.
- **Raster pro Hand**: Triolen rechts gegen Achtel links ließen sich mit einem gemeinsamen Raster
  nicht darstellen.
- **Pegel**: beat_this arbeitet bei Spitze 0,9 am besten, die Transkription bei 0,25–0,5 (lauter →
  mehr Geisternoten). Die Pipeline normalisiert deshalb getrennt (`audio.BEATS_PEAK`,
  `audio.TRANSCRIBE_PEAK`).
