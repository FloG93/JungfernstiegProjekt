"""Tests der Desktop-Hülle mit einem Fake-``webview`` (kein echtes Fenster nötig)."""

import base64
import sys
from types import SimpleNamespace

import httpx
import pytest

from pianoscribe import main as app_main

OPEN, SAVE = 10, 30


class FakeEvent:
    def __init__(self):
        self.handlers = []

    def __iadd__(self, handler):
        self.handlers.append(handler)
        return self


class FakeWindow:
    def __init__(self, url="", js_api=None, results=None):
        self.url = url
        self.js_api = js_api
        self.events = SimpleNamespace(closing=FakeEvent())
        self.results = results or {}
        self.confirm = True
        self.confirm_asked = False

    def create_file_dialog(self, dialog_type, **kwargs):
        self.last_kwargs = kwargs
        return self.results.get(dialog_type)

    def create_confirmation_dialog(self, title, message):
        self.confirm_asked = True
        return self.confirm


@pytest.fixture
def fake_webview(monkeypatch):
    module = SimpleNamespace(FileDialog=SimpleNamespace(OPEN=OPEN, SAVE=SAVE), created=[],
                             started=[])

    def create_window(title, url, js_api=None, **kwargs):
        window = FakeWindow(url, js_api)
        module.created.append(window)
        return window

    def start(**kwargs):
        module.started.append(kwargs)
        window = module.created[-1]
        # Während das „Fenster“ offen ist, muss der Server mit Token antworten.
        token = window.url.split("token=")[1]
        base = window.url.split("/?")[0]
        assert httpx.get(f"{base}/api/health").status_code == 401
        health = httpx.get(f"{base}/api/health", headers={"X-PianoScribe-Token": token})
        assert health.status_code == 200
        module.closing_results = [h() for h in window.events.closing.handlers]

    module.create_window = create_window
    module.start = start
    monkeypatch.setitem(sys.modules, "webview", module)
    return module


def test_run_app_starts_server_opens_window_and_shuts_down(fake_webview):
    assert app_main.run_app() == 0
    (window,) = fake_webview.created
    assert "?token=" in window.url
    assert isinstance(window.js_api, app_main.Bridge)
    assert fake_webview.started[0]["localization"]["global.cancel"] == "Abbrechen"
    assert fake_webview.closing_results == [True]  # keine laufenden Jobs → ohne Nachfrage


def test_bridge_open_dialog(fake_webview, tmp_path):
    bridge = app_main.Bridge()
    bridge._window = FakeWindow(results={OPEN: (str(tmp_path / "song.mp3"),)})
    assert bridge.open_audio_dialog() == str(tmp_path / "song.mp3")
    assert "Audiodateien" in bridge._window.last_kwargs["file_types"][0]
    bridge._window = FakeWindow(results={OPEN: None})
    assert bridge.open_audio_dialog() is None


def test_bridge_save_and_write_only_approved_paths(fake_webview, tmp_path):
    bridge = app_main.Bridge()
    target = tmp_path / "Noten"  # ohne Endung gewählt → .pdf wird ergänzt
    bridge._window = FakeWindow(results={SAVE: str(target)})
    path = bridge.save_file_dialog("Lied.pdf", ["PDF (*.pdf)"])
    assert path == str(tmp_path / "Noten.pdf")
    payload = base64.b64encode(b"%PDF-1.4 test").decode()
    assert bridge.write_file(path, payload) is True
    assert (tmp_path / "Noten.pdf").read_bytes() == b"%PDF-1.4 test"
    # Ein zweites Mal (ohne neuen Dialog) und fremde Pfade werden abgelehnt.
    with pytest.raises(PermissionError):
        bridge.write_file(path, payload)
    with pytest.raises(PermissionError):
        bridge.write_file(str(tmp_path / "evil.pdf"), payload)


def test_bridge_rejects_disallowed_extension(fake_webview, tmp_path):
    bridge = app_main.Bridge()
    bridge._approved.add(str(tmp_path / "x.exe"))
    with pytest.raises(PermissionError):
        bridge.write_file(str(tmp_path / "x.exe"), base64.b64encode(b"MZ").decode())


def test_run_app_uses_own_webview_profile(fake_webview, isolated_home):
    assert app_main.run_app() == 0
    kwargs = fake_webview.started[0]
    assert kwargs["private_mode"] is True
    assert kwargs["storage_path"] == str(isolated_home / "webview")


def test_run_app_stops_with_message_without_webview2(fake_webview, monkeypatch):
    shown = []
    monkeypatch.setattr(app_main, "webview_problem", lambda: ("WebView2 fehlt", "https://x"))
    monkeypatch.setattr(app_main, "_show_error",
                        lambda message, url=None: shown.append((message, url)))
    assert app_main.run_app() == 1
    assert shown == [("WebView2 fehlt", "https://x")]
    assert fake_webview.created == []  # kein Fenster, kein Server
