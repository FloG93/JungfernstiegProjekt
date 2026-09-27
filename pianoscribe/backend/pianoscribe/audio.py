"""Audio-Hilfen: Dekodieren per ffmpeg, Trimmen, Resampling und Wellenform-Peaks."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
import soxr

from .paths import ffmpeg_exe

WORK_SAMPLE_RATE = 44100
SUPPORTED_EXTENSIONS = {".mp3", ".m4a", ".aac", ".flac", ".wav", ".ogg", ".oga", ".opus", ".wma"}
PEAKS_PER_SECOND = 100
_FADE_S = 0.005


class AudioDecodeError(RuntimeError):
    """Die Datei konnte nicht dekodiert werden."""


def _no_window() -> int:
    # Im Fensterbetrieb unter Windows soll ffmpeg keine Konsole aufblitzen lassen.
    return getattr(subprocess, "CREATE_NO_WINDOW", 0) if sys.platform == "win32" else 0


def decode_to_wav(src: Path, dst: Path, sample_rate: int = WORK_SAMPLE_RATE) -> float:
    """Dekodiert eine beliebige Audiodatei zu 16-bit-Stereo-WAV. Gibt die Dauer in s zurück."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_suffix(".tmp.wav")
    cmd = [ffmpeg_exe(), "-nostdin", "-v", "error", "-y", "-i", str(src), "-vn",
           "-ac", "2", "-ar", str(sample_rate), "-c:a", "pcm_s16le", str(tmp)]
    proc = subprocess.run(cmd, capture_output=True, text=True, creationflags=_no_window())
    if proc.returncode != 0 or not tmp.exists():
        tmp.unlink(missing_ok=True)
        detail = (proc.stderr or "").strip().splitlines()[-1:] or ["unbekannter Fehler"]
        raise AudioDecodeError(f"Die Datei konnte nicht gelesen werden: {detail[0]}")
    tmp.replace(dst)
    info = sf.info(str(dst))
    if info.frames == 0:
        raise AudioDecodeError("Die Datei enthält kein Audio.")
    return info.frames / info.samplerate


def duration_s(path: Path) -> float:
    info = sf.info(str(path))
    return info.frames / info.samplerate


def read_audio(path: Path, start_s: float = 0.0,
               end_s: float | None = None) -> tuple[np.ndarray, int]:
    """Liest einen Abschnitt als float32 (frames, channels)."""
    info = sf.info(str(path))
    start = max(0, round(start_s * info.samplerate))
    stop = info.frames if end_s is None else min(info.frames, round(end_s * info.samplerate))
    audio, sr = sf.read(str(path), start=start, stop=max(start, stop), dtype="float32",
                        always_2d=True)
    return audio, sr


def write_audio(path: Path, audio: np.ndarray, sample_rate: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp.wav")
    sf.write(str(tmp), np.clip(audio, -1.0, 1.0), sample_rate, subtype="PCM_16")
    tmp.replace(path)


def trim(src: Path, dst: Path, start_s: float, end_s: float) -> float:
    """Schneidet [start_s, end_s) aus und blendet 5 ms ein/aus. Gibt die Länge zurück."""
    audio, sr = read_audio(src, start_s, end_s)
    if audio.shape[0] == 0:
        raise ValueError("Der Ausschnitt ist leer.")
    fade = min(round(_FADE_S * sr), audio.shape[0] // 2)
    if fade > 0:
        ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)[:, None]
        audio[:fade] *= ramp
        audio[-fade:] *= ramp[::-1]
    write_audio(dst, audio, sr)
    return audio.shape[0] / sr


def to_mono(audio: np.ndarray) -> np.ndarray:
    return audio.mean(axis=1) if audio.ndim == 2 else audio


def resample(audio: np.ndarray, sr_in: int, sr_out: int) -> np.ndarray:
    if sr_in == sr_out:
        return audio.astype(np.float32, copy=False)
    return soxr.resample(audio, sr_in, sr_out).astype(np.float32, copy=False)


def load_mono(path: Path, sample_rate: int) -> np.ndarray:
    """Liest eine Datei als Mono-float32 in der gewünschten Abtastrate."""
    audio, sr = read_audio(path)
    return resample(to_mono(audio), sr, sample_rate)


def compute_peaks(path: Path, per_second: int = PEAKS_PER_SECOND) -> dict[str, object]:
    """Maximalbeträge je Block für die Wellenform-Anzeige (mono, auf 1 normiert)."""
    info = sf.info(str(path))
    block = max(1, info.samplerate // per_second)
    peaks: list[np.ndarray] = []
    for chunk in sf.blocks(str(path), blocksize=block * per_second * 10, dtype="float32",
                           always_2d=True):
        mono = np.abs(chunk).max(axis=1)
        n = len(mono) // block
        if n:
            peaks.append(mono[: n * block].reshape(n, block).max(axis=1))
        if len(mono) % block:
            peaks.append(np.array([mono[n * block :].max()], dtype=np.float32))
    values = np.concatenate(peaks) if peaks else np.zeros(0, dtype=np.float32)
    top = float(values.max()) if values.size else 0.0
    if top > 0:
        values = values / top
    return {
        "duration_s": info.frames / info.samplerate,
        "per_second": per_second,
        "peaks": [round(float(v), 4) for v in values],
    }
