"""Ende-zu-Ende mit echten Modellen (Marker ``models``, standardmäßig übersprungen).

Aufruf: ``PIANOSCRIBE_MODELS=<ordner> uv run pytest -m models``. Der Ordner muss die Gewichte
enthalten (``pianoscribe models download``) und die Salamander-Samples müssen geladen sein.
"""

import json
import os
from pathlib import Path

import pytest

from evaluation.metrics import note_f1
from evaluation.synth import SAMPLE_DIR, demo_piece, read_midi, render_demo
from pianoscribe import models
from pianoscribe import project as projects
from pianoscribe.pipeline import ModelEngines, Pipeline
from pianoscribe.transcription import RawTranscription

pytestmark = [
    pytest.mark.models,
    pytest.mark.skipif(not os.environ.get("PIANOSCRIBE_MODELS"),
                       reason="PIANOSCRIBE_MODELS nicht gesetzt"),
    pytest.mark.skipif(not any(SAMPLE_DIR.glob("*.mp3")), reason="Salamander-Samples fehlen"),
]


@pytest.fixture(scope="module")
def demo_files(tmp_path_factory) -> dict[str, Path]:
    if models.missing():
        pytest.skip("Modellgewichte fehlen")
    return render_demo(tmp_path_factory.mktemp("demo"))


def test_piano_solo_transcription_and_notation(demo_files):
    project = projects.create(demo_files["piano"], name="Demo")
    project.update({"options": {"separate": False}})
    Pipeline(ModelEngines("cpu")).run(project)
    truth, _ = read_midi(demo_files["midi"])
    raw = RawTranscription.load(project.raw_notes_json)
    score = note_f1([(n.start, n.end, n.pitch) for n in truth],
                    [(n.onset, n.offset, n.pitch) for n in raw.notes])
    assert score.f1 > 0.95, score
    info = json.loads(project.score_json.read_text())["info"]
    assert abs(info["tempo_bpm"] - demo_piece().bpm) < 3
    assert info["key"] == "E- major"
    assert info["pickup_quarters"] == 1.0
    assert info["time_signature"] == "4/4"


def test_mix_with_separation_runs(demo_files):
    project = projects.create(demo_files["mix"], name="Demo Mix")
    executed = Pipeline(ModelEngines("cpu")).run(project)
    assert executed == ["trim", "separate", "transcribe", "rhythm", "notate"]
    assert project.piano_wav.exists() and project.score_musicxml.exists()
