"""Schreiben von Metadaten (eingebettet) zurück in die E-Book-Datei."""

from __future__ import annotations

import os
import re
import shutil
from dataclasses import replace
from pathlib import Path

from kindle_meta.models import BookMetadata


class WriteError(Exception):
    """Metadaten konnten nicht geschrieben werden."""


def write_metadata(
    meta: BookMetadata,
    out_path: str | None = None,
    *,
    optimize_cover: bool = False,
    backup: bool = False,
) -> str:
    """Schreibt `meta` eingebettet in die Datei und gibt den Zielpfad zurück.

    Ist `out_path` von der Quelle verschieden, wird die Datei zuvor kopiert
    (das Original bleibt erhalten). Sonst wird in-place geschrieben; mit
    `backup=True` wird vorher eine Sicherungskopie angelegt.
    """
    source = meta.source_path
    if not source:
        raise WriteError("Keine Quelldatei bekannt (source_path fehlt)")

    ext = Path(source).suffix.lower().lstrip(".")
    target = out_path or source

    if target != source:
        shutil.copyfile(source, target)
    elif backup:
        from kindle_meta.backup import create_backup

        create_backup(source)

    working_meta = meta
    if optimize_cover and meta.has_cover():
        from kindle_meta import covers

        optimized = covers.optimize_for_kindle(meta.cover)
        working_meta = replace(meta, cover=optimized, cover_mime="image/jpeg")

    if ext == "epub":
        _write_epub(working_meta, target)
    elif ext == "pdf":
        _write_pdf(working_meta, target)
    elif ext in ("mobi", "azw3", "azw"):
        from kindle_meta import calibre

        calibre.write_metadata(working_meta, target)
    elif ext in ("fb2", "cbz", "cbr"):
        raise WriteError(
            f".{ext} kann nicht direkt geschrieben werden – bitte die Datei "
            "zuerst nach EPUB oder AZW3 konvertieren."
        )
    else:
        raise WriteError(f"Nicht unterstütztes Format zum Schreiben: .{ext}")

    return target


# --- EPUB -------------------------------------------------------------


def _remove_existing_cover(book) -> None:
    import ebooklib
    from ebooklib import epub

    for item in [i for i in book.items if i.get_type() == ebooklib.ITEM_COVER]:
        book.items.remove(item)

    opf_ns = epub.NAMESPACES["OPF"]
    metas = book.metadata.get(opf_ns, {}).get("meta", [])
    book.metadata.setdefault(opf_ns, {})["meta"] = [
        (value, attrs)
        for value, attrs in metas
        if not (attrs and attrs.get("name") == "cover")
    ]


def _set_calibre_series(book, meta: BookMetadata) -> None:
    from ebooklib import epub

    opf_ns = epub.NAMESPACES["OPF"]
    metas = book.metadata.get(opf_ns, {}).get("meta", [])
    kept = [
        (value, attrs)
        for value, attrs in metas
        if not (attrs and attrs.get("name") in ("calibre:series", "calibre:series_index"))
    ]
    if meta.series:
        kept.append((None, {"name": "calibre:series", "content": meta.series}))
        if meta.series_index is not None:
            index = meta.series_index
            index_str = str(int(index)) if float(index).is_integer() else str(index)
            kept.append((None, {"name": "calibre:series_index", "content": index_str}))
    book.metadata.setdefault(opf_ns, {})["meta"] = kept


def _ensure_toc_ids(entries: list) -> list:
    """Ergänzt fehlende `uid`s in `book.toc`-Einträgen.

    Nach einem read/write-Zyklus liefert ebooklib Link-Objekte aus der
    nav.xhtml ohne `uid`, was beim erneuten Schreiben der NCX-Datei zu
    einem TypeError in lxml führt (`navPoint`-Attribut `id` ist None).
    """
    from ebooklib import epub

    fixed = []
    for entry in entries:
        if isinstance(entry, tuple) and len(entry) == 2:
            section, children = entry
            fixed.append((section, _ensure_toc_ids(list(children))))
        elif isinstance(entry, epub.Link):
            if not getattr(entry, "uid", None):
                base = re.sub(r"[^A-Za-z0-9]+", "_", entry.href).strip("_") or "toc"
                entry.uid = f"toc_{base}"
            fixed.append(entry)
        else:
            fixed.append(entry)
    return fixed


def _write_epub(meta: BookMetadata, path: str) -> None:
    from ebooklib import epub

    book = epub.read_epub(path, options={"ignore_ncx": True})
    book.toc = _ensure_toc_ids(list(book.toc))
    dc_ns = epub.NAMESPACES["DC"]
    dc = book.metadata.setdefault(dc_ns, {})

    dc["title"] = [(meta.title, None)] if meta.title else []
    dc["creator"] = [(author, {"id": "creator"}) for author in meta.authors]
    dc["publisher"] = [(meta.publisher, None)] if meta.publisher else []
    dc["date"] = [(meta.published, None)] if meta.published else []
    dc["language"] = [(meta.language, None)] if meta.language else []
    dc["description"] = [(meta.description, None)] if meta.description else []
    dc["subject"] = [(subject, None) for subject in meta.subjects]
    if meta.isbn:
        dc["identifier"] = [(meta.isbn, {"id": "ISBN", "scheme": "ISBN"})]
        book.uid = meta.isbn
    elif not dc.get("identifier"):
        dc["identifier"] = [(book.uid or "id", {"id": "id"})]

    _set_calibre_series(book, meta)
    _remove_existing_cover(book)
    if meta.has_cover():
        book.set_cover("cover.jpg", meta.cover, create_page=False)

    epub.write_epub(path, book, {"epub3_pages": False})


# --- PDF ----------------------------------------------------------------


def _write_pdf(meta: BookMetadata, path: str) -> None:
    from pypdf import PdfReader, PdfWriter

    reader = PdfReader(path)
    writer = PdfWriter()
    writer.append(reader)

    info: dict[str, str] = {}
    if meta.title:
        info["/Title"] = meta.title
    if meta.authors:
        info["/Author"] = " & ".join(meta.authors)
    if meta.publisher:
        info["/Producer"] = meta.publisher
    if meta.subjects:
        info["/Keywords"] = ", ".join(meta.subjects)
    if meta.description:
        info["/Subject"] = meta.description
    writer.add_metadata(info)

    tmp_path = f"{path}.tmp"
    with open(tmp_path, "wb") as fh:
        writer.write(fh)
    os.replace(tmp_path, path)


# --- Calibre-Weiterleitung ------------------------------------------------


def calibre_available() -> bool:
    from kindle_meta import calibre

    return calibre.available()


def convert_with_calibre(src: str, out_ext: str = "azw3") -> str:
    from kindle_meta import calibre

    return calibre.convert(src, out_ext)
