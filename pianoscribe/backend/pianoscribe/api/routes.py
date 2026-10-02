"""Routen der HTTP-API (Abschnitt 6 im Plan)."""

from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path
from typing import Annotated, Any, Literal

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel

from .. import __version__, models, settings
from .. import project as projects
from ..audio import SUPPORTED_EXTENSIONS, AudioDecodeError
from ..jobs import JobConflictError, JobManager
from ..paths import FFmpegNotFoundError, ffmpeg_exe
from ..project import STAGES, Project

router = APIRouter()


def _jobs(request: Request) -> JobManager:
    manager: JobManager = request.app.state.jobs
    return manager


def _project(project_id: str) -> Project:
    try:
        return projects.get(project_id)
    except projects.ProjectNotFoundError as exc:
        raise HTTPException(404, "Projekt nicht gefunden.") from exc


def _project_payload(project: Project) -> dict[str, Any]:
    manifest = project.load()
    info = None
    if project.score_json.exists():
        try:
            info = json.loads(project.score_json.read_text(encoding="utf-8")).get("info")
        except (OSError, ValueError):
            info = None
    return {
        "manifest": manifest.model_dump(mode="json"),
        "pending": project.pending_stages(),
        "has_score": project.score_musicxml.exists(),
        "has_piano": project.piano_wav.exists(),
        "score_info": info,
    }


# ---- System -------------------------------------------------------------------------------
@router.get("/health")
def health() -> dict[str, Any]:
    from ..runtime import gpu_info

    try:
        ffmpeg_ok = bool(ffmpeg_exe())
    except FFmpegNotFoundError:
        ffmpeg_ok = False
    missing = [m.key for m in models.missing()]
    return {"status": "ok", "version": __version__, "gpu": gpu_info(), "ffmpeg": ffmpeg_ok,
            "models": {"installed": not missing, "missing": missing},
            "settings": settings.load().model_dump()}


@router.get("/models")
def model_status() -> list[dict[str, Any]]:
    return models.status()


@router.post("/models/download")
def download_models(request: Request) -> dict[str, Any]:
    return _jobs(request).submit_models_download().snapshot()


class SettingsPatch(BaseModel):
    device: Literal["auto", "cuda", "cpu"] | None = None
    setup_done: bool | None = None


@router.get("/settings")
def get_settings() -> dict[str, Any]:
    return settings.load().model_dump()


@router.patch("/settings")
def patch_settings(patch: SettingsPatch) -> dict[str, Any]:
    current = settings.load()
    updated = current.model_copy(update=patch.model_dump(exclude_none=True))
    settings.save(updated)
    return updated.model_dump()


# ---- Projekte -----------------------------------------------------------------------------
@router.get("/projects")
def list_projects() -> list[dict[str, Any]]:
    out = []
    for m in projects.list_projects():
        start, end = m.trim_range()
        out.append({"id": m.id, "name": m.name, "created": m.created,
                    "source": m.source.original_name, "duration_s": m.source.duration_s,
                    "trim": {"start_s": start, "end_s": end},
                    "has_score": (projects.root_dir() / m.id / "score.musicxml").exists()})
    return out


class CreateProject(BaseModel):
    path: str
    name: str | None = None


def _create(path: Path, name: str | None) -> dict[str, Any]:
    try:
        project = projects.create(path, name=name)
    except projects.ProjectError as exc:
        raise HTTPException(400, str(exc)) from exc
    except (AudioDecodeError, FFmpegNotFoundError) as exc:
        raise HTTPException(422, str(exc)) from exc
    return _project_payload(project)


@router.post("/projects", status_code=201)
def create_project(body: CreateProject) -> dict[str, Any]:
    return _create(Path(body.path), body.name)


@router.post("/projects/upload", status_code=201)
def upload_project(file: Annotated[UploadFile, File()]) -> dict[str, Any]:
    """Browser-Fallback: Datei hochladen statt nativen Dateidialog zu verwenden."""
    name = Path(file.filename or "upload").name
    suffix = Path(name).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(400, f"Nicht unterstütztes Format: {suffix or 'ohne Endung'}")
    with tempfile.TemporaryDirectory() as tmp:
        target = Path(tmp) / name
        with open(target, "wb") as out:
            shutil.copyfileobj(file.file, out)
        return _create(target, Path(name).stem)


@router.get("/projects/{project_id}")
def get_project(project_id: str) -> dict[str, Any]:
    return _project_payload(_project(project_id))


@router.patch("/projects/{project_id}")
def patch_project(project_id: str, changes: dict[str, Any], request: Request) -> dict[str, Any]:
    project = _project(project_id)
    active = _jobs(request).active_for_project(project_id)
    if active is not None and ({"trim", "options"} & set(changes)):
        raise HTTPException(409, "Während der Berechnung lassen sich Ausschnitt und Optionen "
                                 "nicht ändern.")
    try:
        project.update(changes)
    except projects.ProjectError as exc:
        raise HTTPException(422, str(exc)) from exc
    return _project_payload(project)


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: str, request: Request) -> Response:
    _project(project_id)
    if _jobs(request).active_for_project(project_id) is not None:
        raise HTTPException(409, "Das Projekt wird gerade berechnet.")
    projects.delete(project_id)
    return Response(status_code=204)


AUDIO_FILES = {"source": "work.wav", "trimmed": "trimmed.wav", "piano": "stems/piano.wav"}


@router.get("/projects/{project_id}/audio/{kind}")
def get_audio(project_id: str, kind: str) -> FileResponse:
    """Audio mit Range-Requests (wavesurfer, Player). ``source`` ist die dekodierte Fassung,
    damit Positionen sampelgenau stimmen (MP3-Suche im Browser ist ungenau)."""
    project = _project(project_id)
    if kind not in AUDIO_FILES:
        raise HTTPException(404, "Unbekannte Audiospur.")
    path = project.root / AUDIO_FILES[kind]
    if not path.exists():
        raise HTTPException(404, "Diese Audiospur gibt es (noch) nicht.")
    return FileResponse(path, media_type="audio/wav")


@router.get("/projects/{project_id}/waveform")
def get_waveform(project_id: str) -> FileResponse:
    return FileResponse(_project(project_id).waveform_json, media_type="application/json")


DOWNLOADS = {
    "score.musicxml": ("score.musicxml", "application/vnd.recordare.musicxml+xml"),
    "score.mid": ("score.mid", "audio/midi"),
    "raw.mid": ("raw.mid", "audio/midi"),
    "score.json": ("score.json", "application/json"),
    "beats.json": ("beats.json", "application/json"),
}


@router.get("/projects/{project_id}/{filename}")
def get_output(project_id: str, filename: str) -> FileResponse:
    if filename not in DOWNLOADS:
        raise HTTPException(404, "Unbekannte Datei.")
    project = _project(project_id)
    name, media_type = DOWNLOADS[filename]
    path = project.root / name
    if not path.exists():
        raise HTTPException(404, "Noch nicht berechnet.")
    return FileResponse(path, media_type=media_type)


class RunRequest(BaseModel):
    from_stage: Literal["trim", "separate", "transcribe", "rhythm", "notate"] | None = None


@router.post("/projects/{project_id}/run", status_code=202)
def run_pipeline(project_id: str, request: Request,
                 body: RunRequest | None = None) -> dict[str, Any]:
    _project(project_id)
    from_stage = body.from_stage if body else None
    if from_stage is not None and from_stage not in STAGES:
        raise HTTPException(422, "Unbekannte Stufe.")
    try:
        job = _jobs(request).submit_pipeline(project_id, from_stage)
    except JobConflictError as exc:
        raise HTTPException(409, str(exc)) from exc
    return job.snapshot()


# ---- Jobs -----------------------------------------------------------------------------------
@router.get("/jobs")
def list_jobs(request: Request) -> list[dict[str, Any]]:
    return [job.snapshot() for job in _jobs(request).list()]


@router.get("/jobs/{job_id}")
def get_job(job_id: str, request: Request) -> dict[str, Any]:
    job = _jobs(request).get(job_id)
    if job is None:
        raise HTTPException(404, "Job nicht gefunden.")
    return job.snapshot()


@router.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str, request: Request) -> JSONResponse:
    job = _jobs(request).cancel(job_id)
    if job is None:
        raise HTTPException(404, "Job nicht gefunden.")
    return JSONResponse(job.snapshot())
