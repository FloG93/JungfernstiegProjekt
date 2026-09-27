"""Tests für den Modell-Download (ohne Netz, mit httpx.MockTransport)."""

import dataclasses
import hashlib
import threading

import httpx
import pytest

from pianoscribe import models

PAYLOAD = b"weights" * 1000


def _spec(**changes) -> models.ModelSpec:
    base = models.ModelSpec(key="test", title="Testmodell", subdir="test", filename="w.bin",
                            url="https://example.invalid/w.bin",
                            sha256=hashlib.sha256(PAYLOAD).hexdigest(), size=len(PAYLOAD),
                            license="MIT")
    return dataclasses.replace(base, **changes)


def _client(status: int = 200, body: bytes = PAYLOAD) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(
        lambda request: httpx.Response(status, content=body)))


def test_download_verifies_and_installs():
    spec = _spec()
    seen = []
    path = models.download(spec, progress=lambda d, t: seen.append((d, t)), client=_client())
    assert path.read_bytes() == PAYLOAD
    assert models.is_installed(spec)
    assert seen[-1] == (len(PAYLOAD), len(PAYLOAD))
    assert not path.with_name(path.name + ".part").exists()


def test_checksum_mismatch_removes_partial():
    spec = _spec(sha256="0" * 64)
    with pytest.raises(models.ModelDownloadError, match="Prüfsumme"):
        models.download(spec, client=_client())
    assert not spec.path.exists()
    assert not spec.path.with_name(spec.path.name + ".part").exists()


def test_http_error_is_reported():
    with pytest.raises(models.ModelDownloadError, match="HTTP 404"):
        models.download(_spec(), client=_client(status=404))


def test_cancel_stops_download():
    cancel = threading.Event()
    cancel.set()
    with pytest.raises(models.DownloadCancelledError):
        models.download(_spec(), cancel=cancel, client=_client())
    assert not _spec().path.exists()


def test_require_and_status():
    with pytest.raises(models.ModelMissingError):
        models.require(models.BYTEDANCE)
    status = models.status()
    assert [s["key"] for s in status] == [m.key for m in models.CATALOG]
    assert not any(s["installed"] for s in status)
