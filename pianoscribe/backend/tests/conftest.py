"""Gemeinsame Fixtures: isoliertes Datenverzeichnis, Testaudio und Fake-Modelle."""

from __future__ import annotations

import shutil
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from pianoscribe.notation.types import RawNote, RawPedal
from pianoscribe.rhythm import BeatResult
from pianoscribe.runtime import Reporter
from pianoscribe.transcription import RawTranscription

HAS_FFMPEG = shutil.which("ffmpeg") is not None
requires_ffmpeg = pytest.mark.skipif(not HAS_FFMPEG, reason="ffmpeg nicht installiert")


@pytest.fixture(autouse=True)
def isolated_home(tmp_path, monkeypatch):
    home = tmp_path / "home"
    home.mkdir()
    monkeypatch.setenv("PIANOSCRIBE_HOME", str(home))
    return home


def make_tone(path: Path, seconds: float = 4.0, sr: int = 44100, freq: float = 261.63) -> Path:
    t = np.arange(int(seconds * sr)) / sr
    tone = 0.3 * np.sin(2 * np.pi * freq * t) * np.exp(-(t % 0.5) * 4)
    sf.write(str(path), np.stack([tone, tone], axis=1).astype(np.float32), sr)
    return path


@pytest.fixture
def tone_wav(tmp_path) -> Path:
    return make_tone(tmp_path / "tone.wav")


# ---- Fakes für die Modelle ------------------------------------------------------------------
BPM = 120.0
BEAT = 60.0 / BPM


def scale_notes(n: int = 8, start: float = 0.5) -> list[RawNote]:
    """C-Dur-Tonleiter in Vierteln bei 120 BPM, beginnend auf einem Taktschlag."""
    pitches = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79]
    return [RawNote(start + i * BEAT, start + (i + 0.9) * BEAT, pitches[i % len(pitches)], 80)
            for i in range(n)]


class FakeSeparator:
    name = "htdemucs_6s"

    def __init__(self) -> None:
        self.calls = 0

    def separate(self, audio, sample_rate, reporter: Reporter):
        self.calls += 1
        reporter.progress(0.5)
        reporter.progress(1.0)
        return {"piano": audio * 0.5, "drums": audio * 0.1}


class FakeTranscriber:
    name = "bytedance"
    sample_rate = 16000

    def __init__(self, notes: list[RawNote] | None = None) -> None:
        self.calls = 0
        self.notes = notes if notes is not None else scale_notes()

    def transcribe(self, audio, reporter: Reporter) -> RawTranscription:
        self.calls += 1
        reporter.progress(1.0)
        duration = len(audio) / self.sample_rate
        return RawTranscription(self.notes, [RawPedal(0.5, 1.4)], duration, self.name)


class FakeBeatTracker:
    def __init__(self) -> None:
        self.calls = 0

    def track(self, audio, sample_rate, reporter: Reporter) -> BeatResult:
        self.calls += 1
        duration = len(audio) / sample_rate
        beats = list(np.arange(0.5, duration, BEAT))
        return BeatResult(beats, beats[::4])


class FakeEngines:
    def __init__(self, notes: list[RawNote] | None = None) -> None:
        self.sep = FakeSeparator()
        self.trans = FakeTranscriber(notes)
        self.beats = FakeBeatTracker()

    def separator(self, name):
        return self.sep

    def transcriber(self, name):
        return self.trans

    def beat_tracker(self):
        return self.beats


@pytest.fixture
def fake_engines() -> FakeEngines:
    return FakeEngines()
