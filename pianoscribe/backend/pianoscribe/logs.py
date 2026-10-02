"""Logging nach ``<Datenordner>/logs/pianoscribe.log`` (rotierend)."""

from __future__ import annotations

import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

from .paths import logs_dir

_configured = False


def setup_logging(level: int = logging.INFO) -> Path:
    """Richtet das Datei-Log ein und fängt fehlende stdout/stderr ab (Fenster-Modus)."""
    global _configured
    directory = logs_dir()
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / "pianoscribe.log"
    if _configured:
        return path
    handler = RotatingFileHandler(path, maxBytes=2_000_000, backupCount=3, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)-7s %(name)s: %(message)s"))
    root = logging.getLogger()
    root.setLevel(level)
    root.addHandler(handler)
    logging.captureWarnings(True)
    # Eine PyInstaller-App ohne Konsole hat kein stdout/stderr; Bibliotheken (tqdm, print)
    # würden sonst abstürzen.
    if sys.stdout is None or sys.stderr is None:
        stream = open(os.devnull, "w", encoding="utf-8")  # noqa: SIM115 - lebt bis Prozessende
        if sys.stdout is None:
            sys.stdout = stream
        if sys.stderr is None:
            sys.stderr = stream
    _configured = True
    logging.getLogger(__name__).info("PianoScribe gestartet (Python %s)", sys.version.split()[0])
    return path
