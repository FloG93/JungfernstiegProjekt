from __future__ import annotations

from kindle_meta import calibre
from kindle_meta.models import BookMetadata

SAMPLE_OUTPUT = """Title               : Die Beispielreise
Author(s)           : Anna Musterfrau [Musterfrau, Anna] & Ben Beispiel
Publisher           : Testverlag
Languages           : deu
Published           : 2021-05-01T00:00:00+00:00
Comments            : Eine lange Beschreibung,
                        die über mehrere Zeilen geht.
Identifiers         : isbn:9783161484100
Series              : Testserie #2
"""


def test_parse_ebook_meta_output_basic_fields():
    parsed = calibre.parse_ebook_meta_output(SAMPLE_OUTPUT)
    assert parsed["Title"] == "Die Beispielreise"
    assert parsed["Publisher"] == "Testverlag"
    assert parsed["Identifiers"] == "isbn:9783161484100"
    assert parsed["Series"] == "Testserie #2"


def test_parse_ebook_meta_output_joins_continuation_lines():
    parsed = calibre.parse_ebook_meta_output(SAMPLE_OUTPUT)
    assert parsed["Comments"] == "Eine lange Beschreibung, die über mehrere Zeilen geht."


def test_split_authors_strips_sort_names_and_splits_on_ampersand():
    result = calibre._split_authors("Anna Musterfrau [Musterfrau, Anna] & Ben Beispiel")
    assert result == ["Anna Musterfrau", "Ben Beispiel"]


def test_parse_series_bracket_and_hash_forms():
    assert calibre._parse_series("Testserie [2]") == ("Testserie", 2.0)
    assert calibre._parse_series("Testserie #2") == ("Testserie", 2.0)
    assert calibre._parse_series("Testserie ohne Index") == ("Testserie ohne Index", None)


def test_build_write_args_includes_all_set_fields():
    meta = BookMetadata(
        title="Titel",
        authors=["Anna Musterfrau", "Ben Beispiel"],
        publisher="Testverlag",
        published="2021-05-01",
        language="de",
        description="Beschreibung",
        subjects=["Roman", "Drama"],
        isbn="9783161484100",
        series="Testserie",
        series_index=2.0,
    )
    args = calibre.build_write_args(meta)
    assert "--title" in args and "Titel" in args
    assert "--authors" in args and "Anna Musterfrau & Ben Beispiel" in args
    assert "--identifier" in args and "isbn:9783161484100" in args
    assert "--series" in args and "Testserie" in args
    assert "--index" in args and "2" in args


def test_build_write_args_omits_unset_fields():
    meta = BookMetadata(title="Nur Titel")
    args = calibre.build_write_args(meta)
    assert args == ["--title", "Nur Titel"]


def test_build_write_args_series_index_without_trailing_zero():
    meta = BookMetadata(series="Serie", series_index=3.0)
    args = calibre.build_write_args(meta)
    idx = args[args.index("--index") + 1]
    assert idx == "3"


def test_build_write_args_series_index_keeps_fraction():
    meta = BookMetadata(series="Serie", series_index=3.5)
    args = calibre.build_write_args(meta)
    idx = args[args.index("--index") + 1]
    assert idx == "3.5"


def test_available_false_without_ebook_meta(monkeypatch):
    monkeypatch.setattr(calibre.shutil, "which", lambda name: None)
    assert calibre.available() is False


def test_read_metadata_raises_without_calibre(monkeypatch, tmp_path):
    monkeypatch.setattr(calibre, "available", lambda: False)
    path = tmp_path / "buch.mobi"
    path.write_bytes(b"x")
    import pytest

    with pytest.raises(calibre.CalibreNotFound):
        calibre.read_metadata(str(path))
