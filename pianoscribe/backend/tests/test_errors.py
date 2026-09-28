"""Verständliche Fehlermeldungen für die Oberfläche."""

import errno

import pytest

from pianoscribe import jobs, models, paths
from pianoscribe.audio import AudioDecodeError


@pytest.mark.parametrize(("exc", "code"), [
    (models.ModelMissingError("Modell fehlt"), "models_missing"),
    (AudioDecodeError("Datei defekt"), "audio"),
    (OSError(errno.ENOSPC, "No space left on device"), "disk_full"),
    (MemoryError(), "ram"),
    (RuntimeError("CUDA out of memory. Tried to allocate 2.00 GiB"), "cuda_oom"),
    (models.ModelDownloadError("Zeitüberschreitung"), "download"),
    (ValueError("unerwartet"), "internal"),
])
def test_describe_error(exc, code):
    info = jobs.describe_error(exc)
    assert info["code"] == code
    assert info["message"] and info["hint"]


def test_ffmpeg_hint_in_packaged_app(monkeypatch, tmp_path):
    monkeypatch.delenv("PIANOSCRIBE_FFMPEG", raising=False)
    monkeypatch.setattr(paths, "is_frozen", lambda: True)
    monkeypatch.setattr(paths, "bundle_dir", lambda: tmp_path)
    monkeypatch.setattr(paths.shutil, "which", lambda _name: None)
    with pytest.raises(paths.FFmpegNotFoundError, match="neu installieren"):
        paths.ffmpeg_exe()
