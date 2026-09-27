"""Tests für die Pipeline-Orchestrierung mit Fake-Modellen."""

import json
import threading

import pytest

from pianoscribe import project as projects
from pianoscribe.pipeline import Pipeline, PipelineError
from pianoscribe.runtime import CancelledError

from .conftest import requires_ffmpeg

pytestmark = requires_ffmpeg


def _run(project, engines, **kwargs):
    events = []
    pipeline = Pipeline(engines, on_event=events.append, **kwargs)
    executed = pipeline.run(project)
    return executed, events


def test_full_run_writes_all_outputs(tone_wav, fake_engines):
    p = projects.create(tone_wav)
    executed, events = _run(p, fake_engines)
    assert executed == ["trim", "separate", "transcribe", "rhythm", "notate"]
    for stage in projects.STAGES:
        assert all(path.exists() for path in p.stage_outputs(stage))
    assert (p.stems_dir / "drums.wav").exists()
    score = json.loads(p.score_json.read_text())
    assert score["info"]["time_signature"] == "4/4"
    assert score["info"]["key"] == "C major"
    assert len(score["notes"]) == 8
    assert {e.status for e in events} >= {"start", "progress", "done"}
    assert all(p.load().stages[s].done for s in projects.STAGES)


def test_second_run_uses_cache_and_notation_change_reruns_only_notate(tone_wav, fake_engines):
    p = projects.create(tone_wav)
    _run(p, fake_engines)
    executed, events = _run(p, fake_engines)
    assert executed == []
    assert {e.status for e in events} == {"cached"}

    p.update({"notation": {"grid": "1/8"}})
    executed, _ = _run(p, fake_engines)
    assert executed == ["notate"]
    assert fake_engines.trans.calls == 1


def test_disabling_separation_skips_stage_and_keeps_rhythm(tone_wav, fake_engines):
    p = projects.create(tone_wav)
    _run(p, fake_engines)
    p.update({"options": {"separate": False}})
    executed, events = _run(p, fake_engines)
    assert executed == ["transcribe", "notate"]
    assert any(e.stage == "separate" and e.status == "skipped" for e in events)
    assert p.load().stages["separate"].skipped
    assert fake_engines.sep.calls == 1
    assert fake_engines.beats.calls == 1


def test_from_stage_forces_rerun(tone_wav, fake_engines):
    p = projects.create(tone_wav)
    _run(p, fake_engines)
    pipeline = Pipeline(fake_engines)
    assert pipeline.run(p, from_stage="transcribe") == ["transcribe", "rhythm", "notate"]


def test_cancel_raises(tone_wav, fake_engines):
    p = projects.create(tone_wav)
    cancel = threading.Event()
    cancel.set()
    with pytest.raises(CancelledError):
        Pipeline(fake_engines, cancel=cancel).run(p)


def test_only_notate_without_inputs_gives_clear_error(tone_wav, fake_engines):
    p = projects.create(tone_wav)
    with pytest.raises(PipelineError, match="Transkribieren"):
        Pipeline(fake_engines).run(p, only=["notate"])
