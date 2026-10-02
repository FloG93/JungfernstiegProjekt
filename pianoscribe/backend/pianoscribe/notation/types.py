"""Datentypen der Notationsstufe.

Zeiten der Rohdaten sind Sekunden ab Beginn des getrimmten Ausschnitts. Nach der Quantisierung
rechnen alle Schritte in ganzzahligen Ticks (``TPQ`` pro Viertelnote); Tick 0 ist der erste
Schlag von Takt 1, ein Auftakt hat negative Ticks.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from fractions import Fraction

TPQ = 48  # Ticks pro Viertel: teilbar durch 16tel, Achteltriolen, 32tel und 16tel-Triolen

RIGHT = 0
LEFT = 1


@dataclass(frozen=True)
class RawNote:
    onset: float
    offset: float
    pitch: int
    velocity: int

    @property
    def duration(self) -> float:
        return self.offset - self.onset


@dataclass(frozen=True)
class RawPedal:
    onset: float
    offset: float


@dataclass
class QNote:
    """Quantisierte Note (Ticks relativ zu Takt 1)."""

    start: int
    end: int
    pitch: int
    velocity: int
    hand: int = RIGHT
    onset_s: float = 0.0  # ursprüngliche Zeit, für Diagnose und Wiedergabe
    offset_s: float = 0.0


@dataclass
class Event:
    """Ein Akkord (oder eine Einzelnote) einer Hand mit gemeinsamer Dauer."""

    start: int
    end: int
    pitches: list[int]
    velocities: list[int]

    @property
    def duration(self) -> int:
        return self.end - self.start


@dataclass
class QPedal:
    start: int
    end: int


@dataclass
class ScoreLayout:
    """Taktgerüst der Partitur."""

    bar_ticks: int
    pickup_ticks: int  # 0 = kein Auftakt
    n_bars: int  # volle Takte ab Takt 1

    @property
    def start_tick(self) -> int:
        return -self.pickup_ticks

    @property
    def end_tick(self) -> int:
        return self.n_bars * self.bar_ticks


@dataclass
class NotationInfo:
    """Kennwerte des Ergebnisses für die Oberfläche."""

    tempo_bpm: float
    tempo_source: str
    time_signature: str
    key: str
    key_source: str
    pickup_quarters: float
    measures: int
    grid: str
    first_downbeat_s: float
    notes: int
    warnings: list[str] = field(default_factory=list)


def ticks_to_ql(ticks: int) -> Fraction:
    return Fraction(ticks, TPQ)
