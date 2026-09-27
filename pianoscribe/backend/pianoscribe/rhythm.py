"""Beat- und Downbeat-Erkennung mit beat_this (CPJKU, ISMIR 2024)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

import numpy as np

from . import models
from .runtime import Reporter, free_gpu_memory, is_oom


@dataclass
class BeatResult:
    """Beat-Zeiten in Sekunden ab Beginn des getrimmten Ausschnitts."""

    beats: list[float]
    downbeats: list[float]
    model: str = "beat_this final0"

    def save(self, path: Path) -> None:
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps({"format": 1, "model": self.model,
                                   "beats": [round(b, 4) for b in self.beats],
                                   "downbeats": [round(d, 4) for d in self.downbeats]}),
                       encoding="utf-8")
        tmp.replace(path)

    @classmethod
    def load(cls, path: Path) -> BeatResult:
        data = json.loads(path.read_text(encoding="utf-8"))
        return cls([float(b) for b in data["beats"]], [float(d) for d in data["downbeats"]],
                   str(data.get("model", "")))


class BeatTracker(Protocol):
    def track(self, audio: np.ndarray, sample_rate: int, reporter: Reporter) -> BeatResult: ...


class BeatThisTracker:
    def __init__(self, device: Any) -> None:
        import torch

        self.device = torch.device(device) if isinstance(device, str) else device
        self._models: dict[str, Any] = {}

    def _get(self, device: Any) -> Any:
        key = str(device)
        if key not in self._models:
            from beat_this.inference import Audio2Beats

            path = models.require(models.BEAT_THIS)
            self._models[key] = Audio2Beats(checkpoint_path=str(path), device=key, dbn=False)
        return self._models[key]

    def track(self, audio: np.ndarray, sample_rate: int, reporter: Reporter) -> BeatResult:
        import torch

        reporter.progress(0.05)
        devices = [self.device] + ([torch.device("cpu")] if self.device.type != "cpu" else [])
        for device in devices:
            try:
                beats, downbeats = self._get(device)(audio, sample_rate)
                break
            except Exception as exc:
                if not is_oom(exc) or device.type == "cpu":
                    raise
                free_gpu_memory()
        reporter.progress(1.0)
        return BeatResult([float(b) for b in beats], [float(d) for d in downbeats])
