"""Benutzereinstellungen (``settings.json`` im Datenordner)."""

from __future__ import annotations

import json
from typing import Literal

from pydantic import BaseModel

from .paths import settings_file


class Settings(BaseModel):
    device: Literal["auto", "cuda", "cpu"] = "auto"
    setup_done: bool = False


def load() -> Settings:
    path = settings_file()
    try:
        return Settings.model_validate(json.loads(path.read_text(encoding="utf-8")))
    except (FileNotFoundError, ValueError):
        return Settings()


def save(settings: Settings) -> None:
    path = settings_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(settings.model_dump_json(indent=2), encoding="utf-8")
    tmp.replace(path)
