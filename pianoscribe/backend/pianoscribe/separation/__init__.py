"""Quellentrennung: Interface und Implementierungen."""

from typing import Any

from .base import Separator

__all__ = ["Separator", "create_separator"]


def create_separator(name: str, device: Any) -> Separator:
    """Fabrik für Separatoren; weitere Modelle (z. B. RoFormer) lassen sich hier einhängen."""
    if name == "htdemucs_6s":
        from .demucs_separator import DemucsSeparator

        return DemucsSeparator(device)
    raise ValueError(f"Unbekannter Separator: {name}")
