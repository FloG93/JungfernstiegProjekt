from __future__ import annotations

import sys
import zipfile

import pytest

from kindle_meta.readers import UnsupportedFormat, read_metadata

COMIC_INFO = """<?xml version="1.0" encoding="UTF-8"?>
<ComicInfo>
  <Title>Die Comic-Reise</Title>
  <Series>Comic-Serie</Series>
  <Number>3</Number>
  <Writer>Anna Musterfrau, Ben Beispiel</Writer>
  <Penciller>Ben Beispiel</Penciller>
  <Publisher>Comic-Verlag</Publisher>
  <Year>2018</Year>
  <Summary>Eine kurze Comic-Zusammenfassung.</Summary>
  <LanguageISO>de</LanguageISO>
  <Genre>Action, Abenteuer</Genre>
</ComicInfo>
"""


def _make_cbz(tmp_path, include_info: bool = True) -> str:
    path = tmp_path / "beispiel.cbz"
    with zipfile.ZipFile(path, "w") as zf:
        if include_info:
            zf.writestr("ComicInfo.xml", COMIC_INFO)
        zf.writestr("002.jpg", b"zweites-bild")
        zf.writestr("001.jpg", b"erstes-bild-ist-das-cover")
    return str(path)


def test_read_cbz_metadata(tmp_path):
    path = _make_cbz(tmp_path)
    meta = read_metadata(path)

    assert meta.title == "Die Comic-Reise"
    assert meta.series == "Comic-Serie"
    assert meta.series_index == 3.0
    assert meta.authors == ["Anna Musterfrau", "Ben Beispiel"]
    assert meta.publisher == "Comic-Verlag"
    assert meta.published == "2018"
    assert meta.description == "Eine kurze Comic-Zusammenfassung."
    assert meta.language == "de"
    assert meta.subjects == ["Action", "Abenteuer"]
    assert meta.cover == b"erstes-bild-ist-das-cover"


def test_read_cbz_without_comicinfo_uses_first_image_as_cover(tmp_path):
    path = _make_cbz(tmp_path, include_info=False)
    meta = read_metadata(path)
    assert meta.title == ""
    assert meta.cover == b"erstes-bild-ist-das-cover"


def test_read_cbr_without_rarfile_raises_unsupported(tmp_path, monkeypatch):
    monkeypatch.setitem(sys.modules, "rarfile", None)
    path = tmp_path / "beispiel.cbr"
    path.write_bytes(b"fake rar content")
    with pytest.raises(UnsupportedFormat):
        read_metadata(str(path))


class _FakeRarFile:
    def __init__(self, path: str):
        self._path = path

    def namelist(self) -> list[str]:
        return list(_FAKE_RAR_CONTENTS[self._path].keys())

    def read(self, name: str) -> bytes:
        return _FAKE_RAR_CONTENTS[self._path][name]

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


_FAKE_RAR_CONTENTS: dict[str, dict[str, bytes]] = {}


def test_read_cbr_with_fake_rarfile(tmp_path, monkeypatch):
    import types

    path = tmp_path / "beispiel.cbr"
    path.write_bytes(b"fake rar content")
    _FAKE_RAR_CONTENTS[str(path)] = {
        "ComicInfo.xml": COMIC_INFO.encode("utf-8"),
        "001.jpg": b"cbr-cover",
    }

    fake_module = types.ModuleType("rarfile")
    fake_module.RarFile = _FakeRarFile
    monkeypatch.setitem(sys.modules, "rarfile", fake_module)

    meta = read_metadata(str(path))
    assert meta.title == "Die Comic-Reise"
    assert meta.cover == b"cbr-cover"
