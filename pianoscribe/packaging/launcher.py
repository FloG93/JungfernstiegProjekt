"""Einstieg der gepackten App (PyInstaller).

Beide Programme im Installationsordner starten dieses Skript:

- ``PianoScribe.exe`` (ohne Konsole) öffnet das Desktop-Fenster.
- ``pianoscribe-cli.exe`` (mit Konsole) ist die Kommandozeile, z. B.
  ``pianoscribe-cli info`` oder ``pianoscribe-cli run song.mp3 --timings``.
"""

import multiprocessing
import sys
from pathlib import Path


def _is_cli() -> bool:
    return Path(sys.executable).stem.lower().endswith("-cli")


if __name__ == "__main__":
    multiprocessing.freeze_support()
    if _is_cli():
        from pianoscribe.cli import main
    else:
        from pianoscribe.main import main
    raise SystemExit(main())
