"""Aufräumen der Rohnoten: Geisternoten verwerfen, Dubletten verschmelzen."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable

from .types import RawNote

DUPLICATE_WINDOW_S = 0.05  # Onsets gleicher Tonhöhe, die näher liegen, sind eine Note


def filter_notes(notes: Iterable[RawNote], min_note_ms: float, min_velocity: int) -> list[RawNote]:
    """Verwirft zu kurze und zu leise Noten (typische Separations-Artefakte)."""
    min_dur = min_note_ms / 1000.0
    return [n for n in notes if n.duration >= min_dur and n.velocity >= min_velocity]


def merge_overlaps(notes: Iterable[RawNote]) -> list[RawNote]:
    """Behandelt überlappende Noten gleicher Tonhöhe.

    Liegen die Onsets dicht beieinander, sind es Dubletten und werden verschmolzen. Sonst ist
    die zweite ein neuer Anschlag; die erste endet dann an deren Onset.
    """
    by_pitch: dict[int, list[RawNote]] = defaultdict(list)
    for n in sorted(notes, key=lambda n: (n.pitch, n.onset)):
        by_pitch[n.pitch].append(n)
    result: list[RawNote] = []
    for group in by_pitch.values():
        current = group[0]
        for nxt in group[1:]:
            if nxt.onset < current.offset:
                if nxt.onset - current.onset < DUPLICATE_WINDOW_S:
                    current = RawNote(current.onset, max(current.offset, nxt.offset),
                                      current.pitch, max(current.velocity, nxt.velocity))
                    continue
                current = RawNote(current.onset, nxt.onset, current.pitch, current.velocity)
            result.append(current)
            current = nxt
        result.append(current)
    result.sort(key=lambda n: (n.onset, n.pitch))
    return result


def transpose(notes: Iterable[RawNote], semitones: int) -> list[RawNote]:
    """Transponiert und verwirft Töne außerhalb der Klaviatur (A0–C8)."""
    out = []
    for n in notes:
        p = n.pitch + semitones
        if 21 <= p <= 108:
            out.append(RawNote(n.onset, n.offset, p, n.velocity))
    return out
