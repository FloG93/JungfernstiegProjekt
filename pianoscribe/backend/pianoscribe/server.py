"""uvicorn-Start: als eigenständiger Server (Entwicklung) oder im Hintergrund-Thread (App)."""

from __future__ import annotations

import logging
import socket
import threading
import time
from dataclasses import dataclass

import uvicorn
from fastapi import FastAPI

from .api import AppConfig, create_app

log = logging.getLogger(__name__)


def free_port(host: str = "127.0.0.1") -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind((host, 0))
        return int(sock.getsockname()[1])


def serve(host: str = "127.0.0.1", port: int = 8765, dev: bool = False) -> None:
    """Startet den Server im Vordergrund. ``dev``: ohne Token (für ``npm run dev``)."""
    config = AppConfig(token=None) if dev else AppConfig()
    if config.token:
        print(f"PianoScribe: http://{host}:{port}/?token={config.token}", flush=True)
    else:
        print(f"PianoScribe (Entwicklung, ohne Token): http://{host}:{port}/", flush=True)
    uvicorn.run(create_app(config), host=host, port=port, log_level="warning")


@dataclass
class BackgroundServer:
    server: uvicorn.Server
    thread: threading.Thread
    port: int
    token: str | None
    app: FastAPI

    @property
    def url(self) -> str:
        suffix = f"?token={self.token}" if self.token else ""
        return f"http://127.0.0.1:{self.port}/{suffix}"

    def stop(self, timeout: float = 10.0) -> None:
        self.server.should_exit = True
        self.thread.join(timeout)


def start_background(config: AppConfig | None = None, port: int | None = None,
                     timeout: float = 20.0) -> BackgroundServer:
    """Startet uvicorn in einem Thread auf einem freien Port und wartet, bis er bereit ist."""
    config = config or AppConfig()
    port = port or free_port()
    app = create_app(config)
    uv_config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning",
                               lifespan="on", log_config=None)
    server = uvicorn.Server(uv_config)
    thread = threading.Thread(target=server.run, name="pianoscribe-server", daemon=True)
    thread.start()
    deadline = time.time() + timeout
    while not server.started:
        if not thread.is_alive() or time.time() > deadline:
            raise RuntimeError("Der interne Server ist nicht gestartet.")
        time.sleep(0.05)
    return BackgroundServer(server, thread, port, config.token, app)
