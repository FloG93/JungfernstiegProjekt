from __future__ import annotations

import pytest

from kindle_meta import readers
from kindle_meta.models import BookMetadata
from kindle_meta.readers import UnsupportedFormat, read_metadata


def test_read_epub_metadata(sample_epub):
    meta = read_metadata(sample_epub)
    assert meta.title == "Die Beispielreise"
    assert meta.authors == ["Anna Musterfrau"]
    assert meta.publisher == "Testverlag"
    assert meta.published == "2021-05-01"
    assert meta.language == "de"
    assert meta.description == "Eine spannende Beispielgeschichte."
    assert meta.subjects == ["Roman"]
    assert meta.isbn == "9783161484100"
    assert meta.series == "Testserie"
    assert meta.series_index == 2.0
    assert meta.has_cover()
    assert meta.cover_mime == "image/jpeg"
    assert "Wanderin" in meta.sample_text
    assert meta.source_path == sample_epub


def test_read_pdf_metadata(sample_pdf):
    meta = read_metadata(sample_pdf)
    assert meta.title == "PDF Beispiel"
    assert meta.authors == ["Erika Musterfrau", "Max Mustermann"]
    assert meta.published == "2020-01-15"
    assert meta.page_count == 2
    assert meta.source_path == sample_pdf


def test_read_metadata_unsupported_format(tmp_path):
    path = tmp_path / "buch.txt"
    path.write_text("kein E-Book")
    with pytest.raises(UnsupportedFormat):
        read_metadata(str(path))


def test_read_metadata_dispatches_mobi_to_calibre(tmp_path, monkeypatch):
    path = tmp_path / "buch.mobi"
    path.write_bytes(b"fake mobi content")
    expected = BookMetadata(title="Aus Calibre")

    called_with = {}

    def fake_read_metadata(p):
        called_with["path"] = p
        return expected

    from kindle_meta import calibre

    monkeypatch.setattr(calibre, "read_metadata", fake_read_metadata)
    result = read_metadata(str(path))
    assert result is expected
    assert called_with["path"] == str(path)


def test_split_pdf_authors_handles_separators():
    assert readers._split_pdf_authors("Anna Muster; Ben Beispiel") == [
        "Anna Muster",
        "Ben Beispiel",
    ]
    assert readers._split_pdf_authors("Anna Muster and Ben Beispiel") == [
        "Anna Muster",
        "Ben Beispiel",
    ]
    assert readers._split_pdf_authors("Anna Muster und Ben Beispiel") == [
        "Anna Muster",
        "Ben Beispiel",
    ]
