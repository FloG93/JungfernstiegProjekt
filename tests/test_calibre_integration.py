"""Echte Integrationstests gegen ein installiertes Calibre.

Werden übersprungen, wenn `ebook-meta` nicht im PATH verfügbar ist (z. B. in
CI/Sandbox-Umgebungen ohne Calibre).
"""

from __future__ import annotations

import pytest

from kindle_meta import calibre
from kindle_meta.models import BookMetadata

pytestmark = pytest.mark.skipif(
    not calibre.available(), reason="Calibre (ebook-meta) nicht installiert"
)


def test_calibre_round_trip(sample_epub, tmp_path):
    azw3_path = calibre.convert(sample_epub, out_ext="azw3")
    assert azw3_path.endswith(".azw3")

    meta = calibre.read_metadata(azw3_path)
    assert meta.title == "Die Beispielreise"

    meta.title = "Geändert über Calibre"
    calibre.write_metadata(meta, azw3_path)

    reread = calibre.read_metadata(azw3_path)
    assert reread.title == "Geändert über Calibre"


def test_calibre_write_metadata_sets_series(sample_epub):
    azw3_path = calibre.convert(sample_epub, out_ext="azw3")
    meta = BookMetadata(
        source_path=azw3_path, title="Serientest", series="Serie X", series_index=1.0
    )
    calibre.write_metadata(meta, azw3_path)

    reread = calibre.read_metadata(azw3_path)
    assert reread.series == "Serie X"
    assert reread.series_index == 1.0
