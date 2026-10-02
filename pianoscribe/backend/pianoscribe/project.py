"""Projektordner, Manifest (``project.json``) und Stufen-Cache.

Jede Pipeline-Stufe merkt sich einen Hash ihrer Eingaben und Parameter. Ändert sich nur etwas
an den Notationsparametern, läuft nur die Notationsstufe neu.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import threading
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from . import audio
from .paths import projects_dir

STAGES: tuple[str, ...] = ("trim", "separate", "transcribe", "rhythm", "notate")
StageName = Literal["trim", "separate", "transcribe", "rhythm", "notate"]

# Bei inhaltlichen Änderungen einer Stufe erhöhen, damit Caches ungültig werden.
STAGE_VERSIONS: dict[str, int] = {
    "trim": 1, "separate": 1, "transcribe": 1, "rhythm": 1, "notate": 1,
}

GridMode = Literal["auto", "1/8", "1/16", "1/16+triplets"]


class ProjectError(RuntimeError):
    """Allgemeiner Projektfehler (z. B. ungültige Parameter)."""


class ProjectNotFoundError(ProjectError):
    pass


class SourceInfo(BaseModel):
    file: str
    original_name: str
    duration_s: float
    sha256: str


class Trim(BaseModel):
    start_s: float = Field(ge=0)
    end_s: float = Field(gt=0)


class Options(BaseModel):
    separate: bool = True
    separator: str = "htdemucs_6s"
    transcriber: str = "bytedance"


class HandSplit(BaseModel):
    mode: Literal["auto", "fixed"] = "auto"
    pitch: int = Field(default=60, ge=21, le=108)


class NotationParams(BaseModel):
    tempo_bpm: float | None = Field(default=None, gt=20, lt=400)
    time_signature: str = "4/4"
    first_downbeat_s: float | None = Field(default=None, ge=0)
    key: str | None = None
    grid: GridMode = "auto"
    hand_split: HandSplit = Field(default_factory=HandSplit)
    min_note_ms: int = Field(default=50, ge=0, le=2000)
    min_velocity: int = Field(default=20, ge=0, le=127)
    transpose: int = Field(default=0, ge=-24, le=24)
    pedal: bool = True
    title: str = ""
    composer: str = ""

    @field_validator("time_signature")
    @classmethod
    def _check_time_signature(cls, value: str) -> str:
        from .notation.meter import parse_time_signature

        parse_time_signature(value)
        return value

    @field_validator("key")
    @classmethod
    def _check_key(cls, value: str | None) -> str | None:
        if value in (None, ""):
            return None
        from .notation.keys import parse_key

        parse_key(value)
        return value


class StageState(BaseModel):
    hash: str | None = None
    done: bool = False
    skipped: bool = False
    finished: str | None = None
    duration_s: float | None = None


class Manifest(BaseModel):
    id: str
    name: str
    created: str
    source: SourceInfo
    trim: Trim | None = None
    options: Options = Field(default_factory=Options)
    notation: NotationParams = Field(default_factory=NotationParams)
    stages: dict[str, StageState] = Field(
        default_factory=lambda: {name: StageState() for name in STAGES})

    def trim_range(self) -> tuple[float, float]:
        if self.trim is None:
            return 0.0, self.source.duration_s
        return self.trim.start_s, min(self.trim.end_s, self.source.duration_s)


# --------------------------------------------------------------------------------------------
# Sperren: ein Lock pro Projekt schützt Lesen-Ändern-Schreiben des Manifests.
# --------------------------------------------------------------------------------------------
_locks: dict[str, threading.RLock] = {}
_locks_guard = threading.Lock()


def project_lock(project_id: str) -> threading.RLock:
    with _locks_guard:
        return _locks.setdefault(project_id, threading.RLock())


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


class Project:
    """Zugriff auf einen Projektordner."""

    MANIFEST = "project.json"

    def __init__(self, root: Path) -> None:
        self.root = root
        self.id = root.name

    # ---- Dateien -----------------------------------------------------------------------
    @property
    def manifest_path(self) -> Path:
        return self.root / self.MANIFEST

    @property
    def source_path(self) -> Path:
        return self.root / self.load().source.file

    @property
    def work_wav(self) -> Path:
        return self.root / "work.wav"

    @property
    def trimmed_wav(self) -> Path:
        return self.root / "trimmed.wav"

    @property
    def stems_dir(self) -> Path:
        return self.root / "stems"

    @property
    def piano_wav(self) -> Path:
        return self.stems_dir / "piano.wav"

    @property
    def raw_notes_json(self) -> Path:
        return self.root / "raw_notes.json"

    @property
    def raw_mid(self) -> Path:
        return self.root / "raw.mid"

    @property
    def beats_json(self) -> Path:
        return self.root / "beats.json"

    @property
    def score_musicxml(self) -> Path:
        return self.root / "score.musicxml"

    @property
    def score_mid(self) -> Path:
        return self.root / "score.mid"

    @property
    def score_json(self) -> Path:
        return self.root / "score.json"

    @property
    def waveform_json(self) -> Path:
        return self.root / "waveform.json"

    def transcription_input(self) -> Path:
        """Audio, das transkribiert wird: Klavier-Stem oder der getrimmte Mix."""
        return self.piano_wav if self.load().options.separate else self.trimmed_wav

    def stage_outputs(self, stage: str) -> list[Path]:
        return {
            "trim": [self.trimmed_wav],
            "separate": [self.piano_wav],
            "transcribe": [self.raw_notes_json, self.raw_mid],
            "rhythm": [self.beats_json],
            "notate": [self.score_musicxml, self.score_mid, self.score_json],
        }[stage]

    # ---- Manifest ----------------------------------------------------------------------
    def load(self) -> Manifest:
        try:
            data = json.loads(self.manifest_path.read_text(encoding="utf-8"))
        except FileNotFoundError as exc:
            raise ProjectNotFoundError(self.id) from exc
        return Manifest.model_validate(data)

    def save(self, manifest: Manifest) -> None:
        tmp = self.manifest_path.with_suffix(".json.tmp")
        tmp.write_text(manifest.model_dump_json(indent=2), encoding="utf-8")
        tmp.replace(self.manifest_path)

    @contextmanager
    def edit(self) -> Iterator[Manifest]:
        """Lesen, ändern, atomar speichern – unter dem Projekt-Lock."""
        with project_lock(self.id):
            manifest = self.load()
            yield manifest
            self.save(manifest)

    def update(self, changes: dict[str, Any]) -> Manifest:
        """Übernimmt Änderungen an ``name``, ``trim``, ``options`` und ``notation``.

        Verschachtelte Objekte werden zusammengeführt (PATCH-Semantik). Ungültige Werte
        lösen eine ``ProjectError`` aus, ohne etwas zu speichern.
        """
        allowed = {"name", "trim", "options", "notation"}
        unknown = set(changes) - allowed
        if unknown:
            raise ProjectError(f"Unbekannte Felder: {', '.join(sorted(unknown))}")
        with project_lock(self.id):
            current = self.load().model_dump()
            merged = _deep_merge(current, changes)
            try:
                manifest = Manifest.model_validate(merged)
            except ValueError as exc:
                raise ProjectError(str(exc)) from exc
            if manifest.trim is not None:
                start, end = manifest.trim.start_s, manifest.trim.end_s
                if end <= start + 0.5:
                    raise ProjectError("Der Ausschnitt muss mindestens 0,5 s lang sein.")
                if start >= manifest.source.duration_s:
                    raise ProjectError("Der Ausschnitt beginnt nach dem Ende der Datei.")
            self.save(manifest)
            return manifest

    # ---- Stufen-Cache ------------------------------------------------------------------
    def stage_inputs(self, stage: str, manifest: Manifest | None = None) -> dict[str, Any] | None:
        """Eingaben, die den Hash einer Stufe bestimmen. ``None`` = Stufe entfällt."""
        m = manifest or self.load()
        start, end = m.trim_range()
        trim_hash = _hash("trim", {"source": m.source.sha256, "start": round(start, 3),
                                   "end": round(end, 3)})
        if stage == "trim":
            return {"source": m.source.sha256, "start": round(start, 3), "end": round(end, 3)}
        if stage == "separate":
            if not m.options.separate:
                return None
            return {"trim": trim_hash, "separator": m.options.separator}
        if stage == "rhythm":
            return {"trim": trim_hash}
        sep_inputs = self.stage_inputs("separate", m)
        audio_hash = _hash("separate", sep_inputs) if sep_inputs is not None else trim_hash
        transcribe_inputs = {"audio": audio_hash, "separate": m.options.separate,
                             "transcriber": m.options.transcriber}
        if stage == "transcribe":
            return transcribe_inputs
        if stage == "notate":
            return {
                "transcribe": _hash("transcribe", transcribe_inputs),
                "rhythm": _hash("rhythm", {"trim": trim_hash}),
                "trim_start": round(start, 3),
                "notation": m.notation.model_dump(mode="json"),
            }
        raise ProjectError(f"Unbekannte Stufe: {stage}")

    def stage_hash(self, stage: str, manifest: Manifest | None = None) -> str | None:
        inputs = self.stage_inputs(stage, manifest)
        return None if inputs is None else _hash(stage, inputs)

    def is_current(self, stage: str, manifest: Manifest | None = None) -> bool:
        m = manifest or self.load()
        expected = self.stage_hash(stage, m)
        if expected is None:
            return True  # Stufe entfällt
        state = m.stages.get(stage, StageState())
        return (state.done and state.hash == expected
                and all(p.exists() for p in self.stage_outputs(stage)))

    def pending_stages(self, from_stage: str | None = None) -> list[str]:
        """Stufen, die (neu) laufen müssen, in Ausführungsreihenfolge."""
        m = self.load()
        forced = False
        pending: list[str] = []
        for stage in STAGES:
            if from_stage is not None and stage == from_stage:
                forced = True
            if self.stage_hash(stage, m) is None:
                continue
            if forced or not self.is_current(stage, m):
                pending.append(stage)
        return pending

    def mark_done(self, stage: str, duration_s: float) -> None:
        with self.edit() as m:
            m.stages[stage] = StageState(hash=self.stage_hash(stage, m), done=True,
                                         finished=_now(), duration_s=round(duration_s, 3))

    def mark_skipped(self, stage: str) -> None:
        with self.edit() as m:
            m.stages[stage] = StageState(skipped=True)


def _hash(stage: str, inputs: dict[str, Any] | None) -> str:
    payload = {"stage": stage, "version": STAGE_VERSIONS[stage], "inputs": inputs}
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:16]


def _deep_merge(base: dict[str, Any], changes: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for key, value in changes.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge(out[key], value)
        else:
            out[key] = value
    return out


# --------------------------------------------------------------------------------------------
# Projektverwaltung
# --------------------------------------------------------------------------------------------
def root_dir() -> Path:
    path = projects_dir()
    path.mkdir(parents=True, exist_ok=True)
    return path


def get(project_id: str) -> Project:
    if not project_id or any(c in project_id for c in "/\\.") or len(project_id) > 64:
        raise ProjectNotFoundError(project_id)
    project = Project(root_dir() / project_id)
    if not project.manifest_path.exists():
        raise ProjectNotFoundError(project_id)
    return project


def list_projects() -> list[Manifest]:
    manifests: list[Manifest] = []
    for child in root_dir().iterdir():
        if (child / Project.MANIFEST).exists():
            try:
                manifests.append(Project(child).load())
            except (ValueError, OSError):
                continue
    manifests.sort(key=lambda m: m.created, reverse=True)
    return manifests


def create(source: Path, name: str | None = None) -> Project:
    """Legt ein Projekt an: Datei kopieren, dekodieren, Wellenform-Peaks berechnen."""
    source = Path(source)
    if not source.is_file():
        raise ProjectError(f"Datei nicht gefunden: {source}")
    ext = source.suffix.lower()
    if ext not in audio.SUPPORTED_EXTENSIONS:
        raise ProjectError(f"Nicht unterstütztes Format: {ext or 'ohne Endung'}")
    project_id = uuid.uuid4().hex
    root = root_dir() / project_id
    root.mkdir(parents=True)
    try:
        copy = root / f"source{ext}"
        shutil.copyfile(source, copy)
        project = Project(root)
        duration = audio.decode_to_wav(copy, project.work_wav)
        project.waveform_json.write_text(json.dumps(audio.compute_peaks(project.work_wav)),
                                         encoding="utf-8")
        manifest = Manifest(
            id=project_id,
            name=name or source.stem,
            created=_now(),
            source=SourceInfo(file=copy.name, original_name=source.name,
                              duration_s=round(duration, 3), sha256=_sha256_file(copy)),
            notation=NotationParams(title=name or source.stem),
        )
        project.save(manifest)
        return project
    except BaseException:
        shutil.rmtree(root, ignore_errors=True)
        raise


def delete(project_id: str) -> None:
    project = get(project_id)
    with project_lock(project_id):
        shutil.rmtree(project.root)
