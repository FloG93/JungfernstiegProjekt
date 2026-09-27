"""Quantisierung von Onsets und Offsets auf das Beat-Raster.

Positionen werden zunächst relativ zum Taktanker ``grid.bar_beat`` in Ticks berechnet; die
Verschiebung auf „Takt 1 = Tick 0“ passiert in ``layout``.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np

from .grid import BeatGrid
from .meter import SIXTEENTH, TimeSig
from .types import QNote, QPedal, RawNote, RawPedal

EIGHTH_FINEST = {"1/8"}


@dataclass
class BeatDivision:
    """Gewählte Teilung pro Beat (Beat-Index relativ zum Taktanker → Teilung)."""

    default: int
    per_beat: dict[int, int]

    def division(self, beat: int) -> int:
        return self.per_beat.get(beat, self.default)


def _fixed_division(ts: TimeSig, grid_mode: str) -> int:
    finest = SIXTEENTH if grid_mode not in EIGHTH_FINEST else SIXTEENTH * 2
    return max(ts.straight_divisions(finest))


def choose_divisions(onset_beats: np.ndarray, ts: TimeSig, grid_mode: str,
                     beat_seconds: Sequence[float] | None = None) -> BeatDivision:
    """Phase 1: festes Raster (1/8 oder 1/16) für alle Beats."""
    return BeatDivision(_fixed_division(ts, grid_mode), {})


def _snap(pos: float, division: int) -> float:
    return round(pos * division) / division


def quantize_position(beat_pos: float, divisions: BeatDivision) -> float:
    """Rundet eine fraktionale Beat-Position auf das Raster ihres Beats."""
    base = int(np.floor(beat_pos))
    frac = beat_pos - base
    # Onsets knapp vor dem nächsten Beat gehören zu diesem (Rundung auf 1.0).
    division = divisions.division(base)
    return base + _snap(frac, division)


def quantize_notes(notes: Sequence[RawNote], grid: BeatGrid, ts: TimeSig,
                   divisions: BeatDivision) -> list[QNote]:
    """Onsets und Offsets auf Ticks relativ zum Taktanker; Mindestdauer ein Rasterschritt."""
    if not notes:
        return []
    beat_ticks = ts.beat_ticks
    onsets = grid.to_beat(np.array([n.onset for n in notes])) - grid.bar_beat
    offsets = grid.to_beat(np.array([n.offset for n in notes])) - grid.bar_beat
    result: list[QNote] = []
    for note, on_b, off_b in zip(notes, onsets, offsets, strict=True):
        q_on = quantize_position(float(on_b), divisions)
        q_off = quantize_position(float(off_b), divisions)
        start = round(q_on * beat_ticks)
        end = round(q_off * beat_ticks)
        min_step = beat_ticks // divisions.division(int(np.floor(q_on)))
        end = max(end, start + min_step)
        result.append(QNote(start, end, note.pitch, note.velocity, onset_s=note.onset,
                            offset_s=note.offset))
    result.sort(key=lambda q: (q.start, q.pitch))
    return result


def quantize_pedals(pedals: Sequence[RawPedal], grid: BeatGrid, ts: TimeSig,
                    divisions: BeatDivision) -> list[QPedal]:
    out: list[QPedal] = []
    for p in pedals:
        on_b = float(grid.to_beat(p.onset)[0]) - grid.bar_beat
        off_b = float(grid.to_beat(p.offset)[0]) - grid.bar_beat
        start = round(quantize_position(on_b, divisions) * ts.beat_ticks)
        end = round(quantize_position(off_b, divisions) * ts.beat_ticks)
        if end > start:
            out.append(QPedal(start, end))
    return out
