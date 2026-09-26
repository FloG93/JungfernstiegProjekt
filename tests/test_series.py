from __future__ import annotations

from kindle_meta.models import BookMetadata
from kindle_meta.series import check_series_consistency, known_books_payload


def test_check_series_consistency_finds_missing_index():
    books = [
        BookMetadata(title="Band 1", series="Testserie", series_index=1.0),
        BookMetadata(title="Band ohne Nummer", series="Testserie", series_index=None),
    ]
    issues = check_series_consistency(books)
    kinds = [i.kind for i in issues]
    assert "missing_index" in kinds


def test_check_series_consistency_finds_duplicate_index():
    books = [
        BookMetadata(title="Band 2 A", series="Testserie", series_index=2.0),
        BookMetadata(title="Band 2 B", series="Testserie", series_index=2.0),
    ]
    issues = check_series_consistency(books)
    duplicate_issues = [i for i in issues if i.kind == "duplicate_index"]
    assert len(duplicate_issues) == 1
    assert len(duplicate_issues[0].books) == 2


def test_check_series_consistency_finds_gap():
    books = [
        BookMetadata(title="Band 1", series="Testserie", series_index=1.0),
        BookMetadata(title="Band 3", series="Testserie", series_index=3.0),
    ]
    issues = check_series_consistency(books)
    gap_issues = [i for i in issues if i.kind == "gap"]
    assert len(gap_issues) == 1
    assert "2" in gap_issues[0].message


def test_check_series_consistency_ignores_books_without_series():
    books = [BookMetadata(title="Einzelband", series="")]
    assert check_series_consistency(books) == []


def test_check_series_consistency_no_issues_for_complete_series():
    books = [
        BookMetadata(title="Band 1", series="Testserie", series_index=1.0),
        BookMetadata(title="Band 2", series="Testserie", series_index=2.0),
        BookMetadata(title="Band 3", series="Testserie", series_index=3.0),
    ]
    assert check_series_consistency(books) == []


def test_known_books_payload_only_includes_indexed_books():
    books = [
        BookMetadata(title="Mit Index", series_index=1.0),
        BookMetadata(title="Ohne Index", series_index=None),
    ]
    payload = known_books_payload(books)
    assert payload == [{"title": "Mit Index", "series_index": 1.0}]


def test_check_series_consistency_uses_library_when_no_books_given(tmp_path, monkeypatch):
    monkeypatch.setenv("KINDLE_META_HOME", str(tmp_path))
    from kindle_meta.library import Library

    with Library() as lib:
        lib.upsert(BookMetadata(title="Band 1", series="S", series_index=1.0, source_path="/a"))
        lib.upsert(BookMetadata(title="Band ?", series="S", series_index=None, source_path="/b"))

    issues = check_series_consistency()
    assert any(i.kind == "missing_index" for i in issues)
