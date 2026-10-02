"""Metriken für die Evaluation: Noten-F1 (mir_eval) und Beat-F-Measure."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import mir_eval
import numpy as np


@dataclass(frozen=True)
class NoteScore:
    precision: float
    recall: float
    f1: float
    n_ref: int
    n_est: int

    def __str__(self) -> str:
        return (f"P={self.precision:.3f} R={self.recall:.3f} F1={self.f1:.3f} "
                f"(ref={self.n_ref}, est={self.n_est})")


def _arrays(notes: Sequence[tuple[float, float, int]]) -> tuple[np.ndarray, np.ndarray]:
    if not notes:
        return np.zeros((0, 2)), np.zeros(0)
    intervals = np.array([[on, max(off, on + 1e-3)] for on, off, _ in notes], dtype=float)
    pitches = np.array([440.0 * 2 ** ((p - 69) / 12) for _, _, p in notes], dtype=float)
    return intervals, pitches


def note_f1(ref: Sequence[tuple[float, float, int]], est: Sequence[tuple[float, float, int]],
            onset_tolerance: float = 0.05, with_offsets: bool = False) -> NoteScore:
    """Noten-F1 wie im MAESTRO-Paper: Onset ±50 ms, optional Offset (20 % bzw. 50 ms)."""
    ref_i, ref_p = _arrays(ref)
    est_i, est_p = _arrays(est)
    if len(ref_i) == 0 or len(est_i) == 0:
        return NoteScore(0.0, 0.0, 0.0, len(ref_i), len(est_i))
    p, r, f, _ = mir_eval.transcription.precision_recall_f1_overlap(
        ref_i, ref_p, est_i, est_p, onset_tolerance=onset_tolerance,
        offset_ratio=0.2 if with_offsets else None,
    )
    return NoteScore(float(p), float(r), float(f), len(ref_i), len(est_i))


def beat_f(ref: Sequence[float], est: Sequence[float], tolerance: float = 0.07) -> float:
    """F-Measure für Beat-Zeitpunkte (Toleranz ±70 ms)."""
    if len(ref) == 0 or len(est) == 0:
        return 0.0
    return float(mir_eval.beat.f_measure(np.asarray(ref, float), np.asarray(est, float),
                                         f_measure_threshold=tolerance))
