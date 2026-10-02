"""Taktarten: Schläge pro Takt, Schlaglänge und mögliche Rasterteilungen."""

from __future__ import annotations

import re
from dataclasses import dataclass
from fractions import Fraction

from .types import TPQ

_TS_RE = re.compile(r"^\s*(\d{1,2})\s*/\s*(\d{1,2})\s*$")

EIGHTH = Fraction(1, 2)
SIXTEENTH = Fraction(1, 4)


@dataclass(frozen=True)
class TimeSig:
    numerator: int
    denominator: int

    def __str__(self) -> str:
        return f"{self.numerator}/{self.denominator}"

    @property
    def compound(self) -> bool:
        """6/8, 9/8, 12/8: Der Schlag ist eine punktierte Viertel."""
        return self.denominator == 8 and self.numerator % 3 == 0 and self.numerator > 3

    @property
    def beats_per_bar(self) -> int:
        return self.numerator // 3 if self.compound else self.numerator

    @property
    def beat_ql(self) -> Fraction:
        unit = Fraction(4, self.denominator)
        return unit * 3 if self.compound else unit

    @property
    def beat_ticks(self) -> int:
        return int(self.beat_ql * TPQ)

    @property
    def bar_ticks(self) -> int:
        return self.beat_ticks * self.beats_per_bar

    @property
    def bar_ql(self) -> Fraction:
        return Fraction(4 * self.numerator, self.denominator)

    def straight_divisions(self, finest: Fraction = SIXTEENTH) -> list[int]:
        """Binäre (bzw. in 6/8 ternäre) Teilungen eines Schlags bis zum feinsten Notenwert."""
        total = self.beat_ql / finest
        n = max(1, int(total))
        options = (1, 3, 6, 12) if self.compound else (1, 2, 4, 8)
        return [d for d in options if d <= n and n % d == 0]

    def triplet_divisions(self) -> list[int]:
        """Triolische Teilungen eines Schlags (in 6/8 & Co. keine)."""
        if self.compound:
            return []
        return [3, 6] if self.beat_ql >= 2 else [3]


def parse_time_signature(text: str) -> TimeSig:
    match = _TS_RE.match(text or "")
    if not match:
        raise ValueError(f"Ungültige Taktart: {text!r} (erwartet z. B. 4/4)")
    num, den = int(match.group(1)), int(match.group(2))
    if den not in (2, 4, 8) or not 1 <= num <= 16:
        raise ValueError(f"Nicht unterstützte Taktart: {text} (Nenner 2, 4 oder 8)")
    return TimeSig(num, den)
