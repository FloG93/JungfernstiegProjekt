"""Taktgerüst und Rhythmus-Schreibweise.

Legt Takt 1 und den Auftakt fest und zerlegt Noten und Pausen jedes Takts in notierbare Werte
mit Haltebögen. Die Regeln folgen gängiger Notensatzpraxis:

* Innerhalb eines Schlags ist jeder einfache Wert erlaubt (auch Sechzehntel-Achtel-Sechzehntel).
* Über Schlaggrenzen hinweg nur, wenn die Note auf einem Schlag beginnt (Halbe, punktierte
  Halbe, Ganze …) oder bei der Synkope Achtel–Viertel–Achtel; im 4/4 bleibt die Taktmitte sichtbar.
* Pausen werden strenger behandelt: zusammengefasst nur auf starken Zählzeiten.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass, field
from fractions import Fraction

from .meter import TimeSig
from .types import TPQ, Event, QNote, ScoreLayout

# Einfache Notenwerte (in Vierteln): Grundwerte, einfach punktiert und Triolenwerte.
_BASE = [Fraction(8), Fraction(4), Fraction(2), Fraction(1), Fraction(1, 2), Fraction(1, 4),
         Fraction(1, 8)]
SIMPLE_QL: frozenset[Fraction] = frozenset(
    [b for b in _BASE] + [b * Fraction(3, 2) for b in _BASE]
    + [Fraction(4, 3), Fraction(2, 3), Fraction(1, 3), Fraction(1, 6)]
)


def is_simple(ticks: int) -> bool:
    return Fraction(ticks, TPQ) in SIMPLE_QL


# --------------------------------------------------------------------------------------------
# Taktgerüst
# --------------------------------------------------------------------------------------------
def compute_layout(notes: Sequence[QNote], ts: TimeSig) -> tuple[ScoreLayout, int]:
    """Bestimmt Takt 1 und den Auftakt. Gibt (Layout, Verschiebung in Ticks) zurück.

    Die Ticks der Noten sind relativ zu einem beliebigen Taktanfang; nach Abzug der
    Verschiebung beginnt Takt 1 bei Tick 0.
    """
    bar, beat = ts.bar_ticks, ts.beat_ticks
    if not notes:
        return ScoreLayout(bar, 0, 1), 0
    first = min(n.start for n in notes)
    last = max(n.end for n in notes)
    bar_start = math.floor(first / bar) * bar
    if first == bar_start:
        measure1, pickup = bar_start, 0
    else:
        measure1 = bar_start + bar
        pickup = measure1 - first
        half_beat_ok = not ts.compound and pickup == beat // 2
        if pickup % beat and not half_beat_ok:
            pickup = measure1 - math.floor(first / beat) * beat
        if pickup >= bar:  # sollte nicht vorkommen
            measure1, pickup = bar_start, 0
    n_bars = max(1, math.ceil((last - measure1) / bar))
    return ScoreLayout(bar, pickup, n_bars), measure1


@dataclass(frozen=True)
class Metrics:
    bar_ticks: int
    beat_ticks: int
    beats_per_bar: int
    compound: bool

    @classmethod
    def of(cls, ts: TimeSig) -> Metrics:
        return cls(ts.bar_ticks, ts.beat_ticks, ts.beats_per_bar, ts.compound)

    @property
    def sub_beat(self) -> int:
        return self.beat_ticks // (3 if self.compound else 2)


# --------------------------------------------------------------------------------------------
# Rhythmus-Schreibweise
# --------------------------------------------------------------------------------------------
def _within_beat(start: int, end: int, m: Metrics) -> list[tuple[int, int]]:
    dur = end - start
    if is_simple(dur):
        return [(start, end)]
    unit = m.sub_beat
    cuts = list(range((start // unit + 1) * unit, end, unit)) if unit > 0 else []
    if cuts and start % unit == 0:
        # Auf einer Unterteilung: längster einfacher Wert bis zu einer Unterteilungsgrenze.
        for cut in reversed(cuts):
            if is_simple(cut - start):
                return [(start, cut), *_within_beat(cut, end, m)]
    if cuts:
        return _within_beat(start, cuts[0], m) + _within_beat(cuts[0], end, m)
    # Rückfallebene: größte einfache Werte nacheinander
    pieces = []
    pos = start
    while pos < end:
        steps = [t for t in range(1, end - pos + 1) if is_simple(t)]
        if not steps:  # Rest kleiner als ein 32stel: unverändert lassen
            pieces.append((pos, end))
            break
        pieces.append((pos, pos + steps[-1]))
        pos += steps[-1]
    return pieces


def _multi_beat_ok(start: int, dur: int, m: Metrics, is_rest: bool) -> bool:
    if not is_simple(dur) or start + dur > m.bar_ticks:
        return False
    if not is_rest:
        return True
    beat = m.beat_ticks
    if m.compound or m.beats_per_bar < 3:
        return False
    if m.beats_per_bar == 3:
        return dur == 2 * beat and start in (0, beat)
    return dur == 2 * beat and start % (2 * beat) == 0


def _crosses_middle(start: int, end: int, m: Metrics) -> bool:
    if m.beats_per_bar != 4 or m.compound:
        return False
    middle = 2 * m.beat_ticks
    return start < middle < end


def _syncopation_ok(start: int, dur: int, m: Metrics) -> bool:
    """Achtel-Viertel-Achtel bzw. Achtel–punktierte Viertel ohne Bindebogen."""
    beat = m.beat_ticks
    if m.compound or beat % 2 or start % beat != beat // 2:
        return False
    if dur not in (beat, beat + beat // 2):
        return False
    return start + dur <= m.bar_ticks and not _crosses_middle(start, start + dur, m)


def _dotted_beat_ok(start: int, dur: int, m: Metrics) -> bool:
    """Punktierte Viertel auf einem Schlag (endet auf der Achtel danach)."""
    beat = m.beat_ticks
    return (not m.compound and dur == beat + beat // 2 and start + dur <= m.bar_ticks
            and not _crosses_middle(start, start + dur, m))


def spell_span(start: int, end: int, m: Metrics, is_rest: bool) -> list[tuple[int, int]]:
    """Zerlegt [start, end) (metrische Position im Takt) in notierbare Stücke."""
    dur = end - start
    if dur <= 0:
        return []
    beat = m.beat_ticks
    if start // beat == (end - 1) // beat:
        return _within_beat(start, end, m)
    if start % beat == 0 and end % beat == 0:
        if _multi_beat_ok(start, dur, m, is_rest):
            return [(start, end)]
        for cut in range(end - beat, start, -beat):
            if cut - start == beat or _multi_beat_ok(start, cut - start, m, is_rest):
                return [(start, cut), *spell_span(cut, end, m, is_rest)]
    if start % beat:
        if not is_rest and _syncopation_ok(start, dur, m):
            return [(start, end)]
        cut = (start // beat + 1) * beat
        return spell_span(start, cut, m, is_rest) + spell_span(cut, end, m, is_rest)
    if not is_rest and _dotted_beat_ok(start, dur, m):
        return [(start, end)]
    cut = (end // beat) * beat
    return spell_span(start, cut, m, is_rest) + spell_span(cut, end, m, is_rest)


# --------------------------------------------------------------------------------------------
# Takte füllen
# --------------------------------------------------------------------------------------------
@dataclass
class Item:
    """Ein Element eines Takts: Note/Akkord oder Pause (Ticks relativ zum Taktbeginn)."""

    offset: int
    duration: int
    pitches: list[int] = field(default_factory=list)
    velocities: list[int] = field(default_factory=list)
    tie: str | None = None  # "start" | "continue" | "stop"
    full_measure: bool = False
    event_start: int | None = None  # absoluter Start des zugehörigen Events

    @property
    def is_rest(self) -> bool:
        return not self.pitches


@dataclass
class MeasureSpec:
    number: int
    start: int  # absoluter Tick
    length: int
    metric_offset: int  # metrische Position des ersten Ticks (Auftakt: Taktlänge − Länge)
    items: list[Item] = field(default_factory=list)


def measure_specs(layout: ScoreLayout) -> list[MeasureSpec]:
    specs: list[MeasureSpec] = []
    if layout.pickup_ticks:
        specs.append(MeasureSpec(0, -layout.pickup_ticks, layout.pickup_ticks,
                                 layout.bar_ticks - layout.pickup_ticks))
    for i in range(layout.n_bars):
        specs.append(MeasureSpec(i + 1, i * layout.bar_ticks, layout.bar_ticks, 0))
    return specs


def _tie(has_prev: bool, has_next: bool) -> str | None:
    if has_prev and has_next:
        return "continue"
    if has_next:
        return "start"
    if has_prev:
        return "stop"
    return None


def fill_measure(spec: MeasureSpec, events: Sequence[Event], m: Metrics) -> list[Item]:
    """Verteilt die Events einer Hand auf einen Takt, inklusive Pausen und Bindebögen."""
    m_start, m_end = spec.start, spec.start + spec.length
    spans: list[tuple[int, int, Event | None, bool, bool]] = []
    cursor = m_start
    for ev in events:
        if ev.end <= m_start or ev.start >= m_end:
            continue
        s, e = max(ev.start, m_start), min(ev.end, m_end)
        if s > cursor:
            spans.append((cursor, s, None, False, False))
        spans.append((s, e, ev, ev.start < m_start, ev.end > m_end))
        cursor = e
    if cursor < m_end:
        spans.append((cursor, m_end, None, False, False))

    if all(ev is None for _, _, ev, _, _ in spans) and spec.number > 0:
        return [Item(0, spec.length, full_measure=True)]

    items: list[Item] = []
    shift = spec.metric_offset - m_start
    for s, e, span_ev, tie_in, tie_out in spans:
        pieces = spell_span(s + shift, e + shift, m, is_rest=span_ev is None)
        for i, (ps, pe) in enumerate(pieces):
            offset = ps - spec.metric_offset
            if span_ev is None:
                items.append(Item(offset, pe - ps))
                continue
            tie = _tie(i > 0 or tie_in, i < len(pieces) - 1 or tie_out)
            items.append(Item(offset, pe - ps, list(span_ev.pitches), list(span_ev.velocities),
                              tie, event_start=span_ev.start))
    return items
