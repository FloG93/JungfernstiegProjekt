"""Interface für die Transkription und das Rohformat ``raw_notes.json``."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol

import numpy as np

from ..notation.types import RawNote, RawPedal
from ..runtime import Reporter


@dataclass
class RawTranscription:
    """Transkriptionsergebnis; Zeiten in Sekunden ab Beginn des getrimmten Ausschnitts."""

    notes: list[RawNote]
    pedals: list[RawPedal] = field(default_factory=list)
    duration_s: float = 0.0
    transcriber: str = ""

    def clipped(self, duration_s: float) -> RawTranscription:
        """Kappt Zeiten auf die Audiolänge und verwirft Noten nach dem Ende."""
        notes = [RawNote(n.onset, min(n.offset, duration_s), n.pitch, n.velocity)
                 for n in self.notes if n.onset < duration_s]
        pedals = [RawPedal(p.onset, min(p.offset, duration_s))
                  for p in self.pedals if p.onset < duration_s]
        return RawTranscription(notes, pedals, duration_s, self.transcriber)

    def to_json(self) -> dict[str, object]:
        return {
            "format": 1,
            "transcriber": self.transcriber,
            "duration_s": round(self.duration_s, 4),
            "notes": [[round(n.onset, 4), round(n.offset, 4), n.pitch, n.velocity]
                      for n in self.notes],
            "pedals": [[round(p.onset, 4), round(p.offset, 4)] for p in self.pedals],
        }

    @classmethod
    def from_json(cls, data: dict[str, object]) -> RawTranscription:
        notes_raw = data.get("notes", [])
        pedals_raw = data.get("pedals", [])
        assert isinstance(notes_raw, list) and isinstance(pedals_raw, list)
        return cls(
            notes=[RawNote(float(o), float(f), int(p), int(v)) for o, f, p, v in notes_raw],
            pedals=[RawPedal(float(o), float(f)) for o, f in pedals_raw],
            duration_s=float(data.get("duration_s", 0.0)),  # type: ignore[arg-type]
            transcriber=str(data.get("transcriber", "")),
        )

    def save(self, path: Path) -> None:
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.to_json()), encoding="utf-8")
        tmp.replace(path)

    @classmethod
    def load(cls, path: Path) -> RawTranscription:
        return cls.from_json(json.loads(path.read_text(encoding="utf-8")))


class Transcriber(Protocol):
    name: str
    sample_rate: int

    def transcribe(self, audio: np.ndarray, reporter: Reporter) -> RawTranscription:
        """``audio``: Mono-float32 in ``sample_rate``."""
        ...
