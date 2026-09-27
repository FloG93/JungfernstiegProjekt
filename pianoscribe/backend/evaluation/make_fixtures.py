"""Schneidet kurze Ausschnitte aus dem MAESTRO-Datensatz (v3.0.0, nur MIDI) als Fixtures.

Aufruf:  uv run python -m evaluation.make_fixtures <maestro-v3.0.0-Ordner>
Quelle:  https://magenta.tensorflow.org/datasets/maestro (CC BY-NC-SA 4.0)
"""

from __future__ import annotations

import sys
from pathlib import Path

from .synth import SynthNote, SynthPedal, read_midi, write_midi

FIXTURES = Path(__file__).parent / "fixtures"
EXCERPT_S = 20.0
LEAD_IN_S = 0.5

# (Dateiname, MAESTRO-MIDI, Start in s) – alle aus dem Test-Split von MAESTRO.
EXCERPTS = [
    ("maestro_chopin_op15_1.mid",
     "2015/MIDI-Unprocessed_R1_D1-9-12_mid--AUDIO-from_mp3_12_R1_2015_wav--3.midi", 8.0),
    ("maestro_chopin_op27_1.mid",
     "2011/MIDI-Unprocessed_22_R2_2011_MID--AUDIO_R2-D5_10_Track10_wav.midi", 10.0),
    ("maestro_bach_bwv858.mid",
     "2015/MIDI-Unprocessed_R1_D1-1-8_mid--AUDIO-from_mp3_02_R1_2015_wav--1.midi", 5.0),
]


def excerpt(notes: list[SynthNote], pedals: list[SynthPedal], start: float,
            length: float = EXCERPT_S) -> tuple[list[SynthNote], list[SynthPedal]]:
    end = start + length
    shift = start - LEAD_IN_S
    cut_notes = [SynthNote(n.pitch, n.start - shift, min(n.end, end) - shift, n.velocity)
                 for n in notes if start <= n.start < end]
    cut_pedals = [SynthPedal(max(p.start, start) - shift, min(p.end, end) - shift)
                  for p in pedals if p.end > start and p.start < end]
    return cut_notes, cut_pedals


def main(argv: list[str]) -> int:
    root = Path(argv[0])
    FIXTURES.mkdir(exist_ok=True)
    for name, midi, start in EXCERPTS:
        notes, pedals = read_midi(root / midi)
        cut_notes, cut_pedals = excerpt(notes, pedals, start)
        write_midi(FIXTURES / name, cut_notes, cut_pedals, bpm=120.0)
        print(f"{name}: {len(cut_notes)} Noten, {len(cut_pedals)} Pedal-Events")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
