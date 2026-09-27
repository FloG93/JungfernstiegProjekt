"""Händetrennung: rechte Hand (Violinschlüssel) und linke Hand (Bassschlüssel)."""

from __future__ import annotations

from collections.abc import Sequence

from .types import LEFT, RIGHT, QNote


def split_fixed(notes: Sequence[QNote], split_pitch: int = 60) -> None:
    """Fester Split: Tonhöhen ab ``split_pitch`` (Standard C4) spielt die rechte Hand."""
    for n in notes:
        n.hand = RIGHT if n.pitch >= split_pitch else LEFT
