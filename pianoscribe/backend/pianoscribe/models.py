"""Modellgewichte: Katalog, Status und kontrollierter Download.

Das ist der einzige Ort, an dem die App ins Netz geht. Dateien landen unter
``<data_dir>/models/<unterordner>/`` und werden per SHA-256 geprüft.
"""

from __future__ import annotations

import hashlib
import threading
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx

from .paths import models_dir

ProgressFn = Callable[[int, int], None]  # (geladene Bytes, Gesamtbytes)


class ModelDownloadError(RuntimeError):
    pass


class ModelMissingError(RuntimeError):
    """Ein benötigtes Modell ist noch nicht heruntergeladen."""


class DownloadCancelledError(RuntimeError):
    pass


@dataclass(frozen=True)
class ModelSpec:
    key: str
    title: str
    subdir: str
    filename: str
    url: str
    sha256: str
    size: int
    license: str

    @property
    def path(self) -> Path:
        return models_dir() / self.subdir / self.filename


DEMUCS = ModelSpec(
    key="demucs_htdemucs_6s",
    title="Demucs htdemucs_6s (Klavier isolieren)",
    subdir="demucs",
    filename="5c90dfd2-34c22ccb.th",
    url="https://dl.fbaipublicfiles.com/demucs/hybrid_transformer/5c90dfd2-34c22ccb.th",
    sha256="34c22ccb381c6f9fdbf324f04e1e2fe21aaaf293f5ded163a162697ff9a02ddd",
    size=54_996_327,
    license="MIT (Meta)",
)
BYTEDANCE = ModelSpec(
    key="bytedance_piano",
    title="ByteDance Piano Transcription (Noten erkennen)",
    subdir="bytedance",
    filename="note_F1=0.9677_pedal_F1=0.9186.pth",
    url="https://zenodo.org/record/4034264/files/CRNN_note_F1%3D0.9677_pedal_F1%3D0.9186.pth?download=1",
    sha256="c3fa9730725bf4a762f1c14bc80cd5986eacda01b026f5a4a2525cd607876141",
    size=171_966_578,
    license="MIT (ByteDance / Qiuqiang Kong)",
)
BEAT_THIS = ModelSpec(
    key="beat_this_final0",
    title="beat_this final0 (Takt und Tempo)",
    subdir="beat_this",
    filename="final0.ckpt",
    url="https://cloud.cp.jku.at/public.php/dav/files/7ik4RrBKTS273gp/final0.ckpt",
    sha256="8c328b45f59d8dd3dff219253ff6a8d6482be57d0133a29140e2febbf8eb8331",
    size=81_058_141,
    license="MIT (CPJKU)",
)
CATALOG: tuple[ModelSpec, ...] = (DEMUCS, BYTEDANCE, BEAT_THIS)

# Bag-Definition für demucs.pretrained.get_model(repo=...), entspricht remote/htdemucs_6s.yaml.
_DEMUCS_BAG = {"htdemucs_6s.yaml": "models: ['5c90dfd2']\n"}

_download_lock = threading.Lock()


def is_installed(spec: ModelSpec) -> bool:
    path = spec.path
    return path.is_file() and path.stat().st_size == spec.size


def status() -> list[dict[str, Any]]:
    return [
        {"key": s.key, "title": s.title, "installed": is_installed(s), "size": s.size,
         "path": str(s.path), "license": s.license}
        for s in CATALOG
    ]


def missing() -> list[ModelSpec]:
    return [s for s in CATALOG if not is_installed(s)]


def require(spec: ModelSpec) -> Path:
    if not is_installed(spec):
        raise ModelMissingError(
            f"Das Modell „{spec.title}“ fehlt. Bitte im Einrichtungsdialog herunterladen "
            f"oder 'pianoscribe models download' ausführen."
        )
    return spec.path


def demucs_repo() -> Path:
    """Lokaler Demucs-Modellordner mit Bag-Definition (für ``get_model(repo=...)``)."""
    require(DEMUCS)
    repo = DEMUCS.path.parent
    for name, content in _DEMUCS_BAG.items():
        target = repo / name
        if not target.exists() or target.read_text() != content:
            target.write_text(content)
    return repo


def download(spec: ModelSpec, progress: ProgressFn | None = None,
             cancel: threading.Event | None = None, client: httpx.Client | None = None) -> Path:
    """Lädt ein Modell nach ``spec.path`` (über eine .part-Datei, mit SHA-256-Prüfung)."""
    if is_installed(spec):
        return spec.path
    target = spec.path
    target.parent.mkdir(parents=True, exist_ok=True)
    part = target.with_name(target.name + ".part")
    digest = hashlib.sha256()
    loaded = 0
    own_client = client is None
    http = client or httpx.Client(follow_redirects=True,
                                  timeout=httpx.Timeout(60.0, connect=20.0))
    try:
        with http.stream("GET", spec.url) as response:
            if response.status_code != 200:
                raise ModelDownloadError(
                    f"Download von {spec.title} fehlgeschlagen (HTTP {response.status_code}).")
            total = int(response.headers.get("content-length") or spec.size)
            with open(part, "wb") as f:
                for chunk in response.iter_bytes(chunk_size=1 << 20):
                    if cancel is not None and cancel.is_set():
                        raise DownloadCancelledError("Download abgebrochen.")
                    f.write(chunk)
                    digest.update(chunk)
                    loaded += len(chunk)
                    if progress is not None:
                        progress(loaded, total)
    except httpx.HTTPError as exc:
        part.unlink(missing_ok=True)
        raise ModelDownloadError(
            f"Download von {spec.title} fehlgeschlagen: {exc}. Internetverbindung prüfen.") from exc
    except BaseException:
        part.unlink(missing_ok=True)
        raise
    finally:
        if own_client:
            http.close()
    if digest.hexdigest() != spec.sha256:
        part.unlink(missing_ok=True)
        raise ModelDownloadError(f"Prüfsumme von {spec.title} stimmt nicht – bitte erneut laden.")
    part.replace(target)
    return target


def download_missing(progress: Callable[[ModelSpec, int, int], None] | None = None,
                     cancel: threading.Event | None = None) -> list[Path]:
    """Lädt alle fehlenden Modelle nacheinander."""
    with _download_lock:
        paths = []
        for spec in missing():
            def report(done: int, total: int, spec: ModelSpec = spec) -> None:
                if progress is not None:
                    progress(spec, done, total)

            paths.append(download(spec, report, cancel))
        return paths
