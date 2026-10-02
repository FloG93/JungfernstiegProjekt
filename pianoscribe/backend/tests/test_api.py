"""API-Tests mit TestClient; die Modelle sind durch Fakes ersetzt."""

import threading
import time

import pytest
from fastapi.testclient import TestClient

from pianoscribe import models
from pianoscribe.api import AppConfig, create_app

from .conftest import FakeEngines, FakeSeparator, requires_ffmpeg

TOKEN = "test-token"
HEADERS = {"X-PianoScribe-Token": TOKEN}


class SlowSeparator(FakeSeparator):
    """Blockiert, bis der Test ihn freigibt (oder der Job abgebrochen wird)."""

    def __init__(self) -> None:
        super().__init__()
        self.release = threading.Event()
        self.entered = threading.Event()

    def separate(self, audio, sample_rate, reporter):
        self.entered.set()
        while not self.release.wait(0.02):
            reporter.check()
        return super().separate(audio, sample_rate, reporter)


def make_client(tmp_path, engines=None):
    engines = engines or FakeEngines()
    app = create_app(AppConfig(token=TOKEN, engines_factory=lambda: engines,
                               static_dir=tmp_path / "no-frontend",
                               allowed_hosts=["testserver", "127.0.0.1"]))
    return TestClient(app), engines


@pytest.fixture
def client(tmp_path):
    test_client, _engines = make_client(tmp_path)
    with test_client:
        yield test_client


def wait_for_job(client, job_id, timeout=20.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        job = client.get(f"/api/jobs/{job_id}", headers=HEADERS).json()
        if job["status"] not in ("queued", "running"):
            return job
        time.sleep(0.05)
    raise AssertionError("Job wurde nicht fertig")


def test_token_and_host_are_enforced(client):
    assert client.get("/api/health").status_code == 401
    assert client.get("/api/health", headers={"X-PianoScribe-Token": "falsch"}).status_code == 401
    assert client.get("/api/health", headers=HEADERS).status_code == 200
    assert client.get(f"/api/health?token={TOKEN}").status_code == 200
    assert client.get("/api/health", headers={**HEADERS, "Host": "evil.example"}).status_code == 400
    health = client.get("/api/health", headers=HEADERS).json()
    assert health["models"]["installed"] is False
    assert "cuda_available" in health["gpu"]


def test_frontend_placeholder_without_build(client):
    response = client.get("/")
    assert response.status_code == 200 and "npm run build" in response.text


@requires_ffmpeg
def test_create_run_and_download(client, tone_wav):
    created = client.post("/api/projects", json={"path": str(tone_wav)}, headers=HEADERS)
    assert created.status_code == 201, created.text
    project = created.json()
    pid = project["manifest"]["id"]
    assert project["pending"] == ["trim", "separate", "transcribe", "rhythm", "notate"]
    assert client.get("/api/projects", headers=HEADERS).json()[0]["id"] == pid
    assert len(client.get(f"/api/projects/{pid}/waveform", headers=HEADERS).json()["peaks"]) > 0

    job = client.post(f"/api/projects/{pid}/run", headers=HEADERS).json()
    assert job["status"] in ("queued", "running")
    job = wait_for_job(client, job["id"])
    assert job["status"] == "done", job
    assert job["progress"] == 1.0
    assert set(job["stages"].values()) == {"done"}

    xml = client.get(f"/api/projects/{pid}/score.musicxml", headers=HEADERS)
    assert xml.status_code == 200 and "<score-partwise" in xml.text
    for name in ("score.mid", "raw.mid", "score.json"):
        assert client.get(f"/api/projects/{pid}/{name}", headers=HEADERS).status_code == 200
    detail = client.get(f"/api/projects/{pid}", headers=HEADERS).json()
    assert detail["pending"] == [] and detail["has_score"] and detail["has_piano"]
    assert detail["score_info"]["key_name"] == "C-Dur"


@requires_ffmpeg
def test_audio_supports_range_requests(client, tone_wav):
    pid = client.post("/api/projects", json={"path": str(tone_wav)}, headers=HEADERS).json()[
        "manifest"]["id"]
    full = client.get(f"/api/projects/{pid}/audio/source?token={TOKEN}")
    assert full.status_code == 200
    part = client.get(f"/api/projects/{pid}/audio/source", headers={**HEADERS,
                                                                     "Range": "bytes=100-199"})
    assert part.status_code == 206
    assert part.headers["content-range"].startswith("bytes 100-199/")
    assert part.content == full.content[100:200]
    assert client.get(f"/api/projects/{pid}/audio/piano", headers=HEADERS).status_code == 404


@requires_ffmpeg
def test_notation_change_runs_synchronously(client, tone_wav):
    pid = client.post("/api/projects", json={"path": str(tone_wav)}, headers=HEADERS).json()[
        "manifest"]["id"]
    wait_for_job(client, client.post(f"/api/projects/{pid}/run", headers=HEADERS).json()["id"])
    patched = client.patch(f"/api/projects/{pid}", json={"notation": {"time_signature": "3/4"}},
                           headers=HEADERS)
    assert patched.status_code == 200 and patched.json()["pending"] == ["notate"]
    job = client.post(f"/api/projects/{pid}/run", headers=HEADERS).json()
    assert job["status"] == "done"
    assert job["stages"]["notate"] == "done" and job["stages"]["transcribe"] == "cached"
    info = client.get(f"/api/projects/{pid}", headers=HEADERS).json()["score_info"]
    assert info["time_signature"] == "3/4"


@requires_ffmpeg
def test_validation_errors_are_readable(client, tone_wav):
    pid = client.post("/api/projects", json={"path": str(tone_wav)}, headers=HEADERS).json()[
        "manifest"]["id"]
    bad = client.patch(f"/api/projects/{pid}", json={"notation": {"time_signature": "4/3"}},
                       headers=HEADERS)
    assert bad.status_code == 422 and "Taktart" in bad.json()["detail"]
    missing = client.post("/api/projects", json={"path": "/gibt/es/nicht.mp3"}, headers=HEADERS)
    assert missing.status_code == 400 and "nicht gefunden" in missing.json()["detail"]
    assert client.get("/api/projects/unknown", headers=HEADERS).status_code == 404


@requires_ffmpeg
def test_conflict_and_cancel_while_running(tmp_path, tone_wav):
    engines = FakeEngines()
    engines.sep = SlowSeparator()
    test_client, _ = make_client(tmp_path, engines)
    with test_client as client:
        pid = client.post("/api/projects", json={"path": str(tone_wav)}, headers=HEADERS).json()[
            "manifest"]["id"]
        job = client.post(f"/api/projects/{pid}/run", headers=HEADERS).json()
        assert engines.sep.entered.wait(5)
        again = client.post(f"/api/projects/{pid}/run", headers=HEADERS)
        assert again.status_code == 409
        trim = client.patch(f"/api/projects/{pid}", json={"trim": {"start_s": 1, "end_s": 3}},
                            headers=HEADERS)
        assert trim.status_code == 409
        notation = client.patch(f"/api/projects/{pid}", json={"notation": {"grid": "1/8"}},
                                headers=HEADERS)
        assert notation.status_code == 200  # Notationsparameter dürfen sich ändern
        assert client.delete(f"/api/projects/{pid}", headers=HEADERS).status_code == 409
        client.post(f"/api/jobs/{job['id']}/cancel", headers=HEADERS)
        final = wait_for_job(client, job["id"])
        assert final["status"] == "cancelled"
        assert final["stages"]["separate"] == "cancelled"
        assert client.delete(f"/api/projects/{pid}", headers=HEADERS).status_code == 204


@requires_ffmpeg
def test_upload_fallback(client, tone_wav):
    with open(tone_wav, "rb") as f:
        response = client.post("/api/projects/upload", files={"file": ("mein lied.wav", f,
                                                                       "audio/wav")},
                               headers=HEADERS)
    assert response.status_code == 201, response.text
    assert response.json()["manifest"]["name"] == "mein lied"
    bad = client.post("/api/projects/upload", files={"file": ("x.txt", b"abc", "text/plain")},
                      headers=HEADERS)
    assert bad.status_code == 400


@requires_ffmpeg
def test_websocket_pushes_job_updates(client, tone_wav):
    pid = client.post("/api/projects", json={"path": str(tone_wav)}, headers=HEADERS).json()[
        "manifest"]["id"]
    with client.websocket_connect(f"/api/ws?token={TOKEN}") as ws:
        job = client.post(f"/api/projects/{pid}/run", headers=HEADERS).json()
        statuses = []
        for _ in range(200):
            message = ws.receive_json()
            assert message["type"] == "job"
            if message["job"]["id"] == job["id"]:
                statuses.append(message["job"]["status"])
                if message["job"]["status"] == "done":
                    break
        assert statuses[-1] == "done" and "running" in statuses


def test_websocket_rejects_missing_token(client):
    from starlette.websockets import WebSocketDisconnect

    with pytest.raises(WebSocketDisconnect), client.websocket_connect("/api/ws") as ws:
        ws.receive_json()


def test_models_download_job(client, monkeypatch):
    def fake_download(spec, progress=None, cancel=None, client=None):
        spec.path.parent.mkdir(parents=True, exist_ok=True)
        spec.path.write_bytes(b"x" * spec.size)
        if progress:
            progress(spec.size, spec.size)
        return spec.path

    monkeypatch.setattr(models, "download", fake_download)
    job = client.post("/api/models/download", headers=HEADERS).json()
    job = wait_for_job(client, job["id"])
    assert job["status"] == "done"
    assert all(m["installed"] for m in client.get("/api/models", headers=HEADERS).json())
    assert client.get("/api/health", headers=HEADERS).json()["models"]["installed"]


def test_settings_roundtrip(client):
    assert client.get("/api/settings", headers=HEADERS).json()["device"] == "auto"
    updated = client.patch("/api/settings", json={"device": "cpu"}, headers=HEADERS).json()
    assert updated["device"] == "cpu"
    assert client.patch("/api/settings", json={"device": "tpu"}, headers=HEADERS).status_code == 422
