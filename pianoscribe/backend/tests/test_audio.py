"""Tests für audio.py (ffmpeg-Dekodierung, Trim, Resampling, Peaks)."""

import numpy as np
import pytest
import soundfile as sf

from pianoscribe import audio

from .conftest import make_tone, requires_ffmpeg


@requires_ffmpeg
def test_decode_mono_22k_to_stereo_44k(tmp_path):
    src = tmp_path / "in.wav"
    t = np.arange(22050 * 2) / 22050
    sf.write(str(src), (0.2 * np.sin(2 * np.pi * 440 * t)).astype(np.float32), 22050)
    dst = tmp_path / "work.wav"
    duration = audio.decode_to_wav(src, dst)
    info = sf.info(str(dst))
    assert duration == pytest.approx(2.0, abs=0.01)
    assert (info.samplerate, info.channels, info.subtype) == (44100, 2, "PCM_16")


@requires_ffmpeg
def test_decode_rejects_garbage(tmp_path):
    bad = tmp_path / "bad.mp3"
    bad.write_bytes(b"not audio at all" * 100)
    with pytest.raises(audio.AudioDecodeError):
        audio.decode_to_wav(bad, tmp_path / "out.wav")


def test_trim_length_and_fades(tmp_path):
    src = make_tone(tmp_path / "t.wav", seconds=3.0)
    dst = tmp_path / "trimmed.wav"
    length = audio.trim(src, dst, 1.0, 2.5)
    data, sr = sf.read(str(dst))
    assert length == pytest.approx(1.5, abs=1e-3)
    assert data.shape[0] == pytest.approx(1.5 * sr, abs=2)
    assert abs(data[0]).max() < 1e-3 and abs(data[-1]).max() < 1e-3


def test_load_mono_resamples(tmp_path):
    src = make_tone(tmp_path / "t.wav", seconds=1.0)
    mono = audio.load_mono(src, 16000)
    assert mono.ndim == 1 and mono.dtype == np.float32
    assert len(mono) == pytest.approx(16000, abs=2)


def test_peaks_resolution(tmp_path):
    src = make_tone(tmp_path / "t.wav", seconds=2.5)
    peaks = audio.compute_peaks(src)
    assert peaks["duration_s"] == pytest.approx(2.5)
    assert len(peaks["peaks"]) == 250
    assert min(peaks["peaks"]) >= 0.0 and max(peaks["peaks"]) == pytest.approx(1.0)
