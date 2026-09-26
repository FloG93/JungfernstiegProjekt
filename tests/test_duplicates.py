from __future__ import annotations

from kindle_meta.duplicates import find_duplicate_groups
from kindle_meta.models import BookMetadata


def test_find_duplicate_groups_matches_by_isbn():
    a = BookMetadata(title="Die Beispielreise", isbn="9783161484100", source_path="/a.epub")
    b = BookMetadata(
        title="Die Beispielreise (Sonderausgabe)", isbn="9783161484100", source_path="/b.mobi"
    )
    unrelated = BookMetadata(title="Anderes Buch", source_path="/c.epub")

    groups = find_duplicate_groups([a, b, unrelated])
    assert len(groups) == 1
    assert {b.source_path for b in groups[0]} == {"/a.epub", "/b.mobi"}


def test_find_duplicate_groups_matches_by_similarity_without_isbn():
    a = BookMetadata(title="Die Verwandlung", authors=["Franz Kafka"], source_path="/a.epub")
    b = BookMetadata(title="Die Verwandlung", authors=["Franz Kafka"], source_path="/b.pdf")
    other = BookMetadata(title="Ein ganz anderes Buch", authors=["Jemand"], source_path="/c.epub")

    groups = find_duplicate_groups([a, b, other], threshold=0.85)
    assert len(groups) == 1
    assert {x.source_path for x in groups[0]} == {"/a.epub", "/b.pdf"}


def test_find_duplicate_groups_returns_empty_without_duplicates():
    a = BookMetadata(title="Buch A", authors=["Autor A"], source_path="/a.epub")
    b = BookMetadata(title="Buch B", authors=["Autor B"], source_path="/b.epub")
    assert find_duplicate_groups([a, b]) == []


def test_find_duplicate_groups_handles_group_of_three():
    a = BookMetadata(title="Serienbuch", isbn="1160959676", source_path="/a.epub")
    b = BookMetadata(title="Serienbuch", isbn="1160959676", source_path="/b.epub")
    c = BookMetadata(title="Serienbuch", isbn="1160959676", source_path="/c.epub")
    groups = find_duplicate_groups([a, b, c])
    assert len(groups) == 1
    assert len(groups[0]) == 3


def test_find_duplicate_groups_uses_library_when_no_books_given(tmp_path, monkeypatch):
    monkeypatch.setenv("KINDLE_META_HOME", str(tmp_path))
    from kindle_meta.library import Library

    with Library() as lib:
        lib.upsert(BookMetadata(title="X", isbn="9783161484100", source_path="/a.epub"))
        lib.upsert(BookMetadata(title="X", isbn="9783161484100", source_path="/b.epub"))

    groups = find_duplicate_groups()
    assert len(groups) == 1
