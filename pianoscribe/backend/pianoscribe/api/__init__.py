"""HTTP-API (FastAPI) für die Oberfläche. Alle Routen liegen unter ``/api``."""

from .app import AppConfig, create_app

__all__ = ["AppConfig", "create_app"]
