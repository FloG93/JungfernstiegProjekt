"""Quantisierung von Onsets und Offsets auf das Beat-Raster.

Onsets werden auf die Beat-Position abgebildet (Beat-Index + Bruchteil, zwischen zwei Beats
linear interpoliert). Danach wählt ein Viterbi-Durchlauf **pro Schlag** die Teilung mit den
geringsten Kosten:

* Zeitfehler der Onsets in Sekunden, gaußsch gewichtet (σ ≈ 30 ms),
* eine Komplexitätsstrafe je Teilung (Viertel < Achtel < Sechzehntel < Triolen),
* eine Wechselstrafe zwischen gerader und triolischer Teilung benachbarter Schläge.

So entstehen Triolen nur dort, wo sie wirklich hörbar sind. Bei ``grid`` ≠ ``auto`` gilt das
feste Raster. Positionen sind Ticks relativ zum Taktanker ``grid.bar_beat``; die Verschiebung
auf „Takt 1 = Tick 0“ passiert im Taktgerüst.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np

from .grid import BeatGrid
from .meter import EIGHTH, SIXTEENTH, TimeSig
from .types import QNote, QPedal, RawNote, RawPedal

SIGMA_S = 0.03  # typische Streuung gespielter Onsets
CHORD_WINDOW_S = 0.035  # Onsets innerhalb dieses Fensters zählen als ein Anschlag
STRAIGHT_PENALTIES = (0.0, 0.3, 0.8, 1.2)  # für Teilungen 1, 2, 4, 8 (bzw. 1, 3, 6 in 6/8)
TRIPLET_PENALTY_AUTO = 1.8
TRIPLET_PENALTY_EXPLICIT = 1.0
SWITCH_PENALTY = 0.4


@dataclass(frozen=True)
class GridOption:
    division: int
    family: str  # "straight" | "triplet"
    penalty: float


@dataclass
class BeatDivision:
    """Gewählte Teilung pro Beat (Beat-Index relativ zum Taktanker → Teilung).

    ``default`` ist die feinste gerade Teilung; sie gilt für Beats ohne Onsets und für Offsets.
    Offsets in Triolen-Schlägen verwenden deren Teilung.
    """

    default: int
    per_beat: dict[int, int]
    triplet_beats: frozenset[int] = frozenset()

    def division(self, beat: int) -> int:
        return self.per_beat.get(beat, self.default)

    def offset_division(self, beat: int) -> int:
        return self.per_beat[beat] if beat in self.triplet_beats else self.default


def grid_options(ts: TimeSig, mode: str) -> list[GridOption]:
    if mode == "1/8":
        return [GridOption(max(ts.straight_divisions(EIGHTH)), "straight", 0.0)]
    straight = ts.straight_divisions(SIXTEENTH)
    if mode == "1/16":
        return [GridOption(max(straight), "straight", 0.0)]
    triplets = ts.triplet_divisions()
    if mode == "1/16+triplets":
        options = [GridOption(max(straight), "straight", 0.0)]
        options += [GridOption(d, "triplet", TRIPLET_PENALTY_EXPLICIT + 0.3 * i)
                    for i, d in enumerate(triplets)]
        return options
    options = [GridOption(d, "straight", STRAIGHT_PENALTIES[min(i, 3)])
               for i, d in enumerate(straight)]
    options += [GridOption(d, "triplet", TRIPLET_PENALTY_AUTO + 0.5 * i)
                for i, d in enumerate(triplets)]
    return options


def _cluster_onsets(onsets_s: np.ndarray) -> list[int]:
    """Indizes repräsentativer Onsets (je Akkord einer), damit Akkorde nicht mehrfach zählen."""
    order = np.argsort(onsets_s)
    reps: list[int] = []
    group_start = None
    for i in order:
        if group_start is None or onsets_s[i] - group_start > CHORD_WINDOW_S:
            reps.append(int(i))
            group_start = onsets_s[i]
    return reps


def choose_divisions(onset_beats: np.ndarray, onsets_s: np.ndarray, grid: BeatGrid,
                     ts: TimeSig, mode: str) -> BeatDivision:
    """Wählt pro Beat die Teilung (Viterbi über die Beats mit Onsets)."""
    options = grid_options(ts, mode)
    default = max(o.division for o in options if o.family == "straight")
    if len(options) == 1 or onset_beats.size == 0:
        return BeatDivision(default, {})

    finest = max(o.division for o in options)
    half_step = 0.5 / finest
    per_beat: dict[int, list[float]] = {}
    for i in _cluster_onsets(onsets_s):
        b = float(onset_beats[i])
        k = int(np.floor(b + half_step))
        per_beat.setdefault(k, []).append(b - k)
    first, last = min(per_beat), max(per_beat)
    beats = list(range(first, last + 1))

    divisions = np.array([o.division for o in options], dtype=float)
    penalties = np.array([o.penalty for o in options])
    families = [o.family for o in options]
    switch = np.array([[0.0 if fa == fb else SWITCH_PENALTY for fb in families]
                       for fa in families])

    def emission(k: int) -> np.ndarray:
        fracs = np.array(per_beat.get(k, []))
        if fracs.size == 0:
            return penalties * 0.25  # leere Schläge: Nachbarn entscheiden
        seconds = grid.beat_duration(k + grid.bar_beat)
        snapped = np.round(fracs[None, :] * divisions[:, None]) / divisions[:, None]
        err = (fracs[None, :] - snapped) * seconds / SIGMA_S
        return 0.5 * (err**2).sum(axis=1) + penalties

    cost = emission(beats[0])
    back: list[np.ndarray] = []
    for k in beats[1:]:
        total = cost[:, None] + switch
        back.append(np.argmin(total, axis=0))
        cost = total.min(axis=0) + emission(k)
    state = int(np.argmin(cost))
    chosen = [state]
    for pointers in reversed(back):
        state = int(pointers[state])
        chosen.append(state)
    chosen.reverse()
    per = {k: options[s].division for k, s in zip(beats, chosen, strict=True)}
    triplet = frozenset(k for k, s in zip(beats, chosen, strict=True)
                        if options[s].family == "triplet")
    return BeatDivision(default, per, triplet)


def quantize_position(beat_pos: float, divisions: BeatDivision, offset: bool = False) -> float:
    """Rundet eine fraktionale Beat-Position auf das Raster ihres Beats (1.0 = nächster Beat).

    Onsets nutzen die gewählte Teilung des Beats, Offsets das feine Raster (``offset=True``).
    """
    base = int(np.floor(beat_pos))
    frac = beat_pos - base
    division = divisions.offset_division(base) if offset else divisions.division(base)
    return base + round(frac * division) / division


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
        q_off = quantize_position(float(off_b), divisions, offset=True)
        start = round(q_on * beat_ticks)
        end = round(q_off * beat_ticks)
        step = beat_ticks // divisions.offset_division(int(np.floor(q_on)))
        end = max(end, start + step)
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
        start = round(quantize_position(on_b, divisions, offset=True) * ts.beat_ticks)
        end = round(quantize_position(off_b, divisions, offset=True) * ts.beat_ticks)
        if end > start:
            out.append(QPedal(start, end))
    return out
