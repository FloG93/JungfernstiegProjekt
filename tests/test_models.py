from __future__ import annotations

from kindle_meta.models import BookMetadata


def test_author_str_joins_with_comma():
    meta = BookMetadata(authors=["Anna Muster", "Ben Beispiel"])
    assert meta.author_str == "Anna Muster, Ben Beispiel"


def test_author_str_empty_without_authors():
    assert BookMetadata().author_str == ""


def test_has_cover():
    assert BookMetadata().has_cover() is False
    assert BookMetadata(cover=b"x").has_cover() is True


def test_merged_with_empty_other_keeps_self():
    self_meta = BookMetadata(title="Titel", publisher="Verlag")
    other = BookMetadata()
    merged = self_meta.merged_with(other)
    assert merged.title == "Titel"
    assert merged.publisher == "Verlag"


def test_merged_with_prefer_other_true_overwrites():
    self_meta = BookMetadata(title="Alt")
    other = BookMetadata(title="Neu")
    merged = self_meta.merged_with(other, prefer_other=True)
    assert merged.title == "Neu"


def test_merged_with_prefer_other_false_fills_gaps_only():
    self_meta = BookMetadata(title="Alt", publisher="")
    other = BookMetadata(title="Neu", publisher="Verlag")
    merged = self_meta.merged_with(other, prefer_other=False)
    assert merged.title == "Alt"
    assert merged.publisher == "Verlag"


def test_merged_with_protect_keeps_own_nonempty_value():
    self_meta = BookMetadata(title="Eigener Titel", cover=b"eigenes-cover")
    other = BookMetadata(title="Anderer Titel", cover=b"anderes-cover")
    merged = self_meta.merged_with(other, prefer_other=True, protect={"cover"})
    assert merged.title == "Anderer Titel"
    assert merged.cover == b"eigenes-cover"


def test_merged_with_protect_ignored_when_self_value_empty():
    self_meta = BookMetadata(cover=None)
    other = BookMetadata(cover=b"anderes-cover")
    merged = self_meta.merged_with(other, prefer_other=True, protect={"cover"})
    assert merged.cover == b"anderes-cover"


def test_merged_with_sample_text_and_source_path_always_from_self():
    self_meta = BookMetadata(sample_text="eigener text", source_path="/pfad/self.epub")
    other = BookMetadata(sample_text="anderer text", source_path="/pfad/other.epub")
    merged = self_meta.merged_with(other, prefer_other=True)
    assert merged.sample_text == "eigener text"
    assert merged.source_path == "/pfad/self.epub"
