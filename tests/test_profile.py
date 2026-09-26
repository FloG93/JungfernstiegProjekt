from __future__ import annotations

import pytest

from kindle_meta.profile import load_protected, parse_protected, save_protected


@pytest.fixture(autouse=True)
def _isolated_home(tmp_path, monkeypatch):
    monkeypatch.setenv("KINDLE_META_HOME", str(tmp_path))


def test_parse_protected_known_fields():
    assert parse_protected("title, publisher") == {"title", "publisher"}


def test_parse_protected_ignores_unknown_fields():
    assert parse_protected("title, unbekanntes_feld") == {"title"}


def test_parse_protected_cover_adds_cover_mime():
    assert parse_protected("cover") == {"cover", "cover_mime"}


def test_parse_protected_empty_string():
    assert parse_protected("") == set()
    assert parse_protected(None) == set()


def test_save_and_load_protected_roundtrip():
    save_protected({"title", "cover"})
    loaded = load_protected()
    assert loaded == {"title", "cover", "cover_mime"}
