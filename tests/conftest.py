"""Gemeinsame Test-Fixtures: Beispieldateien für Reader-/Writer-Tests."""

from __future__ import annotations

import io

import pytest
from PIL import Image


def _make_cover(color: tuple[int, int, int] = (180, 30, 30)) -> bytes:
    img = Image.new("RGB", (400, 600), color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


@pytest.fixture
def sample_epub(tmp_path):
    """EPUB mit Titel 'Die Beispielreise', Autorin 'Anna Musterfrau',
    Verlag 'Testverlag', ISBN 9783161484100, Serie 'Testserie' Band 2 und
    einem per Pillow erzeugten Cover.
    """
    from ebooklib import epub

    book = epub.EpubBook()
    book.set_identifier("9783161484100")
    book.set_title("Die Beispielreise")
    book.set_language("de")
    book.add_author("Anna Musterfrau")
    book.add_metadata("DC", "publisher", "Testverlag")
    book.add_metadata("DC", "date", "2021-05-01")
    book.add_metadata("DC", "description", "Eine spannende Beispielgeschichte.")
    book.add_metadata("DC", "subject", "Roman")
    book.add_metadata("DC", "identifier", "9783161484100", {"id": "ISBN", "scheme": "ISBN"})
    book.add_metadata("OPF", "meta", None, {"name": "calibre:series", "content": "Testserie"})
    book.add_metadata("OPF", "meta", None, {"name": "calibre:series_index", "content": "2"})

    chapter = epub.EpubHtml(title="Kapitel 1", file_name="chap_01.xhtml", lang="de")
    chapter.content = (
        "<html><body><p>Die Sonne ging langsam über den Bergen unter, und "
        "die Wanderin machte sich auf den Weg nach Hause, denn der Abend "
        "war nicht mehr fern und der Wald wurde bereits dunkel und "
        "still.</p></body></html>"
    )
    book.add_item(chapter)
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())
    book.spine = ["nav", chapter]
    book.toc = (epub.Link("chap_01.xhtml", "Kapitel 1", "chap_01"),)

    book.set_cover("cover.jpg", _make_cover(), create_page=False)

    path = tmp_path / "beispiel.epub"
    epub.write_epub(str(path), book, {"epub3_pages": False})
    return str(path)


@pytest.fixture
def sample_pdf(tmp_path):
    """PDF mit Titel 'PDF Beispiel', zwei Autoren und zwei leeren Seiten."""
    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=400, height=600)
    writer.add_blank_page(width=400, height=600)
    writer.add_metadata(
        {
            "/Title": "PDF Beispiel",
            "/Author": "Erika Musterfrau & Max Mustermann",
            "/CreationDate": "D:20200115120000",
        }
    )
    path = tmp_path / "beispiel.pdf"
    with open(path, "wb") as fh:
        writer.write(fh)
    return str(path)


@pytest.fixture
def no_modal_dialogs(monkeypatch):
    """Verhindert blockierende QMessageBox-Dialoge in GUI-Tests."""
    from PySide6 import QtWidgets

    for method in ("information", "warning", "critical"):
        monkeypatch.setattr(QtWidgets.QMessageBox, method, staticmethod(lambda *a, **k: None))
    monkeypatch.setattr(
        QtWidgets.QMessageBox,
        "question",
        staticmethod(lambda *a, **k: QtWidgets.QMessageBox.StandardButton.Yes),
    )
