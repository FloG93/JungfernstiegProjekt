"""Spike: beat_this (Beats + Downbeats) mit lokalem Checkpoint, ohne torch.hub-Download.

Aufruf (aus backend/):  uv run python ../spikes/spike_beats.py <checkpoint> <audio.wav>...
"""

import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from beat_this.inference import Audio2Beats

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from evaluation.metrics import beat_f  # noqa: E402
from evaluation.synth import demo_piece  # noqa: E402


def main() -> None:
    checkpoint = sys.argv[1]
    device = "cuda" if torch.cuda.is_available() else "cpu"
    t0 = time.perf_counter()
    tracker = Audio2Beats(checkpoint_path=checkpoint, device=device, dbn=False)
    print(f"Modell geladen in {time.perf_counter() - t0:.1f}s auf {device}")
    piece = demo_piece()
    for path in sys.argv[2:]:
        audio, sr = sf.read(path, dtype="float32", always_2d=True)
        t0 = time.perf_counter()
        beats, downbeats = tracker(audio, sr)
        dt = time.perf_counter() - t0
        bpm = 60 / np.median(np.diff(beats)) if len(beats) > 1 else float("nan")
        print(f"{Path(path).name}: {len(beats)} Beats, {len(downbeats)} Downbeats, "
              f"~{bpm:.1f} BPM, {dt:.2f}s für {len(audio) / sr:.1f}s")
        print(f"   Beat-F {beat_f(piece.beats, beats):.3f}, Downbeat-F "
              f"{beat_f(piece.downbeats, downbeats):.3f}")
        print(f"   erste Beats {np.round(beats[:5], 3)}; erste Downbeats {np.round(downbeats[:3], 3)}")
    print(f"Soll: erste Beats {np.round(piece.beats[:5], 3)}; Downbeats {np.round(piece.downbeats[:3], 3)}")


if __name__ == "__main__":
    main()
