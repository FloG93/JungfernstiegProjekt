"""Anbindung an Calibres Kommandozeilenwerkzeuge `ebook-meta`/`ebook-convert`."""

from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from kindle_meta.models import BookMetadata


class CalibreNotFound(Exception):
    """Calibre (`ebook-meta`) ist nicht installiert oder nicht im PATH."""


def available() -> bool:
    return shutil.which("ebook-meta") is not None


def _require_calibre() -> None:
    if not available():
        raise CalibreNotFound(
            "Calibre wurde nicht gefunden. Bitte Calibre installieren, damit "
            "'ebook-meta' im PATH verfügbar ist."
        )


_SERIES_RE = re.compile(r"^(.*?)\s*(?:\[(\d+(?:\.\d+)?)\]|#(\d+(?:\.\d+)?))\s*$")


def parse_ebook_meta_output(text: str) -> dict[str, str]:
    """Parst die Ausgabe von `ebook-meta <datei>` (Zeilen "Key : Value",
    eingerückte Fortsetzungszeilen) in ein Dict.
    """
    result: dict[str, str] = {}
    current_key: str | None = None
    for line in text.splitlines():
        if not line.strip():
            continue
        if line[:1].isspace() and current_key:
            result[current_key] = f"{result[current_key]} {line.strip()}".strip()
            continue
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        key = key.strip()
        result[key] = value.strip()
        current_key = key
    return result


def _split_authors(raw: str) -> list[str]:
    without_sort_names = re.sub(r"\s*\[[^\]]*\]", "", raw)
    parts = re.split(r"\s*&\s*|\s*;\s*", without_sort_names)
    return [p.strip() for p in parts if p.strip()]


def _parse_series(raw: str) -> tuple[str, float | None]:
    match = _SERIES_RE.match(raw.strip())
    if not match:
        return raw.strip(), None
    index = match.group(2) or match.group(3)
    return match.group(1).strip(), float(index) if index else None


def read_metadata(path: str) -> BookMetadata:
    _require_calibre()
    with tempfile.TemporaryDirectory() as tmpdir:
        cover_path = str(Path(tmpdir) / "cover.jpg")
        result = subprocess.run(
            ["ebook-meta", path, "--get-cover", cover_path],
            capture_output=True,
            text=True,
            check=False,
        )
        parsed = parse_ebook_meta_output(result.stdout)

        meta = BookMetadata(source_path=path)
        meta.title = parsed.get("Title", "")
        authors_raw = parsed.get("Author(s)", "")
        if authors_raw:
            meta.authors = _split_authors(authors_raw)
        meta.publisher = parsed.get("Publisher", "")
        published = parsed.get("Published", "")
        if published:
            meta.published = published.split("T")[0].split(" ")[0]
        meta.language = parsed.get("Languages", "") or parsed.get("Language", "")
        meta.description = parsed.get("Comments", "")

        for identifier in parsed.get("Identifiers", "").split(","):
            identifier = identifier.strip()
            if identifier.lower().startswith("isbn:"):
                meta.isbn = identifier.split(":", 1)[1].strip()
                break

        series_raw = parsed.get("Series", "")
        if series_raw:
            meta.series, meta.series_index = _parse_series(series_raw)

        cover_file = Path(cover_path)
        if cover_file.exists() and cover_file.stat().st_size > 0:
            meta.cover = cover_file.read_bytes()
            meta.cover_mime = "image/jpeg"
        return meta


def build_write_args(meta: BookMetadata) -> list[str]:
    """Baut die `ebook-meta`-Argumente für das Schreiben von `meta`."""
    args: list[str] = []
    if meta.title:
        args += ["--title", meta.title]
    if meta.authors:
        args += ["--authors", " & ".join(meta.authors)]
    if meta.publisher:
        args += ["--publisher", meta.publisher]
    if meta.published:
        args += ["--date", meta.published]
    if meta.language:
        args += ["--language", meta.language]
    if meta.description:
        args += ["--comments", meta.description]
    if meta.subjects:
        args += ["--tags", ", ".join(meta.subjects)]
    if meta.isbn:
        args += ["--identifier", f"isbn:{meta.isbn}"]
    if meta.series:
        args += ["--series", meta.series]
        if meta.series_index is not None:
            index = meta.series_index
            index_str = str(int(index)) if float(index).is_integer() else str(index)
            args += ["--index", index_str]
    return args


def write_metadata(meta: BookMetadata, path: str) -> None:
    _require_calibre()
    args = ["ebook-meta", path, *build_write_args(meta)]
    cover_path: str | None = None
    if meta.has_cover():
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp.write(meta.cover)
            cover_path = tmp.name
        args += ["--cover", cover_path]
    try:
        subprocess.run(args, capture_output=True, text=True, check=True)
    finally:
        if cover_path:
            Path(cover_path).unlink(missing_ok=True)


def convert(src: str, out_ext: str = "azw3") -> str:
    _require_calibre()
    out_path = str(Path(src).with_suffix(f".{out_ext}"))
    subprocess.run(["ebook-convert", src, out_path], capture_output=True, text=True, check=True)
    return out_path
