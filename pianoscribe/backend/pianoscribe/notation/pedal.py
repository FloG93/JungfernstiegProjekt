"""Pedal: Aufräumen der erkannten Sustain-Pedal-Events für die Notation (Ped. … *)."""

from __future__ import annotations

import bisect
from collections.abc import Sequence

from .types import QPedal

MIN_PEDAL_BEATS = 1.0  # kürzere Pedal-Events sind meist Fehlerkennungen
SNAP_BEATS = 0.25  # Pedal-Ereignisse rasten auf Anschläge in dieser Nähe ein


def _snap(tick: int, starts: Sequence[int], tolerance: int) -> int:
    i = bisect.bisect_left(starts, tick)
    best = tick
    best_dist = tolerance + 1
    for j in (i - 1, i):
        if 0 <= j < len(starts) and abs(starts[j] - tick) < best_dist:
            best, best_dist = starts[j], abs(starts[j] - tick)
    return best


def clean_pedals(pedals: Sequence[QPedal], note_starts: Sequence[int],
                 beat_ticks: int) -> list[QPedal]:
    """Rastet Pedal-Druck/-Lösen auf nahe Anschläge ein, entfernt Kurzes und Überlappungen."""
    starts = sorted(set(note_starts))
    tolerance = round(beat_ticks * SNAP_BEATS)
    snapped = sorted(
        (QPedal(_snap(p.start, starts, tolerance), _snap(p.end, starts, tolerance))
         for p in pedals),
        key=lambda p: p.start,
    )
    result: list[QPedal] = []
    min_len = round(beat_ticks * MIN_PEDAL_BEATS)
    for p in snapped:
        if p.end - p.start < min_len:
            continue
        if result and p.start < result[-1].end:
            result[-1].end = p.start  # überlappend → Pedalwechsel
            if result[-1].end - result[-1].start < min_len:
                result.pop()
        result.append(QPedal(p.start, p.end))
    return result
