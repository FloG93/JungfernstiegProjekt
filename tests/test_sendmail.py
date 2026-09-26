from __future__ import annotations

import smtplib

import pytest

from kindle_meta.sendmail import SendError, SmtpConfig, build_message, send_to_kindle


def test_smtp_config_from_env(monkeypatch):
    monkeypatch.setenv("KINDLE_SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("KINDLE_SMTP_PORT", "465")
    monkeypatch.setenv("KINDLE_SMTP_USER", "user@example.com")
    monkeypatch.setenv("KINDLE_SMTP_PASS", "geheim")
    monkeypatch.setenv("KINDLE_FROM", "absender@example.com")

    config = SmtpConfig.from_env()
    assert config.host == "smtp.example.com"
    assert config.port == 465
    assert config.sender == "absender@example.com"


def test_smtp_config_from_env_none_without_host(monkeypatch):
    monkeypatch.delenv("KINDLE_SMTP_HOST", raising=False)
    assert SmtpConfig.from_env() is None


def test_smtp_config_load_prefers_env_over_settings(monkeypatch):
    monkeypatch.setenv("KINDLE_SMTP_HOST", "aus-env.example.com")

    class FakeSettings:
        def get(self, key, default=None):
            raise AssertionError("Settings sollten nicht befragt werden, wenn ENV gesetzt ist")

    config = SmtpConfig.load(FakeSettings())
    assert config.host == "aus-env.example.com"


def test_smtp_config_load_falls_back_to_settings(monkeypatch):
    monkeypatch.delenv("KINDLE_SMTP_HOST", raising=False)

    class FakeSettings:
        _data = {
            "smtp_host": "aus-settings.example.com",
            "smtp_port": 587,
            "smtp_user": "user",
            "smtp_pass": "pass",
            "smtp_from": "from@example.com",
        }

        def get(self, key, default=None):
            return self._data.get(key, default)

    config = SmtpConfig.load(FakeSettings())
    assert config.host == "aus-settings.example.com"


def test_smtp_config_load_none_without_env_or_settings(monkeypatch):
    monkeypatch.delenv("KINDLE_SMTP_HOST", raising=False)
    assert SmtpConfig.load(None) is None


def test_build_message_sets_attachment_and_headers(tmp_path):
    path = tmp_path / "buch.epub"
    path.write_bytes(b"epub-inhalt")
    message = build_message(str(path), "kindle@kindle.com", "ich@example.com")
    assert message["To"] == "kindle@kindle.com"
    assert message["From"] == "ich@example.com"
    assert message["Subject"] == "buch.epub"
    attachments = list(message.iter_attachments())
    assert len(attachments) == 1
    assert attachments[0].get_content() == b"epub-inhalt"


class _FakeSmtp:
    instances: list[_FakeSmtp] = []

    def __init__(self, host, port):
        self.host = host
        self.port = port
        self.logged_in = None
        self.sent = None
        self.started_tls = False
        _FakeSmtp.instances.append(self)

    def starttls(self):
        self.started_tls = True

    def login(self, user, password):
        self.logged_in = (user, password)

    def send_message(self, message):
        self.sent = message

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def test_send_to_kindle_uses_starttls_for_non_ssl_port(monkeypatch, tmp_path):
    _FakeSmtp.instances.clear()
    monkeypatch.setattr(smtplib, "SMTP", _FakeSmtp)
    path = tmp_path / "buch.epub"
    path.write_bytes(b"x")

    config = SmtpConfig(
        host="smtp.example.com", port=587, user="u", password="p", sender="s@example.com"
    )
    send_to_kindle(str(path), "kindle@kindle.com", config)

    assert len(_FakeSmtp.instances) == 1
    instance = _FakeSmtp.instances[0]
    assert instance.started_tls is True
    assert instance.logged_in == ("u", "p")
    assert instance.sent is not None


def test_send_to_kindle_uses_ssl_for_port_465(monkeypatch, tmp_path):
    _FakeSmtp.instances.clear()
    monkeypatch.setattr(smtplib, "SMTP_SSL", _FakeSmtp)
    path = tmp_path / "buch.epub"
    path.write_bytes(b"x")

    config = SmtpConfig(
        host="smtp.example.com", port=465, user="u", password="p", sender="s@example.com"
    )
    send_to_kindle(str(path), "kindle@kindle.com", config)

    assert len(_FakeSmtp.instances) == 1
    assert _FakeSmtp.instances[0].port == 465


def test_send_to_kindle_raises_send_error_without_config(monkeypatch, tmp_path):
    monkeypatch.delenv("KINDLE_SMTP_HOST", raising=False)
    monkeypatch.setenv("KINDLE_META_HOME", str(tmp_path / "home"))
    path = tmp_path / "buch.epub"
    path.write_bytes(b"x")
    with pytest.raises(SendError):
        send_to_kindle(str(path), "kindle@kindle.com", None)


def test_send_to_kindle_wraps_smtp_exceptions(monkeypatch, tmp_path):
    class _RaisingSmtp:
        def __init__(self, host, port):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def starttls(self):
            raise RuntimeError("Verbindung fehlgeschlagen")

    monkeypatch.setattr(smtplib, "SMTP", _RaisingSmtp)
    path = tmp_path / "buch.epub"
    path.write_bytes(b"x")
    config = SmtpConfig(
        host="smtp.example.com", port=587, user="", password="", sender="s@example.com"
    )
    with pytest.raises(SendError):
        send_to_kindle(str(path), "kindle@kindle.com", config)
