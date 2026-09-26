"""App-Verzeichnis und persistente Einstellungen."""

from __future__ import annotations

import json
from pathlib import Path

DEFAULT_LLM_MODEL_FAST = "claude-haiku-4-5-20251001"
DEFAULT_LLM_MODEL_RESEARCH = "claude-sonnet-5"

_SECRET_KEYS = {"smtp_pass"}

_DEFAULTS: dict[str, object] = {
    "kindle_addr": "",
    "smtp_host": "",
    "smtp_port": 587,
    "smtp_user": "",
    "smtp_pass": "",
    "smtp_from": "",
    "protected_fields": "",
    "llm_model_fast": DEFAULT_LLM_MODEL_FAST,
    "llm_model_research": DEFAULT_LLM_MODEL_RESEARCH,
}


def app_home() -> Path:
    """Gibt `$KINDLE_META_HOME` oder `~/.kindle-meta` zurück (wird angelegt)."""
    import os

    home = os.environ.get("KINDLE_META_HOME")
    path = Path(home) if home else Path.home() / ".kindle-meta"
    path.mkdir(parents=True, exist_ok=True)
    return path


def backups_dir() -> Path:
    path = app_home() / "backups"
    path.mkdir(parents=True, exist_ok=True)
    return path


def library_path() -> Path:
    return app_home() / "library.db"


def settings_path() -> Path:
    return app_home() / "settings.json"


class Settings:
    """Liest/schreibt `settings.json`; geheime Schlüssel über `keyring`
    (falls installiert), sonst als Datei-Fallback.
    """

    def __init__(self) -> None:
        self._data: dict[str, object] = dict(_DEFAULTS)
        self._load()

    def _load(self) -> None:
        path = settings_path()
        if path.exists():
            try:
                stored = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                stored = {}
            if isinstance(stored, dict):
                self._data.update(stored)
        for key in _SECRET_KEYS:
            secret = self._load_secret(key)
            if secret is not None:
                self._data[key] = secret

    @staticmethod
    def _load_secret(key: str) -> str | None:
        try:
            import keyring

            return keyring.get_password("kindle-meta", key)
        except Exception:  # noqa: BLE001 - keyring optional/fehlerhaft
            return None

    @staticmethod
    def _save_secret_to_keyring(key: str, value: str) -> bool:
        try:
            import keyring

            keyring.set_password("kindle-meta", key, value or "")
            return True
        except Exception:  # noqa: BLE001 - keyring optional/fehlerhaft
            return False

    def get(self, key: str, default: object = None) -> object:
        return self._data.get(key, default)

    def set(self, key: str, value: object) -> None:
        self._data[key] = value
        self._save()

    def as_dict(self) -> dict[str, object]:
        return dict(self._data)

    def _save(self) -> None:
        to_write: dict[str, object] = {}
        for key, value in self._data.items():
            if key in _SECRET_KEYS and self._save_secret_to_keyring(key, str(value or "")):
                continue
            to_write[key] = value
        settings_path().write_text(
            json.dumps(to_write, indent=2, ensure_ascii=False), encoding="utf-8"
        )
