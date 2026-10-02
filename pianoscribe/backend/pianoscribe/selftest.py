"""Selbsttest der Installation (``pianoscribe selftest``).

Prüft ohne Fenster, ob alles Nötige vorhanden ist und funktioniert: mitgelieferte Dateien,
Datenordner, ffmpeg, PyTorch/GPU, die Modellbibliotheken und die Notation. Mit ``models=True``
rechnen zusätzlich alle drei Modelle ein paar Sekunden synthetisches Audio. Gedacht für den
Rauchtest des gepackten Programms (Build-Skript, CI) und zur Fehlersuche beim Nutzer.
"""

from __future__ import annotations

import sys
import tempfile
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import numpy as np

SAMPLE_RATE = 44100


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str


def _synth_piano(seconds: float = 6.0,
                 bpm: float = 120.0) -> tuple[np.ndarray, list[tuple[float, float, int]]]:
    """Einfache „Klavier“-Töne (abklingende Obertöne) auf jedem Schlag, Stereo float32."""
    beat = 60.0 / bpm
    t = np.arange(int(seconds * SAMPLE_RATE)) / SAMPLE_RATE
    audio = np.zeros_like(t)
    melody = [60, 64, 67, 72, 67, 64, 60, 55, 57, 60, 65, 69]
    notes: list[tuple[float, float, int]] = []
    for i, pitch in enumerate(melody):
        onset = 0.25 + i * beat
        if onset + 0.4 > seconds:
            break
        freq = 440.0 * 2 ** ((pitch - 69) / 12)
        env_t = t - onset
        mask = env_t >= 0
        env = np.where(mask, np.exp(-3.0 * np.clip(env_t, 0, None)), 0.0)
        tone = sum(np.sin(2 * np.pi * freq * k * t) / k for k in (1, 2, 3))
        audio += 0.3 * env * tone
        notes.append((onset, onset + beat * 0.9, pitch))
    audio = 0.8 * audio / max(1e-6, float(np.abs(audio).max()))
    stereo = np.stack([audio, audio], axis=1).astype(np.float32)
    return stereo, notes


def _check_bundle() -> str:
    from .paths import frontend_dist, samples_dir

    index = frontend_dist() / "index.html"
    if not index.is_file():
        raise FileNotFoundError(f"Frontend fehlt: {index}")
    samples = list(samples_dir().glob("*.mp3"))
    if len(samples) < 30:
        raise FileNotFoundError(f"Klavier-Samples unvollständig ({len(samples)}/30): "
                                f"{samples_dir()}")
    return f"Oberfläche und {len(samples)} Klavier-Samples vorhanden"


def _check_data_dir() -> str:
    from .paths import data_dir

    directory = data_dir()
    directory.mkdir(parents=True, exist_ok=True)
    probe = directory / ".selftest"
    probe.write_text("ok", encoding="utf-8")
    probe.unlink()
    return str(directory)


def _check_ffmpeg() -> str:
    import soundfile as sf

    from .audio import decode_to_wav
    from .paths import ffmpeg_exe

    exe = ffmpeg_exe()
    audio, _notes = _synth_piano(1.0)
    with tempfile.TemporaryDirectory(prefix="pianoscribe-") as tmp:
        src = Path(tmp) / "probe.flac"
        sf.write(src, audio, SAMPLE_RATE)
        duration = decode_to_wav(src, Path(tmp) / "probe.wav")
    if abs(duration - 1.0) > 0.05:
        raise RuntimeError(f"Dekodierte Dauer {duration:.2f} s statt 1,00 s")
    return f"{exe} (Dekodieren ok)"


def _check_torch() -> str:
    from .runtime import gpu_info

    info = gpu_info()
    base = f"torch {info['torch']}, CUDA-Build {info['cuda_build'] or '–'}"
    if info["cuda_available"]:
        vram = (info["vram_total_mb"] or 0) / 1024
        return f"{base}, GPU: {info['name']} ({vram:.1f} GB)"
    return f"{base}, keine CUDA-GPU – Berechnung auf der CPU"


def _check_libraries() -> str:
    import beat_this.inference  # noqa: F401
    import demucs
    import demucs.apply
    import demucs.htdemucs
    import demucs.pretrained
    import music21
    import torchaudio  # noqa: F401

    from .transcription.bytedance_vendor import model  # noqa: F401

    return f"demucs {demucs.__version__}, music21 {music21.VERSION_STR}, beat_this"


def _check_webview() -> str:
    import webview  # noqa: F401

    from .main import webview_problem

    problem = webview_problem()
    if problem:
        raise RuntimeError(problem[0])
    return "Edge WebView2 vorhanden" if sys.platform == "win32" else "pywebview geladen"


def _check_notation() -> str:
    from .notation.build_score import to_musicxml_string
    from .notation.notate import notate
    from .notation.types import RawNote
    from .project import NotationParams

    _audio, synth = _synth_piano(6.0)
    notes = [RawNote(onset, offset, pitch, 80) for onset, offset, pitch in synth]
    notes += [RawNote(onset, offset, pitch - 24, 70) for onset, offset, pitch in synth[::2]]
    beats = [0.25 + 0.5 * i for i in range(12)]
    result = notate(notes, [], beats, beats[::4], NotationParams())
    xml = to_musicxml_string(result.score)
    if "<score-partwise" not in xml or result.info.notes < len(notes):
        raise RuntimeError("MusicXML unvollständig")
    return f"{result.info.notes} Noten → {result.info.measures} Takte MusicXML"


def _model_checks(device: str) -> list[tuple[str, Callable[[], str]]]:
    from . import models
    from .audio import BEATS_PEAK, TRANSCRIBE_PEAK, normalize_peak, resample, to_mono
    from .pipeline import ModelEngines
    from .runtime import Reporter

    engines = ModelEngines(device)
    audio, _notes = _synth_piano(6.0)
    reporter = Reporter()

    def installed() -> str:
        missing = models.missing()
        if missing:
            names = ", ".join(spec.title for spec in missing)
            raise FileNotFoundError(f"Es fehlen: {names} → 'models download' ausführen")
        return f"alle {len(models.CATALOG)} vorhanden in {models.models_dir()}"

    def timed(label: str, fn: Callable[[], str]) -> Callable[[], str]:
        def run() -> str:
            start = time.perf_counter()
            detail = fn()
            elapsed = time.perf_counter() - start
            return f"{label} in {elapsed:.1f} s auf {engines.device.type} – {detail}"

        return run

    def separate() -> str:
        stems = engines.separator("htdemucs_6s").separate(audio, SAMPLE_RATE, reporter)
        return f"Spuren: {', '.join(sorted(stems))}"

    def transcribe() -> str:
        transcriber = engines.transcriber("bytedance")
        mono = normalize_peak(resample(to_mono(audio), SAMPLE_RATE, transcriber.sample_rate),
                              TRANSCRIBE_PEAK)
        raw = transcriber.transcribe(mono, reporter)
        return f"{len(raw.notes)} Noten erkannt"

    def beats() -> str:
        result = engines.beat_tracker().track(normalize_peak(audio, BEATS_PEAK), SAMPLE_RATE,
                                              reporter)
        return f"{len(result.beats)} Schläge erkannt"

    return [
        ("Modelle", installed),
        ("Separation", timed("6 s Audio", separate)),
        ("Transkription", timed("6 s Audio", transcribe)),
        ("Beat-Erkennung", timed("6 s Audio", beats)),
    ]


def run_checks(models: bool = False, device: str = "auto",
               on_result: Callable[[CheckResult], None] | None = None) -> list[CheckResult]:
    """Führt alle Prüfungen aus; eine fehlgeschlagene Prüfung bricht die übrigen nicht ab."""
    checks: list[tuple[str, Callable[[], str]]] = [
        ("Programmdateien", _check_bundle),
        ("Datenordner", _check_data_dir),
        ("ffmpeg", _check_ffmpeg),
        ("PyTorch", _check_torch),
        ("Bibliotheken", _check_libraries),
        ("Fenster (pywebview)", _check_webview),
        ("Notation", _check_notation),
    ]
    results: list[CheckResult] = []

    def run(name: str, fn: Callable[[], str]) -> bool:
        try:
            result = CheckResult(name, True, fn())
        except Exception as exc:
            result = CheckResult(name, False, f"{type(exc).__name__}: {exc}")
        results.append(result)
        if on_result is not None:
            on_result(result)
        return result.ok

    for name, fn in checks:
        run(name, fn)
    if models:
        model_checks = _model_checks(device)
        if run(*model_checks[0]):
            for name, fn in model_checks[1:]:
                run(name, fn)
    return results
