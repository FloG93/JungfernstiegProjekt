"""Send-to-Kindle per SMTP."""

from __future__ import annotations

import mimetypes
import os
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from pathlib import Path

_FORMAT_MIME = {
    "epub": "application/epub+zip",
    "pdf": "application/pdf",
    "azw3": "application/vnd.amazon.ebook",
    "mobi": "application/x-mobipocket-ebook",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain",
}


class SendError(Exception):
    """Die Datei konnte nicht per E-Mail an den Kindle gesendet werden."""


@dataclass
class SmtpConfig:
    host: str
    port: int
    user: str
    password: str
    sender: str

    @classmethod
    def from_env(cls) -> SmtpConfig | None:
        """Liest `KINDLE_SMTP_HOST/PORT/USER/PASS` und `KINDLE_FROM`."""
        host = os.environ.get("KINDLE_SMTP_HOST")
        if not host:
            return None
        return cls(
            host=host,
            port=int(os.environ.get("KINDLE_SMTP_PORT", "587")),
            user=os.environ.get("KINDLE_SMTP_USER", ""),
            password=os.environ.get("KINDLE_SMTP_PASS", ""),
            sender=os.environ.get("KINDLE_FROM", ""),
        )

    @classmethod
    def load(cls, settings: object = None) -> SmtpConfig | None:
        """Umgebungsvariablen haben Vorrang, sonst `settings` (Settings)."""
        from_env = cls.from_env()
        if from_env is not None:
            return from_env
        if settings is None:
            return None
        host = settings.get("smtp_host", "")
        if not host:
            return None
        return cls(
            host=host,
            port=int(settings.get("smtp_port", 587) or 587),
            user=settings.get("smtp_user", "") or "",
            password=settings.get("smtp_pass", "") or "",
            sender=settings.get("smtp_from", "") or "",
        )


def build_message(file_path: str, to_addr: str, from_addr: str) -> EmailMessage:
    path = Path(file_path)
    ext = path.suffix.lower().lstrip(".")
    mime = (
        _FORMAT_MIME.get(ext)
        or mimetypes.guess_type(file_path)[0]
        or "application/octet-stream"
    )
    maintype, _, subtype = mime.partition("/")

    message = EmailMessage()
    message["To"] = to_addr
    message["From"] = from_addr
    message["Subject"] = path.name
    message.set_content("Automatisch von kindle-meta gesendet.")
    message.add_attachment(
        path.read_bytes(), maintype=maintype, subtype=subtype or "octet-stream", filename=path.name
    )
    return message


def send_to_kindle(file_path: str, to_addr: str, config: SmtpConfig | None = None) -> None:
    if config is None:
        from kindle_meta.config import Settings

        config = SmtpConfig.load(Settings())
    if config is None:
        raise SendError(
            "Keine SMTP-Konfiguration gefunden (Umgebungsvariablen oder Einstellungen)."
        )

    message = build_message(file_path, to_addr, config.sender or config.user)
    try:
        if config.port == 465:
            with smtplib.SMTP_SSL(config.host, config.port) as smtp:
                if config.user:
                    smtp.login(config.user, config.password)
                smtp.send_message(message)
        else:
            with smtplib.SMTP(config.host, config.port) as smtp:
                smtp.starttls()
                if config.user:
                    smtp.login(config.user, config.password)
                smtp.send_message(message)
    except SendError:
        raise
    except Exception as exc:  # noqa: BLE001 - in SendError übersetzen
        raise SendError(f"Senden fehlgeschlagen: {exc}") from exc
