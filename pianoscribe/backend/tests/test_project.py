"""Tests für Projektordner, Manifest und Stufen-Hashes."""

import json

import pytest

from pianoscribe import project as projects
from pianoscribe.project import ProjectError

from .conftest import requires_ffmpeg

pytestmark = requires_ffmpeg


def test_create_project_copies_decodes_and_computes_peaks(tone_wav):
    p = projects.create(tone_wav, name="Test")
    m = p.load()
    assert m.name == "Test"
    assert m.source.original_name == "tone.wav"
    assert m.source.duration_s == pytest.approx(4.0, abs=0.01)
    assert (p.root / m.source.file).exists()
    assert p.work_wav.exists()
    peaks = json.loads(p.waveform_json.read_text())
    assert peaks["per_second"] == 100
    assert len(peaks["peaks"]) == pytest.approx(400, abs=2)
    assert max(peaks["peaks"]) == pytest.approx(1.0)
    assert [x.id for x in projects.list_projects()] == [p.id]


def test_create_rejects_unknown_format(tmp_path):
    bad = tmp_path / "notes.txt"
    bad.write_text("x")
    with pytest.raises(ProjectError):
        projects.create(bad)


def test_update_merges_and_validates(tone_wav):
    p = projects.create(tone_wav)
    m = p.update({"trim": {"start_s": 1.0, "end_s": 3.0},
                  "notation": {"grid": "1/8", "hand_split": {"mode": "fixed"}}})
    assert m.trim_range() == (1.0, 3.0)
    assert m.notation.grid == "1/8"
    assert m.notation.hand_split.pitch == 60  # verschachtelt zusammengeführt
    for bad in ({"trim": {"start_s": 2.0, "end_s": 2.2}},
                {"notation": {"time_signature": "4/5"}},
                {"notation": {"key": "H major"}},
                {"notation": {"grid": "1/32"}},
                {"unknown": 1}):
        with pytest.raises(ProjectError):
            p.update(bad)
    assert p.load().trim_range() == (1.0, 3.0)  # nichts Ungültiges gespeichert


def test_stage_hashes_follow_dependencies(tone_wav):
    p = projects.create(tone_wav)
    before = {s: p.stage_hash(s) for s in projects.STAGES}
    p.update({"notation": {"min_velocity": 30}})
    after = {s: p.stage_hash(s) for s in projects.STAGES}
    assert [s for s in projects.STAGES if before[s] != after[s]] == ["notate"]

    p.update({"trim": {"start_s": 0.5, "end_s": 3.5}})
    after_trim = {s: p.stage_hash(s) for s in projects.STAGES}
    assert all(after_trim[s] != after[s] for s in projects.STAGES)

    p.update({"options": {"separate": False}})
    no_sep = {s: p.stage_hash(s) for s in projects.STAGES}
    assert no_sep["separate"] is None
    assert no_sep["rhythm"] == after_trim["rhythm"]  # Rhythmus hängt nur am Ausschnitt
    assert no_sep["transcribe"] != after_trim["transcribe"]


def test_get_rejects_path_traversal():
    for bad in ("..", "../x", "a/b", ""):
        with pytest.raises(projects.ProjectNotFoundError):
            projects.get(bad)


def test_delete(tone_wav):
    p = projects.create(tone_wav)
    projects.delete(p.id)
    assert not p.root.exists()
    with pytest.raises(projects.ProjectNotFoundError):
        projects.get(p.id)
