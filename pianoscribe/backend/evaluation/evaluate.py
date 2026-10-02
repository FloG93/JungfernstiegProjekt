"""Evaluation mit echten Modellen: Transkriptions-F1 und Notationsgenauigkeit.

Rendert die Fixtures (Demo-Stück und MAESTRO-Ausschnitte) mit den Salamander-Samples, optional
als dichten Mix mit Schlagzeug/Bass/Pad, und misst:

* Noten-F1 der Transkription (mir_eval, Onset ±50 ms; zusätzlich mit Offsets, dabei werden die
  Offsets der Ground Truth wie bei MAESTRO um das Pedal verlängert),
* für das Demo-Stück die Genauigkeit der fertigen Notation (Positionen, Hände, Dauern).

Aufruf:  PIANOSCRIBE_MODELS=<ordner> uv run python -m evaluation.evaluate [--mix] [--separate]
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Any

import numpy as np

from pianoscribe.audio import BEATS_PEAK, TRANSCRIBE_PEAK, normalize_peak, resample, to_mono
from pianoscribe.notation.notate import notate
from pianoscribe.project import NotationParams
from pianoscribe.runtime import Reporter

from .metrics import NoteScore, beat_f, note_f1
from .notation_eval import compare, demo_truth
from .synth import (
    SynthNote,
    SynthPedal,
    demo_piece,
    mix,
    read_midi,
    render_drums,
    render_piano,
    render_synth,
)

FIXTURES = Path(__file__).parent / "fixtures"
SR = 44100


def extend_by_pedal(notes: list[SynthNote], pedals: list[SynthPedal]) -> list[SynthNote]:
    out = []
    for n in notes:
        end = n.end
        for p in pedals:
            if p.start <= end < p.end:
                end = p.end
        later = [m.start for m in notes if m.pitch == n.pitch and m.start > n.start]
        out.append(SynthNote(n.pitch, n.start, min([end, *later]), n.velocity))
    return out


def _dense_mix(piano: np.ndarray, duration: float, beats: list[float] | None = None,
               bpm: float = 100.0) -> np.ndarray:
    """Schlagzeug und Bass dazu; ohne bekannte Beats mit festem Tempo (Stresstest)."""
    if beats is None:
        beats = list(np.arange(0.5, duration + 1, 60.0 / bpm))
    drums = render_drums(beats, 4, beats[0], duration + 2, SR)
    bass = render_synth([SynthNote(36 + 5 * (i % 3), b, b + 1.1, 90)
                         for i, b in enumerate(beats[::2])], duration + 2, SR, cutoff=700)
    return mix([(piano, 1.0), (drums, 0.5), (bass, 0.3)])


def _scores(truth: list[SynthNote], pedals: list[SynthPedal],
            est: list[tuple[float, float, int]]) -> dict[str, NoteScore]:
    ref = [(n.start, n.end, n.pitch) for n in truth]
    ref_ped = [(n.start, n.end, n.pitch) for n in extend_by_pedal(truth, pedals)]
    return {"onset": note_f1(ref, est), "offset": note_f1(ref_ped, est, with_offsets=True)}


def evaluate(device: str, use_mix: bool, separate: bool) -> list[dict[str, Any]]:
    from pianoscribe.pipeline import ModelEngines

    engines = ModelEngines(device)
    transcriber = engines.transcriber("bytedance")
    reporter = Reporter()
    cases: list[tuple[str, list[SynthNote], list[SynthPedal], list[float] | None]] = []
    piece = demo_piece()
    cases.append(("demo", piece.notes, piece.pedals, piece.beats))
    for path in sorted(FIXTURES.glob("maestro_*.mid")):
        notes, pedals = read_midi(path)
        cases.append((path.stem, notes, pedals, None))

    rows = []
    for name, notes, pedals, true_beats in cases:
        audio = mix([(render_piano(notes, pedals, SR), 1.0)])  # normalisiert wie eine Datei
        duration = max(n.end for n in notes)
        if use_mix:
            audio = _dense_mix(audio, duration, true_beats)
        started = time.perf_counter()
        source = audio
        if separate:
            source = engines.separator("htdemucs_6s").separate(audio, SR, reporter)["piano"]
        mono = normalize_peak(resample(to_mono(source), SR, transcriber.sample_rate),
                              peak=TRANSCRIBE_PEAK, max_gain_db=12.0)
        result = transcriber.transcribe(mono, reporter)
        est = [(n.onset, n.offset, n.pitch) for n in result.notes]
        row: dict[str, Any] = {"case": name, "seconds": round(time.perf_counter() - started, 1)}
        row.update({k: v.__dict__ for k, v in _scores(notes, pedals, est).items()})
        if name == "demo":
            beats = engines.beat_tracker().track(normalize_peak(audio, BEATS_PEAK), SR, reporter)
            row["beat_f"] = round(beat_f(piece.beats, beats.beats), 3)
            notation = notate(result.notes, result.pedals, beats.beats, beats.downbeats,
                              NotationParams())
            row["notation"] = compare(notation.playback["notes"], demo_truth()).__dict__
        rows.append(row)
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda"])
    parser.add_argument("--mix", action="store_true", help="Klavier in einen dichten Mix legen")
    parser.add_argument("--separate", action="store_true", help="vorher mit Demucs trennen")
    parser.add_argument("--out", type=Path, help="Bericht als JSON speichern")
    args = parser.parse_args()
    rows = evaluate(args.device, args.mix, args.separate)
    print(f"{'Fall':26s} {'F1':>6s} {'P':>6s} {'R':>6s} {'F1+Off':>7s}  Notation")
    for row in rows:
        on, off = row["onset"], row["offset"]
        notation = ""
        if "notation" in row:
            n = row["notation"]
            notation = (f"Onsets {n['onset_correct']}/{n['truth']}, Hände {n['hand_correct']}, "
                        f"Dauern {n['duration_correct']}, Beat-F {row['beat_f']}")
        print(f"{row['case']:26s} {on['f1']:6.3f} {on['precision']:6.3f} {on['recall']:6.3f} "
              f"{off['f1']:7.3f}  {notation}")
    if args.out:
        args.out.write_text(json.dumps(rows, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
