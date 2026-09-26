"""Sicherungskopien einzelner Dateien vor dem Überschreiben."""

from __future__ import annotations

import shutil
from datetime import datetime
from pathlib import Path

from kindle_meta.config import backups_dir


class BackupError(Exception):
    """Ein Backup konnte nicht angelegt oder wiederhergestellt werden."""


def create_backup(path: str) -> str:
    """Legt eine Sicherungskopie von `path` in `backups_dir()` an."""
    source = Path(path)
    if not source.exists():
        raise BackupError(f"Datei nicht gefunden: {path}")
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    backup_path = backups_dir() / f"{timestamp}__{source.name}"
    shutil.copyfile(source, backup_path)
    return str(backup_path)


def list_backups(path: str) -> list[str]:
    """Listet alle Backups von `path`, neueste zuerst."""
    suffix = f"__{Path(path).name}"
    matches = [p for p in backups_dir().glob(f"*{suffix}") if p.is_file()]
    matches.sort(key=lambda p: p.name, reverse=True)
    return [str(p) for p in matches]


def restore_latest(path: str) -> str:
    """Stellt die jüngste Sicherungskopie von `path` wieder her."""
    backups = list_backups(path)
    if not backups:
        raise BackupError(f"Kein Backup für {path} gefunden")
    latest = backups[0]
    shutil.copyfile(latest, path)
    return latest
