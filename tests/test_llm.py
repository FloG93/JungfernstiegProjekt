from __future__ import annotations

import sys
import types

import pytest

from kindle_meta import llm
from kindle_meta.models import BookMetadata


class _FakeMessages:
    def __init__(self, response_text: str, calls: list[dict]):
        self._response_text = response_text
        self._calls = calls

    def create(self, **kwargs):
        self._calls.append(kwargs)
        block = types.SimpleNamespace(type="text", text=self._response_text)
        return types.SimpleNamespace(content=[block])


class _FakeAnthropic:
    def __init__(self, response_text: str, calls: list[dict]):
        self.messages = _FakeMessages(response_text, calls)


def _install_fake_anthropic(monkeypatch, response_text: str = "{}") -> list[dict]:
    calls: list[dict] = []
    fake_module = types.ModuleType("anthropic")
    fake_module.Anthropic = lambda: _FakeAnthropic(response_text, calls)
    monkeypatch.setitem(sys.modules, "anthropic", fake_module)
    return calls


@pytest.fixture(autouse=True)
def _isolated_settings_home(tmp_path, monkeypatch):
    monkeypatch.setenv("KINDLE_META_HOME", str(tmp_path))


def test_available_false_without_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert llm.available() is False


def test_available_false_without_anthropic_package(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    monkeypatch.setitem(sys.modules, "anthropic", None)
    assert llm.available() is False


def test_available_true_with_key_and_package(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    _install_fake_anthropic(monkeypatch)
    assert llm.available() is True


def test_extract_json_parses_embedded_object():
    raw = 'Hier ist das Ergebnis: {"title": "X"} - Ende.'
    assert llm._extract_json(raw) == {"title": "X"}


def test_extract_json_returns_none_for_invalid_or_empty():
    assert llm._extract_json("kein json hier") is None
    assert llm._extract_json("") is None
    assert llm._extract_json(None) is None


def test_guess_metadata_returns_none_for_empty_text(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    _install_fake_anthropic(monkeypatch)
    assert llm.guess_metadata("") is None
    assert llm.guess_metadata("   ") is None


def test_guess_metadata_returns_none_without_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert llm.guess_metadata("Ein Textauszug mit genug Inhalt.") is None


def test_guess_metadata_parses_response_and_uses_fast_model(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    response = (
        '{"title": "Erkannt", "authors": ["A"], "publisher": null, '
        '"published": null, "isbn": null, "language": "de"}'
    )
    calls = _install_fake_anthropic(monkeypatch, response)
    result = llm.guess_metadata("Ein Textauszug.")
    assert result["title"] == "Erkannt"
    assert calls[0]["model"] == llm.MODEL_FAST


def test_guess_metadata_uses_configured_model(monkeypatch):
    from kindle_meta.config import Settings

    Settings().set("llm_model_fast", "custom-fast-model")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    calls = _install_fake_anthropic(monkeypatch, '{"title": "X"}')
    llm.guess_metadata("Text")
    assert calls[0]["model"] == "custom-fast-model"


def test_research_metadata_returns_none_without_context(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    _install_fake_anthropic(monkeypatch)
    assert llm.research_metadata(None) is None
    assert llm.research_metadata(BookMetadata()) is None


def test_research_metadata_returns_none_without_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    known = BookMetadata(title="Bekannter Titel")
    assert llm.research_metadata(known) is None


def test_research_metadata_uses_research_model_and_includes_known_fields(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    response = '{"title": "Recherchiert", "series": "Serie", "series_index": 2}'
    calls = _install_fake_anthropic(monkeypatch, response)
    known = BookMetadata(title="Bekannter Titel", isbn="9783161484100")
    result = llm.research_metadata(known)
    assert result["title"] == "Recherchiert"
    assert calls[0]["model"] == llm.MODEL_RESEARCH
    assert "9783161484100" in calls[0]["messages"][0]["content"]


def test_review_metadata_returns_none_without_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert llm.review_metadata(BookMetadata(title="X")) is None


def test_review_metadata_parses_issues(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    response = (
        '{"ok": false, "issues": [{"field": "isbn", '
        '"message": "ISBN passt nicht zum Titel", "suggestion": null}]}'
    )
    _install_fake_anthropic(monkeypatch, response)
    meta = BookMetadata(title="X", isbn="1234567890")
    report = llm.review_metadata(meta)
    assert report.ok is False
    assert len(report.issues) == 1
    assert report.issues[0].field == "isbn"
    assert report.issues[0].suggestion is None


def test_review_metadata_ok_when_no_issues(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    _install_fake_anthropic(monkeypatch, '{"ok": true, "issues": []}')
    report = llm.review_metadata(BookMetadata(title="X"))
    assert report.ok is True
    assert report.issues == []


def test_review_metadata_returns_none_on_garbage_response(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    _install_fake_anthropic(monkeypatch, "Kein JSON hier.")
    assert llm.review_metadata(BookMetadata(title="X")) is None


def test_call_claude_returns_none_on_api_exception(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")

    class _RaisingMessages:
        def create(self, **kwargs):
            raise RuntimeError("API-Fehler")

    class _RaisingAnthropic:
        def __init__(self):
            self.messages = _RaisingMessages()

    fake_module = types.ModuleType("anthropic")
    fake_module.Anthropic = _RaisingAnthropic
    monkeypatch.setitem(sys.modules, "anthropic", fake_module)

    assert llm.guess_metadata("Ein Textauszug.") is None
