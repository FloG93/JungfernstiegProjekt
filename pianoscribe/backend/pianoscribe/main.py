"""Desktop-App: interner Server im Hintergrund-Thread und ein pywebview-Fenster (Edge WebView2).

Ablauf: freien Port wählen, uvicorn im Thread starten, Fenster mit Sitzungs-Token öffnen,
``js_api`` für native Dialoge registrieren. Beim Schließen laufende Jobs abbrechen und den
Server sauber beenden.
"""

from __future__ import annotations

import base64
import logging
import multiprocessing
import os
import sys
from collections.abc import Sequence
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

AUDIO_FILTER = "Audiodateien (*.mp3;*.m4a;*.aac;*.flac;*.wav;*.ogg;*.oga;*.opus;*.wma)"
ALLOWED_SAVE_EXTENSIONS = {".pdf", ".musicxml", ".xml", ".mxl", ".mid", ".midi"}

LOCALIZATION = {
    "global.quitConfirmation": "PianoScribe wirklich beenden?",
    "global.ok": "OK",
    "global.quit": "Beenden",
    "global.cancel": "Abbrechen",
    "global.saveFile": "Datei speichern",
    "windows.fileFilter.allFiles": "Alle Dateien",
    "windows.fileFilter.otherFiles": "Andere Dateitypen",
    "linux.openFile": "Datei öffnen",
    "linux.openFiles": "Dateien öffnen",
    "linux.openFolder": "Ordner öffnen",
}


class Bridge:
    """``js_api`` für das Frontend – nur native Funktionen.

    Öffentliche Methoden sind in JavaScript als ``window.pywebview.api.*`` erreichbar; das
    Fenster steht bewusst in einem privaten Attribut, damit pywebview es nicht exponiert.
    """

    def __init__(self) -> None:
        self._window: Any = None
        self._approved: set[str] = set()

    def open_audio_dialog(self) -> str | None:
        import webview

        result = self._window.create_file_dialog(webview.FileDialog.OPEN, allow_multiple=False,
                                                 file_types=(AUDIO_FILTER, "Alle Dateien (*.*)"))
        path = _first(result)
        log.info("Datei gewählt: %s", path)
        return path

    def save_file_dialog(self, default_name: str, filetypes: Sequence[str]) -> str | None:
        import webview

        types = tuple(filetypes) or ("Alle Dateien (*.*)",)
        result = self._window.create_file_dialog(webview.FileDialog.SAVE,
                                                 save_filename=Path(default_name).name,
                                                 file_types=types)
        path = _first(result)
        if not path:
            return None
        chosen = Path(path)
        default_ext = Path(default_name).suffix.lower()
        if chosen.suffix.lower() not in ALLOWED_SAVE_EXTENSIONS and default_ext:
            chosen = chosen.with_name(chosen.name + default_ext)
        self._approved.add(str(chosen))
        return str(chosen)

    def write_file(self, path: str, data_base64: str) -> bool:
        """Schreibt eine Datei – nur an einen Ort, den der Nutzer im Dialog gewählt hat."""
        target = Path(path)
        if str(target) not in self._approved:
            raise PermissionError("Dieser Speicherort wurde nicht im Dialog gewählt.")
        if target.suffix.lower() not in ALLOWED_SAVE_EXTENSIONS:
            raise PermissionError(f"Dateityp {target.suffix} ist nicht erlaubt.")
        data = base64.b64decode(data_base64, validate=True)
        tmp = target.with_name(target.name + ".part")
        tmp.write_bytes(data)
        tmp.replace(target)
        self._approved.discard(str(target))
        log.info("Gespeichert: %s (%d Bytes)", target, len(data))
        return True


def _first(result: Any) -> str | None:
    if not result:
        return None
    if isinstance(result, str):
        return result
    return str(result[0]) if len(result) else None


def run_app() -> int:
    import webview

    from .api import AppConfig
    from .logs import setup_logging
    from .server import start_background

    log_path = setup_logging()
    try:
        server = start_background(AppConfig())
    except Exception:
        log.exception("Server-Start fehlgeschlagen")
        print(f"PianoScribe konnte nicht starten. Details: {log_path}", file=sys.stderr)
        return 1
    log.info("Interner Server auf Port %d", server.port)

    bridge = Bridge()
    window = webview.create_window("PianoScribe", server.url, js_api=bridge, width=1440,
                                   height=920, min_size=(1000, 680), background_color="#f4f5f8",
                                   text_select=True)
    if window is None:  # pragma: no cover - nur bei defekter pywebview-Installation
        server.stop()
        return 1
    bridge._window = window
    jobs = server.app.state.jobs

    def on_closing() -> bool:
        running = [j for j in jobs.list() if j.active]
        if not running:
            return True
        return bool(window.create_confirmation_dialog(
            "PianoScribe", "Eine Berechnung läuft noch. Trotzdem beenden?"))

    window.events.closing += on_closing
    try:
        webview.start(gui="edgechromium" if sys.platform == "win32" else None,
                      localization=LOCALIZATION, debug=bool(os.environ.get("PIANOSCRIBE_DEBUG")))
    finally:
        log.info("Fenster geschlossen – beende Jobs und Server")
        jobs.cancel_all()
        server.stop()
    return 0


def main() -> int:
    """Einstieg der gepackten App (PyInstaller)."""
    multiprocessing.freeze_support()
    return run_app()


if __name__ == "__main__":
    raise SystemExit(main())
