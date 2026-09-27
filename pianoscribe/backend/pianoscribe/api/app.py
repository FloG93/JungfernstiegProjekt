"""App-Fabrik: Middleware, Routen, WebSocket und Auslieferung des Frontends."""

from __future__ import annotations

import asyncio
import secrets
from collections.abc import Callable
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware

from ..jobs import JobManager
from ..paths import frontend_dist
from ..pipeline import Engines
from . import routes

TOKEN_HEADER = "X-PianoScribe-Token"


@dataclass
class AppConfig:
    """Konfiguration der App. ``token=None`` schaltet die Token-Prüfung ab (Entwicklung)."""

    token: str | None = field(default_factory=lambda: secrets.token_urlsafe(24))
    engines_factory: Callable[[], Engines] | None = None
    static_dir: Path | None = None
    allowed_hosts: list[str] = field(default_factory=lambda: ["127.0.0.1", "localhost"])


def _default_engines() -> Engines:
    from .. import settings
    from ..pipeline import ModelEngines

    return ModelEngines(settings.load().device)


def create_app(config: AppConfig | None = None) -> FastAPI:
    config = config or AppConfig()
    jobs = JobManager(config.engines_factory or _default_engines)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> Any:
        yield
        jobs.shutdown()

    app = FastAPI(title="PianoScribe", version=_version(), lifespan=lifespan,
                  docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url=None)
    app.state.config = config
    app.state.jobs = jobs
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=config.allowed_hosts)

    @app.middleware("http")
    async def check_token(request: Request, call_next: Callable[[Request], Any]) -> Response:
        path = request.url.path
        if config.token and path.startswith("/api") and not path.startswith("/api/docs") \
                and path != "/api/openapi.json":
            supplied = request.headers.get(TOKEN_HEADER) or request.query_params.get("token")
            if not supplied or not secrets.compare_digest(supplied, config.token):
                return JSONResponse({"detail": "Nicht autorisiert."}, status_code=401)
        response: Response = await call_next(request)
        return response

    app.include_router(routes.router, prefix="/api")

    @app.websocket("/api/ws")
    async def ws_endpoint(websocket: WebSocket) -> None:
        if config.token and not secrets.compare_digest(
                websocket.query_params.get("token", ""), config.token):
            await websocket.close(code=4401)
            return
        await websocket.accept()
        loop = asyncio.get_running_loop()
        inbox: asyncio.Queue[dict[str, Any]] = asyncio.Queue()

        def listener(snapshot: dict[str, Any]) -> None:
            loop.call_soon_threadsafe(inbox.put_nowait, snapshot)

        jobs.subscribe(listener)
        try:
            for job in jobs.list():
                if job.active:
                    await websocket.send_json({"type": "job", "job": job.snapshot()})
            receiver = asyncio.ensure_future(websocket.receive_text())
            while True:
                getter = asyncio.ensure_future(inbox.get())
                done, _ = await asyncio.wait({getter, receiver},
                                             return_when=asyncio.FIRST_COMPLETED)
                if receiver in done:  # Client hat geschlossen oder etwas gesendet
                    getter.cancel()
                    receiver.result()
                    receiver = asyncio.ensure_future(websocket.receive_text())
                    continue
                await websocket.send_json({"type": "job", "job": getter.result()})
        except (WebSocketDisconnect, RuntimeError):
            pass
        finally:
            jobs.unsubscribe(listener)

    static_dir = config.static_dir or frontend_dist()
    if (static_dir / "index.html").exists():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
    else:
        @app.get("/", response_class=HTMLResponse, include_in_schema=False)
        def placeholder() -> str:
            return ("<!doctype html><meta charset=utf-8><title>PianoScribe</title>"
                    "<p>Das Frontend ist nicht gebaut. Im Ordner <code>frontend</code> "
                    "<code>npm run build</code> ausführen oder <code>npm run dev</code> nutzen.")
    return app


def _version() -> str:
    from .. import __version__

    return __version__
