"""Demucs htdemucs_6s als Separator (programmatisch über apply_model)."""

from __future__ import annotations

from typing import Any

import numpy as np
import torch

from .. import models
from ..audio import resample
from ..runtime import Reporter, free_gpu_memory, is_oom

OVERLAP = 0.25


class DemucsSeparator:
    name = "htdemucs_6s"

    def __init__(self, device: torch.device | str) -> None:
        self.device = torch.device(device) if isinstance(device, str) else device
        self._model: Any = None

    def _load(self) -> Any:
        if self._model is None:
            from demucs.pretrained import get_model

            model = get_model("htdemucs_6s", repo=models.demucs_repo())
            model.eval()
            self._model = model
        return self._model

    @staticmethod
    def _segment_count(model: Any, length: int) -> int:
        sub = model.models[0] if hasattr(model, "models") else model
        segment_length = int(model.samplerate * float(sub.segment))
        stride = int((1 - OVERLAP) * segment_length)
        return max(1, len(range(0, length, stride)))

    def _apply(self, model: Any, wav: torch.Tensor, device: torch.device,
               reporter: Reporter) -> torch.Tensor:
        from demucs.apply import apply_model

        total = self._segment_count(model, wav.shape[-1])
        done = 0

        def callback(event: dict[str, Any]) -> None:
            nonlocal done
            reporter.check()  # Abbruch zwischen den Segmenten
            if event.get("state") == "end":
                done += 1
                reporter.progress(done / total)

        with torch.inference_mode():
            return apply_model(model, wav[None], device=device, split=True, overlap=OVERLAP,
                               shifts=0, progress=False, callback=callback)[0]

    def separate(self, audio: np.ndarray, sample_rate: int,
                 reporter: Reporter) -> dict[str, np.ndarray]:
        model = self._load()
        if sample_rate != model.samplerate:
            audio = resample(audio, sample_rate, model.samplerate)
        wav = torch.from_numpy(np.ascontiguousarray(audio.T, dtype=np.float32))
        ref = wav.mean(0)
        mean, std = ref.mean(), ref.std().clamp_min(1e-6)
        wav = (wav - mean) / std

        devices = [self.device] + ([torch.device("cpu")] if self.device.type != "cpu" else [])
        sources: torch.Tensor | None = None
        for device in devices:
            try:
                sources = self._apply(model, wav, device, reporter)
                break
            except Exception as exc:
                if not is_oom(exc) or device.type == "cpu":
                    raise
                free_gpu_memory()
                reporter.log("Grafikspeicher reicht nicht – Separation läuft auf der CPU weiter.")
        assert sources is not None
        sources = sources * std + mean
        free_gpu_memory()
        result = {name: src.cpu().numpy().T.astype(np.float32)
                  for name, src in zip(model.sources, sources, strict=True)}
        if sample_rate != model.samplerate:
            result = {k: resample(v, model.samplerate, sample_rate) for k, v in result.items()}
        return result
