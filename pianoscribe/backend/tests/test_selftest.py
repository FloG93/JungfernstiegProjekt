"""Selbsttest der Installation (``pianoscribe selftest``) ohne Modelle."""

import sys

import pytest

from pianoscribe import cli, paths, selftest
from pianoscribe import main as app_main

from .conftest import requires_ffmpeg

CORE_CHECKS = ["Programmdateien", "Datenordner", "ffmpeg", "PyTorch", "Bibliotheken",
               "Fenster (pywebview)", "Notation"]


@pytest.fixture
def fake_bundle(tmp_path, monkeypatch):
    """Ein Bundle-Ordner mit Oberfläche und 30 (leeren) Samples."""
    root = tmp_path / "bundle"
    (root / "frontend" / "dist").mkdir(parents=True)
    (root / "frontend" / "dist" / "index.html").write_text("<!doctype html>", encoding="utf-8")
    samples = root / "assets" / "samples" / "salamander"
    samples.mkdir(parents=True)
    for i in range(30):
        (samples / f"n{i}.mp3").write_bytes(b"ID3")
    monkeypatch.setattr(paths, "bundle_dir", lambda: root)
    return root


@requires_ffmpeg
def test_core_checks_pass(fake_bundle):
    seen = []
    results = selftest.run_checks(on_result=seen.append)
    assert [r.name for r in results] == CORE_CHECKS
    assert seen == results
    failed = [f"{r.name}: {r.detail}" for r in results if not r.ok]
    assert not failed
    notation = results[-1].detail
    assert "Noten" in notation and "Takte" in notation


def test_failed_check_does_not_stop_the_rest(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(paths, "bundle_dir", lambda: tmp_path / "leer")
    results = selftest.run_checks()
    assert [r.name for r in results] == CORE_CHECKS
    assert not results[0].ok and "Frontend fehlt" in results[0].detail
    assert results[-1].ok  # Notation läuft trotzdem

    assert cli.main(["selftest"]) == 1
    out = capsys.readouterr().out
    assert "✘ Programmdateien" in out and "fehlgeschlagen" in out


def test_models_missing_skips_model_runs(fake_bundle, monkeypatch, tmp_path):
    monkeypatch.setenv("PIANOSCRIBE_MODELS", str(tmp_path / "keine-modelle"))
    monkeypatch.setattr(selftest, "_check_ffmpeg", lambda: "übersprungen")
    results = selftest.run_checks(models=True, device="cpu")
    names = [r.name for r in results]
    assert names == [*CORE_CHECKS, "Modelle"]  # ohne Modelle keine Rechenläufe
    assert not results[-1].ok and "models download" in results[-1].detail


def test_webview_problem_only_on_windows(monkeypatch):
    assert app_main.webview_problem("linux") is None

    monkeypatch.setitem(sys.modules, "webview.platforms.winforms",
                        type(sys)("webview.platforms.winforms"))
    sys.modules["webview.platforms.winforms"].renderer = "edgechromium"
    assert app_main.webview_problem("win32") is None

    sys.modules["webview.platforms.winforms"].renderer = "mshtml"
    message, url = app_main.webview_problem("win32")
    assert "WebView2" in message and url == app_main.WEBVIEW2_URL

    monkeypatch.setitem(sys.modules, "webview.platforms.winforms", None)  # Import schlägt fehl
    message, url = app_main.webview_problem("win32")
    assert ".NET" in message and url is None
