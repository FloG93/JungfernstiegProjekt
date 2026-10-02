"""Stimmbildung: eine Stimme pro Hand aus Akkorden mit gemeinsamer Dauer."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence

from .types import Event, QNote


def build_events(notes: Sequence[QNote], hand: int, beat_ticks: int | None = None) -> list[Event]:
    """Gruppiert Noten einer Hand nach Onset zu Akkorden.

    Die Dauer eines Akkords ist die längste Dauer seiner Töne, begrenzt auf den nächsten
    Onset derselben Hand (überlappende Noten mit anderem Onset werden gekürzt). Mit
    ``beat_ticks`` werden kleine Lücken geschlossen (höchstens ein Sechzehntel und kürzer als der
    Ton selbst): bis zum nächsten Anschlag oder – wenn danach Pause folgt – bis zum nächsten
    Schlag. Gespielte Töne sind meist etwas kürzer als notiert; so entstehen keine Kleinstpausen.
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
        nxt = starts[i + 1] if i + 1 < len(starts) else None
        if nxt is not None:
            end = min(end, nxt)
        if beat_ticks:
            max_gap = beat_ticks // 4
            boundary = -(-end // beat_ticks) * beat_ticks  # nächster Schlag ab dem Ende
            target = nxt if nxt is not None and nxt <= boundary else boundary
            gap = target - end
            if 0 < gap <= max_gap and gap < end - start:
                end = target
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
