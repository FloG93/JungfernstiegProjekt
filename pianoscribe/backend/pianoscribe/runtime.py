"""Laufzeit-Hilfen: Gerätewahl, GPU-Status, Fortschritt und Abbruch von Stufen."""

from __future__ import annotations

import threading
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Literal

if TYPE_CHECKING:
    import torch

DevicePreference = Literal["auto", "cuda", "cpu"]


class CancelledError(RuntimeError):
    """Der Nutzer hat den Job abgebrochen."""

    def __init__(self) -> None:
        super().__init__("Abgebrochen.")


@dataclass
class Reporter:
    """Meldet Fortschritt (0–1) einer Stufe und prüft dabei auf Abbruch."""

    on_progress: Callable[[float, str | None], None] | None = None
    cancel: threading.Event | None = None
    log: Callable[[str], None] = field(default=lambda _msg: None)

    def check(self) -> None:
        if self.cancel is not None and self.cancel.is_set():
            raise CancelledError()

    def progress(self, fraction: float, message: str | None = None) -> None:
        self.check()
        if self.on_progress is not None:
            self.on_progress(max(0.0, min(1.0, fraction)), message)


def select_device(preference: DevicePreference = "auto") -> torch.device:
    import torch

    if preference == "cpu":
        return torch.device("cpu")
    if torch.cuda.is_available():
        return torch.device("cuda")
    if preference == "cuda":
        raise RuntimeError("CUDA wurde angefordert, ist aber nicht verfügbar.")
    return torch.device("cpu")


def gpu_info() -> dict[str, Any]:
    import torch

    info: dict[str, Any] = {
        "torch": torch.__version__,
        "cuda_build": torch.version.cuda,
        "cuda_available": torch.cuda.is_available(),
        "name": None,
        "vram_total_mb": None,
        "vram_free_mb": None,
    }
    if info["cuda_available"]:
        props = torch.cuda.get_device_properties(0)
        info["name"] = props.name
        info["vram_total_mb"] = round(props.total_memory / 2**20)
        try:
            free, _total = torch.cuda.mem_get_info()
            info["vram_free_mb"] = round(free / 2**20)
        except RuntimeError:
            pass
    return info


def is_oom(exc: BaseException) -> bool:
    import torch

    if isinstance(exc, torch.OutOfMemoryError):
        return True
    return isinstance(exc, RuntimeError) and "out of memory" in str(exc).lower()


def free_gpu_memory() -> None:
    import gc

    import torch

    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
