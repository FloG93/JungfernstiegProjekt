"""Stimmbildung: eine Stimme pro Hand aus Akkorden mit gemeinsamer Dauer."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence

from .types import Event, QNote


def build_events(notes: Sequence[QNote], hand: int) -> list[Event]:
    """Gruppiert Noten einer Hand nach Onset zu Akkorden.

    Die Dauer eines Akkords ist die längste Dauer seiner Töne, begrenzt auf den nächsten
    Onset derselben Hand (überlappende Noten mit anderem Onset werden gekürzt).
    """
    groups: dict[int, list[QNote]] = defaultdict(list)
    for n in notes:
        if n.hand == hand:
            groups[n.start].append(n)
    starts = sorted(groups)
    events: list[Event] = []
    for i, start in enumerate(starts):
        members = sorted(groups[start], key=lambda n: n.pitch)
        end = max(n.end for n in members)
        if i + 1 < len(starts):
            end = min(end, starts[i + 1])
        if end <= start:
            continue
        pitches: list[int] = []
        velocities: list[int] = []
        for n in members:
            if n.pitch not in pitches:
                pitches.append(n.pitch)
                velocities.append(n.velocity)
        events.append(Event(start, end, pitches, velocities))
    return events
