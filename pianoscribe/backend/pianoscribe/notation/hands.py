"""Händetrennung: rechte Hand (Violinschlüssel) und linke Hand (Bassschlüssel).

Die Trennung läuft vor der Quantisierung auf den Roh-Onsets, damit jede Hand ihr eigenes
Raster bekommt (z. B. Triolen rechts gegen Achtel links).

``fixed``: Split bei einer festen Tonhöhe (Standard C4).

``auto``: Für jeden Akkord (Onsets innerhalb von 35 ms) wird der Split gewählt, der am
wenigsten kostet. Maß ist der Abstand zu jeder Hand – halb zum Median ihrer letzten Töne
(träge, Hysterese), halb zu ihrem zuletzt gespielten Ton (Stimmführung). Eine Hand umspannt
höchstens eine Dezime (16 Halbtöne) und spielt höchstens fünf Töne. Eine Registerregel (rechte
Hand selten unter G3, linke selten über G4) macht die Trennung robust gegen Geisternoten aus
der Separation. Keine ML, bewusst einfach.
"""

from __future__ import annotations

from collections import deque
from collections.abc import Sequence
from statistics import median

from .types import LEFT, RIGHT

CHORD_WINDOW_S = 0.035
MAX_SPAN = 16
MAX_NOTES = 5
HISTORY = 8
IDLE_S = 4.0  # nach so langer Pause zählt die Stimmführung einer Hand nicht mehr
DEFAULT_CENTER = {RIGHT: 67.0, LEFT: 48.0}
SPAN_PENALTY = 3.0  # je Halbton über der Dezime (weich: Geisternoten sprengen sonst die Spanne)
RH_FLOOR, LH_CEIL = 55, 67  # G3 / G4
REGISTER_PENALTY = 1.5  # je Halbton unter RH_FLOOR (rechts) bzw. über LH_CEIL (links)
COUNT_PENALTY = 25.0  # je Ton über fünf
EMPTY_HAND_PENALTY = 1.5  # leichte Vorliebe, weite Akkorde auf beide Hände zu verteilen


def chord_groups(onsets: Sequence[float], window: float = CHORD_WINDOW_S) -> list[list[int]]:
    """Gruppiert Noten-Indizes, deren Onsets höchstens ``window`` vom ersten der Gruppe abliegen."""
    order = sorted(range(len(onsets)), key=lambda i: onsets[i])
    groups: list[list[int]] = []
    group_start = 0.0
    for i in order:
        if groups and onsets[i] - group_start <= window:
            groups[-1].append(i)
        else:
            groups.append([i])
            group_start = onsets[i]
    return groups


def split_fixed(pitches: Sequence[int], split_pitch: int = 60) -> list[int]:
    """Fester Split: Tonhöhen ab ``split_pitch`` (Standard C4) spielt die rechte Hand."""
    return [RIGHT if p >= split_pitch else LEFT for p in pitches]


class _HandState:
    def __init__(self, hand: int) -> None:
        self.hand = hand
        self.history: deque[int] = deque(maxlen=HISTORY)
        self.last: float = DEFAULT_CENTER[hand]
        self.last_time: float | None = None

    def center(self) -> float:
        return float(median(self.history)) if self.history else DEFAULT_CENTER[self.hand]

    def distance(self, pitch: int, now: float) -> float:
        center = self.center()
        last = self.last
        if self.last_time is not None and now - self.last_time > IDLE_S:
            last = center
        return 0.5 * abs(pitch - center) + 0.5 * abs(pitch - last)

    def update(self, pitches: list[int], now: float) -> None:
        if not pitches:
            return
        self.history.extend(pitches)
        self.last = sum(pitches) / len(pitches)
        self.last_time = now


def _part_penalty(pitches: list[int], hand: int) -> float:
    if not pitches:
        return 0.0
    span = pitches[-1] - pitches[0]
    penalty = (SPAN_PENALTY * max(0, span - MAX_SPAN)
               + COUNT_PENALTY * max(0, len(pitches) - MAX_NOTES))
    if hand == RIGHT:
        penalty += REGISTER_PENALTY * sum(max(0, RH_FLOOR - p) for p in pitches)
    else:
        penalty += REGISTER_PENALTY * sum(max(0, p - LH_CEIL) for p in pitches)
    return penalty


def split_auto(pitches: Sequence[int], onsets: Sequence[float]) -> list[int]:
    """Dynamischer Split pro Akkord (siehe Moduldokumentation). Gibt die Hand je Note zurück."""
    hands = [RIGHT] * len(pitches)
    states = {RIGHT: _HandState(RIGHT), LEFT: _HandState(LEFT)}
    for group in chord_groups(onsets):
        members = sorted(group, key=lambda i: pitches[i])
        chord = [pitches[i] for i in members]
        now = min(onsets[i] for i in group)
        best_k, best_cost = 0, float("inf")
        for k in range(len(chord) + 1):
            left, right = chord[:k], chord[k:]
            cost = sum(states[LEFT].distance(p, now) for p in left)
            cost += sum(states[RIGHT].distance(p, now) for p in right)
            cost += _part_penalty(left, LEFT) + _part_penalty(right, RIGHT)
            if len(chord) > 1 and (not left or not right) and chord[-1] - chord[0] > 12:
                cost += EMPTY_HAND_PENALTY
            if cost < best_cost:
                best_k, best_cost = k, cost
        for rank, i in enumerate(members):
            hands[i] = LEFT if rank < best_k else RIGHT
        states[LEFT].update(chord[:best_k], now)
        states[RIGHT].update(chord[best_k:], now)
    return hands
