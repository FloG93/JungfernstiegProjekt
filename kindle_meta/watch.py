"""Ordner-Überwachung (Polling) auf neue E-Book-Dateien."""

from __future__ import annotations

import time
from pathlib import Path
from typing import Callable

SUPPORTED_EXTS = {"epub", "pdf", "fb2", "cbz", "cbr", "mobi", "azw3", "azw"}


class FolderWatcher:
    """Überwacht `folder` per Polling auf neu hinzugekommene E-Book-Dateien."""

    def __init__(self, folder: str):
        self.folder = Path(folder)
        self._known: set[str] = set()
        self._primed = False

    def _scan_all(self) -> set[str]:
        if not self.folder.exists():
            return set()
        return {
            str(p)
            for p in self.folder.iterdir()
            if p.is_file() and p.suffix.lower().lstrip(".") in SUPPORTED_EXTS
        }

    def prime(self) -> None:
        """Merkt sich den aktuellen Bestand, ohne ihn als "neu" zu melden."""
        self._known = self._scan_all()
        self._primed = True

    def scan(self) -> list[str]:
        """Gibt seit dem letzten Aufruf neu hinzugekommene Dateien zurück."""
        current = self._scan_all()
        new_files = sorted(current - self._known)
        self._known = current
        self._primed = True
        return new_files

    def run(
        self,
        callback: Callable[[str], None],
        *,
        interval: float = 5.0,
        iterations: int | None = None,
        process_existing: bool = False,
    ) -> None:
        """Ruft `callback(path)` für jede neu erkannte Datei auf.

        Mit `process_existing=True` gelten bereits vorhandene Dateien beim
        ersten Durchlauf ebenfalls als "neu".
        """
        if process_existing:
            self._known = set()
            self._primed = True
        elif not self._primed:
            self.prime()

        count = 0
        while iterations is None or count < iterations:
            for path in self.scan():
                callback(path)
            count += 1
            if iterations is None or count < iterations:
                time.sleep(interval)
