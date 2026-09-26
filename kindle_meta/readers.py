"""Lesen von Metadaten und Textprobe aus verschiedenen E-Book-Formaten."""

from __future__ import annotations

import base64
import os
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from kindle_meta.models import BookMetadata

SAMPLE_CHARS = 4000

_IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".gif", ".webp")
_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WHITESPACE_RE = re.compile(r"\s+")


class UnsupportedFormat(Exception):
    """Das Dateiformat wird nicht unterstützt (oder eine Abhängigkeit fehlt)."""


def read_metadata(path: str) -> BookMetadata:
    """Liest Metadaten + Textprobe aus `path`, je nach Dateiendung."""
    ext = Path(path).suffix.lower().lstrip(".")
    if ext == "epub":
        return _read_epub(path)
    if ext == "pdf":
        return _read_pdf(path)
    if ext == "fb2":
        return _read_fb2(path)
    if ext == "cbz":
        return _read_comic_zip(path)
    if ext == "cbr":
        return _read_comic_rar(path)
    if ext in ("mobi", "azw3", "azw"):
        from kindle_meta import calibre

        return calibre.read_metadata(path)
    raise UnsupportedFormat(f"Nicht unterstütztes Format: .{ext}")


def _clean_html(html: str) -> str:
    text = _HTML_TAG_RE.sub(" ", html)
    return _WHITESPACE_RE.sub(" ", text).strip()


# --- EPUB -------------------------------------------------------------


def _first_dc(book, name: str) -> str:
    values = book.get_metadata("DC", name)
    return values[0][0] if values and values[0][0] else ""


def _all_dc(book, name: str) -> list[str]:
    return [v[0] for v in book.get_metadata("DC", name) if v[0]]


def _epub_isbn(book) -> str:
    from kindle_meta.isbn import is_valid, normalize

    for value, attrs in book.get_metadata("DC", "identifier"):
        if not value:
            continue
        scheme = ""
        if attrs:
            for key, val in attrs.items():
                if "scheme" in key.lower():
                    scheme = str(val)
                    break
        candidate = normalize(value)
        if "isbn" in scheme.lower() or is_valid(candidate):
            if is_valid(candidate):
                return candidate
    return ""


def _epub_series(book) -> tuple[str, float | None]:
    series = ""
    series_index = None
    for _value, attrs in book.get_metadata("OPF", "meta"):
        if not attrs:
            continue
        name = attrs.get("name")
        if name == "calibre:series":
            series = attrs.get("content", "") or ""
        elif name == "calibre:series_index":
            content = attrs.get("content")
            if content:
                try:
                    series_index = float(content)
                except ValueError:
                    series_index = None
    return series, series_index


def _epub_cover(book):
    import ebooklib

    items = list(book.get_items())
    for item in items:
        if item.get_type() == ebooklib.ITEM_COVER:
            return item.get_content(), item.media_type

    cover_id = None
    for _value, attrs in book.get_metadata("OPF", "meta"):
        if attrs and attrs.get("name") == "cover":
            cover_id = attrs.get("content")
            break
    if cover_id:
        for item in items:
            if item.get_id() == cover_id:
                return item.get_content(), item.media_type

    image_items = sorted(
        (item for item in items if item.get_type() == ebooklib.ITEM_IMAGE),
        key=lambda item: item.file_name,
    )
    for item in image_items:
        if "cover" in item.file_name.lower():
            return item.get_content(), item.media_type

    return None, ""


def _epub_sample_text(book) -> str:
    import ebooklib

    parts: list[str] = []
    total = 0
    for item in book.get_items():
        if item.get_type() != ebooklib.ITEM_DOCUMENT:
            continue
        text = _clean_html(item.get_content().decode("utf-8", errors="ignore"))
        if not text:
            continue
        parts.append(text)
        total += len(text)
        if total >= SAMPLE_CHARS:
            break
    return " ".join(parts)[:SAMPLE_CHARS]


def _read_epub(path: str) -> BookMetadata:
    from ebooklib import epub

    book = epub.read_epub(path, options={"ignore_ncx": True})
    meta = BookMetadata(source_path=path)
    meta.title = _first_dc(book, "title")
    meta.authors = _all_dc(book, "creator")
    meta.publisher = _first_dc(book, "publisher")
    meta.published = _first_dc(book, "date")
    meta.language = _first_dc(book, "language")
    meta.description = _first_dc(book, "description")
    meta.subjects = _all_dc(book, "subject")
    meta.isbn = _epub_isbn(book)
    meta.series, meta.series_index = _epub_series(book)
    cover, mime = _epub_cover(book)
    meta.cover = cover
    meta.cover_mime = mime or ""
    meta.sample_text = _epub_sample_text(book)
    return meta


# --- PDF ----------------------------------------------------------------

_PDF_AUTHOR_SPLIT_RE = re.compile(r"\s*(?:;|&|\band\b|\bund\b)\s*", re.IGNORECASE)


def _split_pdf_authors(raw: str) -> list[str]:
    return [p.strip() for p in _PDF_AUTHOR_SPLIT_RE.split(raw) if p.strip()]


def _read_pdf(path: str) -> BookMetadata:
    from pypdf import PdfReader

    reader = PdfReader(path)
    meta = BookMetadata(source_path=path)
    info = reader.metadata
    if info is not None:
        meta.title = info.title or ""
        if info.author:
            meta.authors = _split_pdf_authors(info.author)
        creation_date = info.creation_date
        if creation_date:
            meta.published = creation_date.date().isoformat()
    meta.page_count = len(reader.pages)
    text_parts = []
    for page in reader.pages[:5]:
        try:
            text_parts.append(page.extract_text() or "")
        except Exception:  # noqa: BLE001 - defekte PDF-Seiten überspringen
            continue
    meta.sample_text = "\n".join(text_parts).strip()[:SAMPLE_CHARS]
    return meta


# --- FB2 ------------------------------------------------------------------


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _first_local(elem, name: str):
    for child in elem.iter():
        if child is not elem and _local(child.tag) == name:
            return child
    return None


def _all_local(elem, name: str) -> list:
    return [child for child in elem.iter() if child is not elem and _local(child.tag) == name]


def _text(elem) -> str:
    if elem is None or not elem.text:
        return ""
    return elem.text.strip()


def _join_text(elem) -> str:
    return _WHITESPACE_RE.sub(" ", "".join(elem.itertext())).strip()


def _fb2_author_name(author_elem) -> str:
    parts = []
    for name in ("first-name", "middle-name", "last-name"):
        value = _text(_first_local(author_elem, name))
        if value:
            parts.append(value)
    return " ".join(parts)


def _fb2_attr(elem, local_name: str) -> str | None:
    for key, value in elem.attrib.items():
        if _local(key) == local_name:
            return value
    return None


def _read_fb2(path: str) -> BookMetadata:
    tree = ET.parse(path)
    root = tree.getroot()
    meta = BookMetadata(source_path=path)

    title_info = _first_local(root, "title-info")
    if title_info is not None:
        meta.title = _text(_first_local(title_info, "book-title"))
        meta.authors = [_fb2_author_name(a) for a in _all_local(title_info, "author")]
        meta.authors = [a for a in meta.authors if a]
        meta.language = _text(_first_local(title_info, "lang"))
        meta.subjects = [g for g in (_text(g) for g in _all_local(title_info, "genre")) if g]
        annotation = _first_local(title_info, "annotation")
        if annotation is not None:
            meta.description = _join_text(annotation)

        cover_id = None
        coverpage = _first_local(title_info, "coverpage")
        if coverpage is not None:
            image = _first_local(coverpage, "image")
            if image is not None:
                href = _fb2_attr(image, "href")
                if href:
                    cover_id = href.lstrip("#")
        if cover_id:
            for binary in _all_local(root, "binary"):
                if binary.get("id") == cover_id:
                    meta.cover = base64.b64decode((binary.text or "").strip() or "")
                    meta.cover_mime = binary.get("content-type", "") or "image/jpeg"
                    break

    publish_info = _first_local(root, "publish-info")
    if publish_info is not None:
        meta.publisher = _text(_first_local(publish_info, "publisher"))
        meta.published = _text(_first_local(publish_info, "year"))
        isbn_text = _text(_first_local(publish_info, "isbn"))
        if isbn_text:
            meta.isbn = isbn_text

    body = _first_local(root, "body")
    if body is not None:
        meta.sample_text = _join_text(body)[:SAMPLE_CHARS]

    return meta


# --- CBZ/CBR (Comics) -----------------------------------------------------


def _comic_get(root, tag: str) -> str:
    elem = root.find(tag)
    return (elem.text or "").strip() if elem is not None and elem.text else ""


def _read_comic_archive(path: str, names: list[str], read_fn) -> BookMetadata:
    meta = BookMetadata(source_path=path)
    info_name = next((n for n in names if os.path.basename(n).lower() == "comicinfo.xml"), None)
    if info_name:
        root = ET.fromstring(read_fn(info_name))
        meta.title = _comic_get(root, "Title")
        meta.series = _comic_get(root, "Series")
        number = _comic_get(root, "Number")
        if number:
            try:
                meta.series_index = float(number)
            except ValueError:
                pass
        authors: list[str] = []
        for tag in ("Writer", "Penciller"):
            value = _comic_get(root, tag)
            if value:
                authors.extend(p.strip() for p in value.split(",") if p.strip())
        seen: set[str] = set()
        meta.authors = [a for a in authors if not (a in seen or seen.add(a))]
        meta.publisher = _comic_get(root, "Publisher")
        meta.published = _comic_get(root, "Year")
        meta.description = _comic_get(root, "Summary")
        meta.language = _comic_get(root, "LanguageISO")
        genre = _comic_get(root, "Genre")
        if genre:
            meta.subjects = [g.strip() for g in genre.split(",") if g.strip()]

    image_names = sorted(
        n for n in names if n.lower().endswith(_IMAGE_EXTS) and "__MACOSX" not in n
    )
    if image_names:
        cover_name = image_names[0]
        meta.cover = read_fn(cover_name)
        ext = os.path.splitext(cover_name)[1].lower().lstrip(".")
        meta.cover_mime = f"image/{'jpeg' if ext == 'jpg' else ext}"
    return meta


def _read_comic_zip(path: str) -> BookMetadata:
    with zipfile.ZipFile(path) as zf:
        return _read_comic_archive(path, zf.namelist(), zf.read)


def _read_comic_rar(path: str) -> BookMetadata:
    try:
        import rarfile
    except ImportError as exc:
        raise UnsupportedFormat(
            "CBR wird nur mit dem optionalen Paket 'rarfile' unterstützt "
            "(pip install kindle-meta[comics])."
        ) from exc
    with rarfile.RarFile(path) as rf:
        return _read_comic_archive(path, rf.namelist(), rf.read)
