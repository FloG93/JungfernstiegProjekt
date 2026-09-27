"""Job-Queue: genau ein Worker-Thread für die GPU-Stufen, damit sich Modelle nicht um VRAM streiten.

Jobs sind abbrechbar (Cancel-Flag, zwischen und innerhalb der Stufen geprüft). Fehler landen
strukturiert und verständlich im Job-Status. Zustandsänderungen gehen an registrierte Listener
(WebSocket); Polling über ``get`` funktioniert immer.
"""

from __future__ import annotations

import logging
import queue
import threading
import time
import traceback
import uuid
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, Literal

from . import models
from . import project as projects
from .audio import AudioDecodeError
from .paths import FFmpegNotFoundError
from .pipeline import STAGE_WEIGHTS, Engines, Pipeline, PipelineError, StageEvent, notate_project
from .project import STAGES
from .runtime import CancelledError

log = logging.getLogger(__name__)

JobStatus = Literal["queued", "running", "done", "error", "cancelled"]
JobKind = Literal["pipeline", "models"]
MAX_KEPT_JOBS = 50


class JobConflictError(RuntimeError):
    """Für dieses Projekt läuft bereits ein Job."""


@dataclass
class Job:
    id: str
    kind: JobKind
    project_id: str | None = None
    from_stage: str | None = None
    status: JobStatus = "queued"
    stage: str | None = None
    stage_progress: float = 0.0
    progress: float = 0.0
    stages: dict[str, str] = field(default_factory=dict)
    message: str | None = None
    log: list[str] = field(default_factory=list)
    error: dict[str, str] | None = None
    created: float = field(default_factory=time.time)
    started: float | None = None
    finished: float | None = None
    cancel_event: threading.Event = field(default_factory=threading.Event, repr=False)
    _weights: dict[str, float] = field(default_factory=dict, repr=False)

    @property
    def active(self) -> bool:
        return self.status in ("queued", "running")

    def snapshot(self) -> dict[str, Any]:
        return {
            "id": self.id, "kind": self.kind, "project_id": self.project_id,
            "status": self.status, "stage": self.stage,
            "stage_progress": round(self.stage_progress, 3),
            "progress": round(self.progress, 3), "stages": dict(self.stages),
            "message": self.message, "log": self.log[-50:], "error": self.error,
            "created": self.created, "started": self.started, "finished": self.finished,
        }


def describe_error(exc: BaseException) -> dict[str, str]:
    """Übersetzt Ausnahmen in verständliche Meldungen mit Handlungshinweis."""
    from .runtime import is_oom

    if isinstance(exc, models.ModelMissingError):
        return {"code": "models_missing", "message": str(exc),
                "hint": "Im Einrichtungsdialog die Modelle herunterladen."}
    if isinstance(exc, FFmpegNotFoundError):
        return {"code": "ffmpeg_missing", "message": str(exc), "hint": ""}
    if isinstance(exc, AudioDecodeError):
        return {"code": "audio", "message": str(exc),
                "hint": "Eine andere Datei oder ein anderes Format versuchen."}
    if isinstance(exc, PipelineError):
        return {"code": "pipeline", "message": str(exc), "hint": ""}
    if isinstance(exc, MemoryError):
        return {"code": "ram", "message": "Der Arbeitsspeicher reicht nicht.",
                "hint": "Einen kürzeren Ausschnitt wählen."}
    if is_oom(exc):
        return {"code": "cuda_oom", "message": "Der Grafikspeicher (CUDA) reicht nicht.",
                "hint": "Ausschnitt kürzen oder in den Einstellungen den CPU-Modus wählen."}
    if isinstance(exc, models.ModelDownloadError):
        return {"code": "download", "message": str(exc),
                "hint": "Internetverbindung prüfen und erneut versuchen."}
    return {"code": "internal", "message": f"Unerwarteter Fehler: {type(exc).__name__}: {exc}",
            "hint": "Details stehen im Log."}


class JobManager:
    def __init__(self, engines_factory: Callable[[], Engines]) -> None:
        self._engines_factory = engines_factory
        self._engines: Engines | None = None
        self._queue: queue.Queue[Job | None] = queue.Queue()
        self._jobs: OrderedDict[str, Job] = OrderedDict()
        self._lock = threading.RLock()
        self._listeners: list[Callable[[dict[str, Any]], None]] = []
        self._worker = threading.Thread(target=self._run, name="pianoscribe-gpu-worker",
                                        daemon=True)
        self._worker.start()

    # ---- Listener ------------------------------------------------------------------------
    def subscribe(self, listener: Callable[[dict[str, Any]], None]) -> None:
        with self._lock:
            self._listeners.append(listener)

    def unsubscribe(self, listener: Callable[[dict[str, Any]], None]) -> None:
        with self._lock:
            if listener in self._listeners:
                self._listeners.remove(listener)

    def _publish(self, job: Job) -> None:
        snap = job.snapshot()
        with self._lock:
            listeners = list(self._listeners)
        for listener in listeners:
            try:
                listener(snap)
            except Exception:  # ein defekter Listener darf den Worker nicht stören
                log.exception("Listener fehlgeschlagen")

    # ---- Verwaltung ----------------------------------------------------------------------
    def _register(self, job: Job) -> Job:
        with self._lock:
            self._jobs[job.id] = job
            while len(self._jobs) > MAX_KEPT_JOBS:
                oldest = next(iter(self._jobs))
                if self._jobs[oldest].active:
                    break
                self._jobs.pop(oldest)
        return job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)

    def list(self) -> list[Job]:
        with self._lock:
            return list(self._jobs.values())

    def active_for_project(self, project_id: str) -> Job | None:
        with self._lock:
            for job in self._jobs.values():
                if job.project_id == project_id and job.active:
                    return job
        return None

    def submit_pipeline(self, project_id: str, from_stage: str | None = None) -> Job:
        """Stellt die Pipeline eines Projekts in die Warteschlange.

        Muss nur die Notationsstufe laufen, passiert das sofort und synchron (CPU, < 1 s).
        """
        project = projects.get(project_id)
        with self._lock:
            if self.active_for_project(project_id) is not None:
                raise JobConflictError("Für dieses Projekt läuft bereits eine Berechnung.")
            pending = project.pending_stages(from_stage)
            job = self._register(Job(id=uuid.uuid4().hex, kind="pipeline",
                                     project_id=project_id, from_stage=from_stage))
            job.stages = {s: ("pending" if s in pending else "cached") for s in STAGES}
            job._weights = _normalized_weights(pending)
        if pending == ["notate"] or not pending:
            self._execute(job, synchronous=True)
            return job
        self._queue.put(job)
        self._publish(job)
        return job

    def submit_models_download(self) -> Job:
        with self._lock:
            for job in self._jobs.values():
                if job.kind == "models" and job.active:
                    return job
            job = self._register(Job(id=uuid.uuid4().hex, kind="models"))
        self._queue.put(job)
        self._publish(job)
        return job

    def cancel(self, job_id: str) -> Job | None:
        job = self.get(job_id)
        if job is None:
            return None
        job.cancel_event.set()
        if job.status == "queued":
            job.status = "cancelled"
            job.finished = time.time()
            self._publish(job)
        return job

    def cancel_all(self) -> None:
        for job in self.list():
            if job.active:
                self.cancel(job.id)

    def shutdown(self, timeout: float = 10.0) -> None:
        self.cancel_all()
        self._queue.put(None)
        self._worker.join(timeout)

    # ---- Ausführung ----------------------------------------------------------------------
    def _run(self) -> None:
        while True:
            job = self._queue.get()
            if job is None:
                return
            if job.status == "cancelled":
                continue
            self._execute(job, synchronous=False)

    def _engines_instance(self) -> Engines:
        if self._engines is None:
            self._engines = self._engines_factory()
        return self._engines

    def _execute(self, job: Job, synchronous: bool) -> None:
        job.status = "running"
        job.started = time.time()
        self._publish(job)
        try:
            if job.kind == "models":
                self._run_models(job)
            elif synchronous:
                self._run_notate_only(job)
            else:
                self._run_pipeline(job)
            job.status = "done"
            job.progress = 1.0
        except CancelledError:
            job.status = "cancelled"
            job.message = "Abgebrochen."
        except models.DownloadCancelledError:
            job.status = "cancelled"
            job.message = "Download abgebrochen."
        except Exception as exc:
            job.status = "error"
            job.error = describe_error(exc)
            job.log.append(traceback.format_exc(limit=8))
            log.exception("Job %s fehlgeschlagen", job.id)
        finally:
            job.finished = time.time()
            if job.stage and job.stages.get(job.stage) == "running":
                job.stages[job.stage] = "error" if job.status == "error" else job.status
            self._publish(job)

    def _run_notate_only(self, job: Job) -> None:
        assert job.project_id is not None
        project = projects.get(job.project_id)
        with projects.project_lock(project.id):
            if job.stages.get("notate") == "pending":
                job.stage = "notate"
                job.stages["notate"] = "running"
                started = time.perf_counter()
                notate_project(project)
                project.mark_done("notate", time.perf_counter() - started)
                job.stages["notate"] = "done"

    def _run_pipeline(self, job: Job) -> None:
        assert job.project_id is not None
        project = projects.get(job.project_id)
        done_weight = 0.0

        def on_event(ev: StageEvent) -> None:
            nonlocal done_weight
            weight = job._weights.get(ev.stage, 0.0)
            if ev.status == "start":
                job.stage = ev.stage
                job.stage_progress = 0.0
                job.stages[ev.stage] = "running"
            elif ev.status == "progress":
                job.stage_progress = ev.progress
                if ev.message:
                    job.message = ev.message
            elif ev.status == "done":
                job.stage_progress = 1.0
                job.stages[ev.stage] = "done"
                done_weight += weight
            elif ev.status in ("cached", "skipped"):
                job.stages[ev.stage] = ev.status
            running = weight * job.stage_progress if job.stages.get(ev.stage) == "running" else 0
            job.progress = min(1.0, done_weight + running)
            self._publish(job)

        pipeline = Pipeline(self._engines_instance(), on_event=on_event, cancel=job.cancel_event,
                            log=job.log.append)
        pipeline.run(project, from_stage=job.from_stage)

    def _run_models(self, job: Job) -> None:
        missing = models.missing()
        total = sum(spec.size for spec in missing) or 1
        finished = 0

        def progress(spec: models.ModelSpec, done: int, size: int) -> None:
            job.stage = spec.key
            job.message = spec.title
            job.stage_progress = done / max(size, 1)
            job.progress = min(1.0, (finished + done) / total)
            self._publish(job)

        for spec in missing:
            job.stages[spec.key] = "running"

            def on_bytes(done: int, size: int, spec: models.ModelSpec = spec) -> None:
                progress(spec, done, size)

            models.download(spec, on_bytes, job.cancel_event)
            job.stages[spec.key] = "done"
            finished += spec.size


def _normalized_weights(pending: list[str]) -> dict[str, float]:
    total = sum(STAGE_WEIGHTS[s] for s in pending) or 1.0
    return {s: STAGE_WEIGHTS[s] / total for s in pending}
