"""Inferenz der ByteDance-Klaviertranskription mit Fortschritt und Abbruch.

Angepasst aus piano_transcription_inference/inference.py (MIT, siehe LICENSE).
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch

from .model import SAMPLE_RATE, NotePedal
from .postprocess import NoteEvent, PedalEvent, detect_notes, detect_pedals

SEGMENT_SAMPLES = SAMPLE_RATE * 10  # 10-s-Segmente mit 50 % Überlappung wie im Original


@dataclass
class TranscriptionOutput:
    notes: list[NoteEvent]
    pedals: list[PedalEvent]


def load_model(checkpoint: Path, device: torch.device) -> NotePedal:
    state = torch.load(str(checkpoint), map_location="cpu", weights_only=True)
    model = NotePedal()
    model.load_checkpoint(state["model"])
    model.eval()
    return model.to(device)


def enframe(audio: np.ndarray, segment_samples: int = SEGMENT_SAMPLES) -> np.ndarray:
    """Teilt (gepolstertes) Audio in Segmente mit halber Überlappung: (N, segment_samples)."""
    assert audio.shape[0] % segment_samples == 0
    starts = range(0, audio.shape[0] - segment_samples + 1, segment_samples // 2)
    return np.stack([audio[s : s + segment_samples] for s in starts])


def deframe(x: np.ndarray) -> np.ndarray:
    """Setzt Segment-Vorhersagen (N, frames, classes) wieder zusammen."""
    if x.shape[0] == 1:
        return x[0]
    x = x[:, :-1, :]  # letztes Frame stammt aus center=True
    frames = x.shape[1]
    assert frames % 4 == 0
    parts = [x[0, : int(frames * 0.75)]]
    parts += [x[i, int(frames * 0.25) : int(frames * 0.75)] for i in range(1, x.shape[0] - 1)]
    parts.append(x[-1, int(frames * 0.25) :])
    return np.concatenate(parts, axis=0)


def transcribe(model: NotePedal, audio: np.ndarray, device: torch.device, batch_size: int = 1,
               progress: Callable[[float], None] | None = None) -> TranscriptionOutput:
    """Transkribiert 16-kHz-Mono-Audio (float32). ``progress`` darf zum Abbruch werfen."""
    audio = np.asarray(audio, dtype=np.float32)
    audio_len = audio.shape[0]
    pad = int(np.ceil(audio_len / SEGMENT_SAMPLES)) * SEGMENT_SAMPLES - audio_len
    audio = np.concatenate([audio, np.zeros(pad, dtype=np.float32)])
    segments = enframe(audio)

    collected: dict[str, list[np.ndarray]] = {}
    total = segments.shape[0]
    for start in range(0, total, batch_size):
        batch = torch.from_numpy(segments[start : start + batch_size]).to(device)
        with torch.inference_mode():
            out = model(batch)
        for key, value in out.items():
            collected.setdefault(key, []).append(value.float().cpu().numpy())
        if progress is not None:
            progress(min(1.0, (start + batch_size) / total))

    # Wie im Original wird nicht auf die Audiolänge gekürzt (dort wird versehentlich mit der
    # Sample- statt der Frame-Anzahl geschnitten); Zeiten nach dem Ende kappt der Aufrufer.
    outputs = {k: deframe(np.concatenate(v, axis=0)) for k, v in collected.items()}
    return TranscriptionOutput(notes=detect_notes(outputs), pedals=detect_pedals(outputs))
