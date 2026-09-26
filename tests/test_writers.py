from __future__ import annotations

import pytest

from kindle_meta.models import BookMetadata
from kindle_meta.readers import read_metadata
from kindle_meta.writers import WriteError, write_metadata


def test_write_epub_metadata_in_place(sample_epub):
    meta = read_metadata(sample_epub)
    meta.title = "Neuer Titel"
    meta.authors = ["Neue Autorin"]
    meta.series = "Neue Serie"
    meta.series_index = 3.0

    result_path = write_metadata(meta)
    assert result_path == sample_epub

    reread = read_metadata(sample_epub)
    assert reread.title == "Neuer Titel"
    assert reread.authors == ["Neue Autorin"]
    assert reread.series == "Neue Serie"
    assert reread.series_index == 3.0
    # Cover blieb erhalten, da meta.cover nicht verändert wurde.
    assert reread.has_cover()


def test_write_epub_replaces_cover_without_duplicate(sample_epub):
    meta = read_metadata(sample_epub)
    new_cover = b"\xff\xd8\xff\xe0neues-cover-jpeg-fake"
    meta.cover = new_cover
    meta.cover_mime = "image/jpeg"

    write_metadata(meta)

    reread = read_metadata(sample_epub)
    assert reread.cover == new_cover

    import ebooklib
    from ebooklib import epub

    book = epub.read_epub(sample_epub, options={"ignore_ncx": True})
    cover_items = [item for item in book.get_items() if item.get_type() == ebooklib.ITEM_COVER]
    assert len(cover_items) == 1


def test_write_epub_to_new_out_path_keeps_original(sample_epub, tmp_path):
    meta = read_metadata(sample_epub)
    meta.title = "Kopie-Titel"
    out_path = str(tmp_path / "kopie.epub")

    result_path = write_metadata(meta, out_path=out_path)
    assert result_path == out_path

    original = read_metadata(sample_epub)
    assert original.title == "Die Beispielreise"

    copy = read_metadata(out_path)
    assert copy.title == "Kopie-Titel"


def test_write_epub_removes_series_when_empty(sample_epub):
    meta = read_metadata(sample_epub)
    meta.series = ""
    meta.series_index = None

    write_metadata(meta)

    reread = read_metadata(sample_epub)
    assert reread.series == ""
    assert reread.series_index is None


def test_write_pdf_metadata(sample_pdf):
    meta = read_metadata(sample_pdf)
    meta.title = "Neuer PDF-Titel"
    meta.authors = ["Neue Autorin"]
    meta.subjects = ["Sachbuch"]
    meta.description = "Neue Beschreibung"

    write_metadata(meta)

    reread = read_metadata(sample_pdf)
    assert reread.title == "Neuer PDF-Titel"
    assert reread.authors == ["Neue Autorin"]


def test_write_metadata_without_source_path_raises():
    meta = BookMetadata(title="Ohne Quelle")
    with pytest.raises(WriteError):
        write_metadata(meta)


def test_write_metadata_fb2_raises_write_error(tmp_path):
    path = tmp_path / "buch.fb2"
    path.write_text("<FictionBook></FictionBook>")
    meta = BookMetadata(title="X", source_path=str(path))
    with pytest.raises(WriteError):
        write_metadata(meta)


def test_write_metadata_optimizes_cover(sample_epub):
    from kindle_meta import covers

    meta = read_metadata(sample_epub)
    original_cover = meta.cover

    write_metadata(meta, optimize_cover=True)

    reread = read_metadata(sample_epub)
    assert reread.cover != original_cover
    # Ergebnis muss ein gültiges, per optimize_for_kindle erzeugtes JPEG sein.
    reoptimized_again = covers.optimize_for_kindle(reread.cover)
    assert reoptimized_again == reread.cover


def test_calibre_available_delegates(monkeypatch):
    from kindle_meta import calibre, writers

    monkeypatch.setattr(calibre, "available", lambda: True)
    assert writers.calibre_available() is True


def test_convert_with_calibre_delegates(monkeypatch):
    from kindle_meta import calibre, writers

    monkeypatch.setattr(calibre, "convert", lambda src, out_ext="azw3": f"{src}.{out_ext}")
    assert writers.convert_with_calibre("buch.epub", "azw3") == "buch.epub.azw3"


def test_write_metadata_mobi_delegates_to_calibre(tmp_path, monkeypatch):
    path = tmp_path / "buch.mobi"
    path.write_bytes(b"fake")
    meta = BookMetadata(title="X", source_path=str(path))

    from kindle_meta import calibre

    called = {}

    def fake_write(m, p):
        called["meta"] = m
        called["path"] = p

    monkeypatch.setattr(calibre, "write_metadata", fake_write)
    write_metadata(meta)
    assert called["path"] == str(path)
