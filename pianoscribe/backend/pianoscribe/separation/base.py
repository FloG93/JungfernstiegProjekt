"""Interface für Quellentrennung."""

from __future__ import annotations

from typing import Protocol

import numpy as np

from ..runtime import Reporter


class Separator(Protocol):
    """Trennt einen Stereo-Mix in Stems. Der Stem ``piano`` muss immer enthalten sein."""

    name: str

    def separate(self, audio: np.ndarray, sample_rate: int,
                 reporter: Reporter) -> dict[str, np.ndarray]:
        """``audio``: float32 (frames, 2). Rückgabe: Stem-Name → float32 (frames, 2)."""
        ...
