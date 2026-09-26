from __future__ import annotations

import pytest

from kindle_meta import backup
from kindle_meta.library import STATUS_ENRICHED, STATUS_IMPORTED, Library, LibraryFilter
from kindle_meta.models import BookMetadata


@pytest.fixture(autouse=True)
def _isolated_home(tmp_path, monkeypatch):
    monkeypatch.setenv("KINDLE_META_HOME", str(tmp_path))


# --- backup.py --------------------------------------------------------


def test_create_backup_copies_file(tmp_path):
    source = tmp_path / "buch.epub"
    source.write_bytes(b"originalinhalt")

    backup_path = backup.create_backup(str(source))
    assert backup_path != str(source)
    from pathlib import Path

    assert Path(backup_path).read_bytes() == b"originalinhalt"
    assert Path(backup_path).name.endswith("__buch.epub")


def test_list_backups_newest_first(tmp_path):
    source = tmp_path / "buch.epub"
    source.write_bytes(b"v1")
    first = backup.create_backup(str(source))
    source.write_bytes(b"v2")
    second = backup.create_backup(str(source))

    backups = backup.list_backups(str(source))
    assert backups[0] == second
    assert backups[1] == first


def test_restore_latest_restores_content(tmp_path):
    source = tmp_path / "buch.epub"
    source.write_bytes(b"original")
    backup.create_backup(str(source))
    source.write_bytes(b"veraendert")

    backup.restore_latest(str(source))
    assert source.read_bytes() == b"original"


def test_create_backup_raises_if_source_missing(tmp_path):
    with pytest.raises(backup.BackupError):
        backup.create_backup(str(tmp_path / "fehlt.epub"))


def test_restore_latest_raises_without_backup(tmp_path):
    source = tmp_path / "buch.epub"
    source.write_bytes(b"x")
    with pytest.raises(backup.BackupError):
        backup.restore_latest(str(source))


def test_write_metadata_with_backup_creates_backup(sample_epub):
    from kindle_meta.readers import read_metadata
    from kindle_meta.writers import write_metadata

    meta = read_metadata(sample_epub)
    meta.title = "Mit Backup"
    write_metadata(meta, backup=True)

    backups = backup.list_backups(sample_epub)
    assert len(backups) == 1


# --- library.py ---------------------------------------------------------


def _meta(path: str, **kwargs) -> BookMetadata:
    defaults = dict(title="Titel", authors=["Autor"], source_path=path)
    defaults.update(kwargs)
    return BookMetadata(**defaults)


def test_upsert_and_get_roundtrip(tmp_path):
    with Library(str(tmp_path / "lib.db")) as lib:
        meta = _meta("/buecher/a.epub", publisher="Verlag", series="Serie", series_index=2.0)
        lib.upsert(meta, status=STATUS_IMPORTED)

        stored = lib.get("/buecher/a.epub")
        assert stored.title == "Titel"
        assert stored.publisher == "Verlag"
        assert stored.series_index == 2.0
        assert lib.get_status("/buecher/a.epub") == STATUS_IMPORTED
        assert lib.count() == 1


def test_upsert_updates_existing_entry(tmp_path):
    with Library(str(tmp_path / "lib.db")) as lib:
        lib.upsert(_meta("/a.epub", title="Alt"))
        lib.upsert(_meta("/a.epub", title="Neu"), status=STATUS_ENRICHED)

        assert lib.count() == 1
        assert lib.get("/a.epub").title == "Neu"
        assert lib.get_status("/a.epub") == STATUS_ENRICHED


def test_upsert_keeps_thumbnail_when_new_meta_has_no_cover(tmp_path):
    cover = _make_jpeg_cover()
    with Library(str(tmp_path / "lib.db")) as lib:
        lib.upsert(_meta("/a.epub", cover=cover, cover_mime="image/jpeg"))
        first_thumb = lib.get_thumbnail("/a.epub")
        assert first_thumb

        lib.upsert(_meta("/a.epub", title="Ohne Cover"))
        second_thumb = lib.get_thumbnail("/a.epub")
        assert second_thumb == first_thumb


def _make_jpeg_cover() -> bytes:
    import io

    from PIL import Image

    img = Image.new("RGB", (100, 100), (10, 20, 30))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_set_status_and_remove(tmp_path):
    with Library(str(tmp_path / "lib.db")) as lib:
        lib.upsert(_meta("/a.epub"))
        lib.set_status("/a.epub", STATUS_ENRICHED)
        assert lib.get_status("/a.epub") == STATUS_ENRICHED

        lib.remove("/a.epub")
        assert lib.get("/a.epub") is None
        assert lib.count() == 0


def test_all_orders_newest_first(tmp_path):
    import time

    with Library(str(tmp_path / "lib.db")) as lib:
        lib.upsert(_meta("/a.epub", title="Zuerst"))
        time.sleep(0.01)
        lib.upsert(_meta("/b.epub", title="Zuletzt"))
        titles = [b.title for b in lib.all()]
        assert titles == ["Zuletzt", "Zuerst"]


def test_search_by_text_matches_title_author_series(tmp_path):
    with Library(str(tmp_path / "lib.db")) as lib:
        lib.upsert(_meta("/a.epub", title="Die Beispielreise", authors=["Anna Musterfrau"]))
        lib.upsert(_meta("/b.epub", title="Voellig anders", authors=["Jemand"]))

        results = lib.search(LibraryFilter(text="Beispielreise"))
        assert [b.source_path for b in results] == ["/a.epub"]


def test_search_by_missing_cover(tmp_path):
    with Library(str(tmp_path / "lib.db")) as lib:
        lib.upsert(_meta("/mit.epub", cover=b"x", cover_mime="image/jpeg"))
        lib.upsert(_meta("/ohne.epub"))

        results = lib.search(LibraryFilter(missing_cover=True))
        assert [b.source_path for b in results] == ["/ohne.epub"]


def test_search_by_year_range(tmp_path):
    with Library(str(tmp_path / "lib.db")) as lib:
        lib.upsert(_meta("/alt.epub", published="1999-01-01"))
        lib.upsert(_meta("/neu.epub", published="2022-06-01"))

        results = lib.search(LibraryFilter(year_from=2020, year_to=2023))
        assert [b.source_path for b in results] == ["/neu.epub"]


def test_search_by_status_and_series(tmp_path):
    with Library(str(tmp_path / "lib.db")) as lib:
        lib.upsert(_meta("/a.epub", series="Serie A"), status=STATUS_IMPORTED)
        lib.upsert(_meta("/b.epub", series="Serie B"), status=STATUS_ENRICHED)

        results = lib.search(LibraryFilter(status=STATUS_ENRICHED, series="Serie B"))
        assert [b.source_path for b in results] == ["/b.epub"]


def test_build_filter_from_query_falls_back_without_llm(monkeypatch):
    from kindle_meta import llm
    from kindle_meta.library import build_filter_from_query

    monkeypatch.setattr(llm, "parse_library_query", lambda q: None)
    result = build_filter_from_query("irgendein Suchtext")
    assert result == LibraryFilter(text="irgendein Suchtext")


def test_build_filter_from_query_uses_llm_result(monkeypatch):
    from kindle_meta import llm
    from kindle_meta.library import build_filter_from_query

    monkeypatch.setattr(
        llm,
        "parse_library_query",
        lambda q: {"missing_cover": True, "language": "de", "unknown_key": "wird ignoriert"},
    )
    result = build_filter_from_query("Bücher ohne Cover auf Deutsch")
    assert result == LibraryFilter(missing_cover=True, language="de")
