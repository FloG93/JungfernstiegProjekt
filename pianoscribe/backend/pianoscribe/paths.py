"""Zentrale Pfadauflösung: Entwicklung, PyInstaller-Bundle und Laufzeitdaten.

Laufzeitdaten liegen unter ``%LOCALAPPDATA%\\PianoScribe`` (Windows), sonst unter
``~/.local/share/pianoscribe``. ``PIANOSCRIBE_HOME`` überschreibt den Ort (Tests, Portable).
"""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

APP_NAME = "PianoScribe"


class FFmpegNotFoundError(RuntimeError):
    """ffmpeg ist weder gebündelt noch im PATH."""


def is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False))


def bundle_dir() -> Path:
    """Wurzel der mitgelieferten Dateien (``frontend/dist``, ``assets/``).

    Im PyInstaller-Bundle ist das ``sys._MEIPASS``, in der Entwicklung der Ordner
    ``pianoscribe/`` des Repos.
    """
    if is_frozen():
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
    return Path(__file__).resolve().parents[2]


def data_dir() -> Path:
    override = os.environ.get("PIANOSCRIBE_HOME")
    if override:
        return Path(override)
    if sys.platform == "win32":
        base = os.environ.get("LOCALAPPDATA")
        return (Path(base) if base else Path.home() / "AppData" / "Local") / APP_NAME
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / APP_NAME
    xdg = os.environ.get("XDG_DATA_HOME")
    return (Path(xdg) if xdg else Path.home() / ".local" / "share") / "pianoscribe"


def models_dir() -> Path:
    """Modellgewichte; ``PIANOSCRIBE_MODELS`` überschreibt den Ort (z. B. für Tests)."""
    override = os.environ.get("PIANOSCRIBE_MODELS")
    return Path(override) if override else data_dir() / "models"


def projects_dir() -> Path:
    return data_dir() / "projects"


def logs_dir() -> Path:
    return data_dir() / "logs"


def settings_file() -> Path:
    return data_dir() / "settings.json"


def frontend_dist() -> Path:
    return bundle_dir() / "frontend" / "dist"


def samples_dir() -> Path:
    return bundle_dir() / "assets" / "samples" / "salamander"


def ffmpeg_exe() -> str:
    """Pfad zu ffmpeg: Umgebungsvariable, gebündelte Kopie oder PATH."""
    override = os.environ.get("PIANOSCRIBE_FFMPEG")
    if override:
        return override
    name = "ffmpeg.exe" if sys.platform == "win32" else "ffmpeg"
    bundled = bundle_dir() / "assets" / "ffmpeg" / name
    if bundled.is_file():
        return str(bundled)
    found = shutil.which("ffmpeg")
    if found:
        return found
    if is_frozen():
        raise FFmpegNotFoundError(f"ffmpeg fehlt im Programmordner ({bundled}). "
                                  "Bitte PianoScribe neu installieren.")
    raise FFmpegNotFoundError(
        "ffmpeg wurde nicht gefunden. Unter Windows 'uv run python ../scripts/fetch_assets.py' "
        "ausführen, unter Linux ffmpeg über den Paketmanager installieren."
    )
