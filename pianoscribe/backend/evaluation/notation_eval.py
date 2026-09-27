"""Evaluation der Notation gegen eine bekannte Partitur (Positionen in Vierteln).

Für das Demo-Stück ist die Partitur exakt bekannt: Viertelposition ab Beginn des Auftakts,
Tonhöhe und Hand jeder Note. Verglichen wird mit den Noten aus ``score.json``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .synth import DEMO_LH_ROOTS, DEMO_LH_THIRD, DEMO_RH

RIGHT, LEFT = 0, 1


@dataclass(frozen=True)
class TruthNote:
    q: float  # Viertel ab Beginn des Auftakts
    pitch: int
    hand: int
    duration: float


def demo_truth() -> list[TruthNote]:
    """Partitur des Demo-Stücks (4/4, ein Viertel Auftakt)."""

    def q(bar: int, pos: float) -> float:
        return round(1 + (bar - 1) * 4 + pos, 4) if bar > 0 else round(pos - 3, 4)

    truth = [TruthNote(q(bar, pos), p, RIGHT, dur)
             for bar, events in DEMO_RH.items() for pos, dur, pitches in events for p in pitches]
    for bar, (root_a, root_b) in DEMO_LH_ROOTS.items():
        for eighth in range(8):
            root = root_a if eighth < 4 else root_b
            pattern = [root, root + 7, root + 12 + DEMO_LH_THIRD[root], root + 7]
            truth.append(TruthNote(q(bar, eighth * 0.5), pattern[eighth % 4], LEFT, 0.5))
    truth += [TruthNote(q(8, 0), p, LEFT, 4.0) for p in (39, 51)]
    return sorted(truth, key=lambda t: (t.q, t.pitch))


@dataclass
class NotationScore:
    truth: int
    estimated: int
    onset_correct: int  # gleiche Tonhöhe an exakt gleicher Position
    hand_correct: int  # davon in der richtigen Hand
    duration_correct: int  # davon mit exakt gleicher Dauer

    @property
    def onset_accuracy(self) -> float:
        return self.onset_correct / max(self.truth, 1)

    @property
    def onset_precision(self) -> float:
        return self.onset_correct / max(self.estimated, 1)

    @property
    def hand_accuracy(self) -> float:
        return self.hand_correct / max(self.onset_correct, 1)

    def __str__(self) -> str:
        return (f"Onsets {self.onset_accuracy:.1%} (Präzision {self.onset_precision:.1%}), "
                f"Hände {self.hand_accuracy:.1%}, Dauern {self.duration_correct}/"
                f"{self.onset_correct} (truth={self.truth}, est={self.estimated})")


def compare(score_notes: list[dict[str, Any]], truth: list[TruthNote]) -> NotationScore:
    remaining = {(round(n["q0"], 3), n["p"]): n for n in score_notes}
    onset = hand = dur = 0
    for t in truth:
        match = remaining.pop((round(t.q, 3), t.pitch), None)
        if match is None:
            continue
        onset += 1
        if match["h"] == t.hand:
            hand += 1
        if abs((match["q1"] - match["q0"]) - t.duration) < 1e-3:
            dur += 1
    return NotationScore(len(truth), len(score_notes), onset, hand, dur)
