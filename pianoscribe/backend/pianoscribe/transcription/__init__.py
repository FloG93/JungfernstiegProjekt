"""Transkription: Interface und Implementierungen."""

from typing import Any

from .base import RawTranscription, Transcriber

__all__ = ["RawTranscription", "Transcriber", "create_transcriber"]


def create_transcriber(name: str, device: Any) -> Transcriber:
    """Fabrik für Transkriptoren (später z. B. hFT-Transformer oder Basic Pitch)."""
    if name == "bytedance":
        from .bytedance import ByteDanceTranscriber

        return ByteDanceTranscriber(device)
    raise ValueError(f"Unbekannter Transkriptor: {name}")
