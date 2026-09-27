"""Tests für die Kommandozeile (mit Fake-Modellen)."""

import pytest

from pianoscribe import cli, pipeline
from pianoscribe import project as projects

from .conftest import FakeEngines, requires_ffmpeg

pytestmark = requires_ffmpeg


@pytest.fixture
def fake_model_engines(monkeypatch):
    engines = FakeEngines()
    monkeypatch.setattr(pipeline, "ModelEngines", lambda device="auto": engines)
    return engines


def test_run_creates_project_and_outputs(tone_wav, fake_model_engines, capsys):
    code = cli.main(["run", str(tone_wav), "--start", "0.2", "--end", "3.8", "--no-separate",
                     "--title", "Tonleiter", "--timings"])
    out = capsys.readouterr().out
    assert code == 0
    assert "Tonart C-Dur" in out and "Laufzeiten" in out
    (m,) = projects.list_projects()
    assert m.trim_range() == (0.2, 3.8)
    assert not m.options.separate
    assert m.notation.title == "Tonleiter"
    assert fake_model_engines.sep.calls == 0


def test_notate_only_with_new_params(tone_wav, fake_model_engines, capsys):
    cli.main(["run", str(tone_wav), "--quiet"])
    (m,) = projects.list_projects()
    code = cli.main(["run", "--project", m.id, "--notate-only", "--grid", "1/8",
                     "--time-signature", "3/4"])
    assert code == 0
    assert "Takt 3/4" in capsys.readouterr().out
    assert fake_model_engines.trans.calls == 1


def test_errors_are_reported_without_traceback(capsys):
    assert cli.main(["run", "--project", "doesnotexist"]) == 1
    assert "nicht gefunden" in capsys.readouterr().err
    assert cli.main(["models"]) == 0
