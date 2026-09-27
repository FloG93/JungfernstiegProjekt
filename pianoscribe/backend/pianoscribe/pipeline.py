"""Pipeline: Trim → Separation → Transkription → Rhythmus → Notation, mit Stufen-Cache.

Jede Stufe liest ihre Eingaben aus dem Projektordner und schreibt ihr Ergebnis dorthin.
Stufen, deren Eingabe-Hash sich nicht geändert hat, werden übersprungen.
"""

from __future__ import annotations

import json
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, Literal, Protocol

from . import audio
from .midi_io import write_raw_midi, write_score_midi
from .project import STAGES, Project
from .rhythm import BeatResult, BeatTracker
from .runtime import CancelledError, Reporter
from .separation import Separator
from .transcription import RawTranscription, Transcriber

EventStatus = Literal["start", "progress", "done", "skipped", "cached"]

STAGE_TITLES = {
    "trim": "Ausschnitt",
    "separate": "Klavier isolieren",
    "transcribe": "Transkribieren",
    "rhythm": "Rhythmus",
    "notate": "Noten",
}
# Grobe Gewichte für einen Gesamtfortschritt (Anteile an der Laufzeit).
STAGE_WEIGHTS = {"trim": 0.02, "separate": 0.45, "transcribe": 0.4, "rhythm": 0.05, "notate": 0.08}


class PipelineError(RuntimeError):
    """Verständlicher Fehler der Pipeline (z. B. fehlende Vorstufe)."""


def _stage_inputs(project: Project, stage: str) -> list[tuple[str, Any]]:
    """Dateien, die eine Stufe braucht, mit dem Titel der erzeugenden Stufe."""
    return {
        "trim": [("Import", project.work_wav)],
        "separate": [("Ausschnitt", project.trimmed_wav)],
        "transcribe": [("Klavier isolieren" if project.load().options.separate else "Ausschnitt",
                        project.transcription_input())],
        "rhythm": [("Ausschnitt", project.trimmed_wav)],
        "notate": [("Transkribieren", project.raw_notes_json), ("Rhythmus", project.beats_json)],
    }[stage]


@dataclass
class StageEvent:
    stage: str
    status: EventStatus
    progress: float = 0.0
    message: str | None = None


class Engines(Protocol):
    """Liefert die (lazy geladenen) Modelle. Tests setzen hier Fakes ein."""

    def separator(self, name: str) -> Separator: ...

    def transcriber(self, name: str) -> Transcriber: ...

    def beat_tracker(self) -> BeatTracker: ...


class ModelEngines:
    """Echte Modelle, gecacht pro Prozess (ein GPU-Worker nutzt sie seriell)."""

    def __init__(self, device: str = "auto") -> None:
        self._device_pref = device
        self._device: Any = None
        self._separators: dict[str, Separator] = {}
        self._transcribers: dict[str, Transcriber] = {}
        self._beats: BeatTracker | None = None

    @property
    def device(self) -> Any:
        if self._device is None:
            from .runtime import select_device

            self._device = select_device(self._device_pref)  # type: ignore[arg-type]
        return self._device

    def separator(self, name: str) -> Separator:
        if name not in self._separators:
            from .separation import create_separator

            self._separators[name] = create_separator(name, self.device)
        return self._separators[name]

    def transcriber(self, name: str) -> Transcriber:
        if name not in self._transcribers:
            from .transcription import create_transcriber

            self._transcribers[name] = create_transcriber(name, self.device)
        return self._transcribers[name]

    def beat_tracker(self) -> BeatTracker:
        if self._beats is None:
            from .rhythm import BeatThisTracker

            self._beats = BeatThisTracker(self.device)
        return self._beats


@dataclass
class Pipeline:
    engines: Engines
    on_event: Callable[[StageEvent], None] | None = None
    cancel: threading.Event | None = None
    log: Callable[[str], None] = field(default=lambda _msg: None)
    timings: dict[str, dict[str, float]] = field(default_factory=dict)

    def _emit(self, event: StageEvent) -> None:
        if self.on_event is not None:
            self.on_event(event)

    def _reporter(self, stage: str) -> Reporter:
        def on_progress(fraction: float, message: str | None) -> None:
            self._emit(StageEvent(stage, "progress", fraction, message))

        return Reporter(on_progress=on_progress, cancel=self.cancel, log=self.log)

    def run(self, project: Project, from_stage: str | None = None,
            only: list[str] | None = None) -> list[str]:
        """Führt alle nötigen Stufen aus. Gibt die tatsächlich ausgeführten Stufen zurück."""
        if from_stage is not None and from_stage not in STAGES:
            raise ValueError(f"Unbekannte Stufe: {from_stage}")
        pending = project.pending_stages(from_stage)
        if only is not None:
            unknown = set(only) - set(STAGES)
            if unknown:
                raise ValueError(f"Unbekannte Stufe: {', '.join(sorted(unknown))}")
            pending = [s for s in STAGES if s in only]
        executed: list[str] = []
        for stage in STAGES:
            if self.cancel is not None and self.cancel.is_set():
                raise CancelledError()
            if project.stage_hash(stage) is None:
                project.mark_skipped(stage)
                self._emit(StageEvent(stage, "skipped", 1.0))
                continue
            if stage not in pending:
                self._emit(StageEvent(stage, "cached", 1.0))
                continue
            missing = [title for title, path in _stage_inputs(project, stage)
                       if not path.exists()]
            if missing:
                raise PipelineError(
                    f"„{STAGE_TITLES[stage]}“ braucht zuerst: {', '.join(missing)}.")
            self._emit(StageEvent(stage, "start", 0.0))
            started = time.perf_counter()
            peak = _reset_peak_memory()
            getattr(self, f"_stage_{stage}")(project, self._reporter(stage))
            elapsed = time.perf_counter() - started
            self.timings[stage] = {"seconds": round(elapsed, 2),
                                   "vram_peak_mb": _peak_memory_mb() if peak else 0.0}
            project.mark_done(stage, elapsed)
            executed.append(stage)
            self._emit(StageEvent(stage, "done", 1.0))
        return executed

    # ---- Stufen ------------------------------------------------------------------------
    def _stage_trim(self, project: Project, reporter: Reporter) -> None:
        start, end = project.load().trim_range()
        audio.trim(project.work_wav, project.trimmed_wav, start, end)
        reporter.progress(1.0)

    def _stage_separate(self, project: Project, reporter: Reporter) -> None:
        manifest = project.load()
        mix, sr = audio.read_audio(project.trimmed_wav)
        stems = self.engines.separator(manifest.options.separator).separate(mix, sr, reporter)
        if "piano" not in stems:
            raise RuntimeError("Der Separator hat keinen Klavier-Stem geliefert.")
        project.stems_dir.mkdir(exist_ok=True)
        for name, data in stems.items():
            if name != "piano":
                audio.write_audio(project.stems_dir / f"{name}.wav", data, sr)
        audio.write_audio(project.piano_wav, stems["piano"], sr)

    def _stage_transcribe(self, project: Project, reporter: Reporter) -> None:
        manifest = project.load()
        transcriber = self.engines.transcriber(manifest.options.transcriber)
        mono = audio.load_mono(project.transcription_input(), transcriber.sample_rate)
        result = transcriber.transcribe(mono, reporter)
        result.save(project.raw_notes_json)
        write_raw_midi(project.raw_mid, result.notes, result.pedals)

    def _stage_rhythm(self, project: Project, reporter: Reporter) -> None:
        mix, sr = audio.read_audio(project.trimmed_wav)
        result = self.engines.beat_tracker().track(mix, sr, reporter)
        result.save(project.beats_json)

    def _stage_notate(self, project: Project, reporter: Reporter) -> None:
        notate_project(project)
        reporter.progress(1.0)


def notate_project(project: Project) -> dict[str, Any]:
    """Notationsstufe für ein Projekt (synchron, ohne GPU). Gibt die Kennwerte zurück."""
    from .notation.build_score import write_musicxml
    from .notation.notate import notate

    manifest = project.load()
    raw = RawTranscription.load(project.raw_notes_json)
    beats = BeatResult.load(project.beats_json)
    start, _end = manifest.trim_range()
    result = notate(raw.notes, raw.pedals, beats.beats, beats.downbeats, manifest.notation,
                    trim_start=start)
    write_musicxml(result.score, project.score_musicxml)
    write_score_midi(project.score_mid, result.events, result.pedals, result.layout, result.ts,
                     result.key, result.tempo_bpm, manifest.notation.title,
                     with_pedal=manifest.notation.pedal)
    info = {**result.info.__dict__, "key_name": result.key.german,
            "trim_start_s": round(start, 4)}
    payload = {"format": 1, "info": info, **result.playback}
    tmp = project.score_json.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload), encoding="utf-8")
    tmp.replace(project.score_json)
    return info


def _reset_peak_memory() -> bool:
    try:
        import torch
    except ImportError:  # pragma: no cover
        return False
    if torch.cuda.is_available():
        torch.cuda.reset_peak_memory_stats()
        return True
    return False


def _peak_memory_mb() -> float:
    import torch

    return round(torch.cuda.max_memory_allocated() / 2**20, 1)
