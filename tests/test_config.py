from __future__ import annotations

from kindle_meta import config
from kindle_meta.config import Settings


def test_app_home_uses_env_var_and_creates_dir(tmp_path, monkeypatch):
    target = tmp_path / "custom-home"
    monkeypatch.setenv("KINDLE_META_HOME", str(target))
    result = config.app_home()
    assert result == target
    assert target.exists()


def test_backups_dir_and_library_path(tmp_path, monkeypatch):
    monkeypatch.setenv("KINDLE_META_HOME", str(tmp_path))
    assert config.backups_dir() == tmp_path / "backups"
    assert config.backups_dir().exists()
    assert config.library_path() == tmp_path / "library.db"


def test_settings_defaults_include_llm_models(tmp_path, monkeypatch):
    monkeypatch.setenv("KINDLE_META_HOME", str(tmp_path))
    settings = Settings()
    assert settings.get("llm_model_fast") == config.DEFAULT_LLM_MODEL_FAST
    assert settings.get("llm_model_research") == config.DEFAULT_LLM_MODEL_RESEARCH
    assert settings.get("kindle_addr") == ""


def test_settings_set_and_persist_across_instances(tmp_path, monkeypatch):
    monkeypatch.setenv("KINDLE_META_HOME", str(tmp_path))
    settings = Settings()
    settings.set("kindle_addr", "meinkindle@kindle.com")
    settings.set("llm_model_research", "claude-opus-5-5")

    reloaded = Settings()
    assert reloaded.get("kindle_addr") == "meinkindle@kindle.com"
    assert reloaded.get("llm_model_research") == "claude-opus-5-5"


def test_settings_secret_falls_back_to_file_without_keyring(tmp_path, monkeypatch):
    monkeypatch.setenv("KINDLE_META_HOME", str(tmp_path))
    import sys

    monkeypatch.setitem(sys.modules, "keyring", None)

    settings = Settings()
    settings.set("smtp_pass", "geheim123")

    reloaded = Settings()
    assert reloaded.get("smtp_pass") == "geheim123"

    content = config.settings_path().read_text(encoding="utf-8")
    assert "geheim123" in content


def test_settings_secret_uses_keyring_when_available(tmp_path, monkeypatch):
    monkeypatch.setenv("KINDLE_META_HOME", str(tmp_path))
    import sys
    import types

    store: dict[tuple[str, str], str] = {}

    fake_keyring = types.ModuleType("keyring")
    fake_keyring.set_password = lambda service, key, value: store.__setitem__(
        (service, key), value
    )
    fake_keyring.get_password = lambda service, key: store.get((service, key))
    monkeypatch.setitem(sys.modules, "keyring", fake_keyring)

    settings = Settings()
    settings.set("smtp_pass", "geheim123")

    content = config.settings_path().read_text(encoding="utf-8")
    assert "geheim123" not in content
    assert store[("kindle-meta", "smtp_pass")] == "geheim123"

    reloaded = Settings()
    assert reloaded.get("smtp_pass") == "geheim123"
