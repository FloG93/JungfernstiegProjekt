"""ByteDance Piano Transcription (gevendorte Inferenz) als Transcriber."""

from __future__ import annotations

import numpy as np
import torch

from .. import models
from ..notation.types import RawNote, RawPedal
from ..runtime import Reporter, free_gpu_memory, is_oom
from .base import RawTranscription
from .bytedance_vendor import inference
from .bytedance_vendor.model import SAMPLE_RATE, NotePedal


class ByteDanceTranscriber:
    name = "bytedance"
    sample_rate = SAMPLE_RATE

    def __init__(self, device: torch.device | str) -> None:
        self.device = torch.device(device) if isinstance(device, str) else device
        self._model: NotePedal | None = None
        self._model_device: torch.device | None = None

    def _load(self, device: torch.device) -> NotePedal:
        if self._model is None:
            self._model = inference.load_model(models.require(models.BYTEDANCE),
                                               torch.device("cpu"))
            self._model_device = torch.device("cpu")
        if self._model_device != device:
            self._model.to(device)
            self._model_device = device
        return self._model

    def transcribe(self, audio: np.ndarray, reporter: Reporter) -> RawTranscription:
        attempts = [(self.device, 4 if self.device.type == "cuda" else 1)]
        if self.device.type != "cpu":
            attempts.append((torch.device("cpu"), 1))
        output = None
        for device, batch_size in attempts:
            try:
                model = self._load(device)
                output = inference.transcribe(model, audio, device, batch_size=batch_size,
                                              progress=lambda f: reporter.progress(f))
                break
            except Exception as exc:
                if not is_oom(exc) or device.type == "cpu":
                    raise
                free_gpu_memory()
                reporter.log("Grafikspeicher reicht nicht – Transkription läuft auf der "
                             "CPU weiter.")
        assert output is not None
        free_gpu_memory()
        duration = len(audio) / SAMPLE_RATE
        result = RawTranscription(
            notes=[RawNote(n.onset, n.offset, n.pitch, n.velocity) for n in output.notes],
            pedals=[RawPedal(p.onset, p.offset) for p in output.pedals],
            duration_s=duration,
            transcriber=self.name,
        )
        return result.clipped(duration)
