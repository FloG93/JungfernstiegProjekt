"""SQLite-Bibliothek: Übersicht aller bearbeiteten Bücher inkl. Thumbnails."""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass, fields
from datetime import datetime, timezone

from kindle_meta.config import library_path
from kindle_meta.covers import thumbnail as make_thumbnail
from kindle_meta.models import BookMetadata

STATUS_IMPORTED = "imported"
STATUS_ENRICHED = "enriched"
STATUS_WRITTEN = "written"
STATUS_SENT = "sent"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS books (
    path TEXT PRIMARY KEY,
    title TEXT,
    authors TEXT,
    publisher TEXT,
    published TEXT,
    isbn TEXT,
    language TEXT,
    series TEXT,
    series_index REAL,
    page_count INTEGER,
    has_cover INTEGER,
    status TEXT,
    updated_at TEXT
)
"""


@dataclass
class LibraryFilter:
    """Typisierter Suchfilter für die Bibliothek (kein von der KI erzeugtes
    SQL - nur diese festen, über parametrisierte Queries angewendeten
    Felder).
    """

    text: str = ""
    missing_cover: bool | None = None
    status: str | None = None
    series: str | None = None
    year_from: int | None = None
    year_to: int | None = None
    language: str | None = None

    @classmethod
    def from_dict(cls, data: dict) -> LibraryFilter:
        allowed = {f.name for f in fields(cls)}
        kwargs = {key: value for key, value in (data or {}).items() if key in allowed}
        return cls(**kwargs)


def build_filter_from_query(query: str) -> LibraryFilter:
    """Baut einen `LibraryFilter` aus einer (ggf. natürlichsprachigen)
    Anfrage. Nutzt bei verfügbarer KI `llm.parse_library_query`; ohne KI
    oder bei einem Fehler dabei fällt es auf eine reine Substring-Suche
    über `text` zurück.
    """
    from kindle_meta import llm

    data = llm.parse_library_query(query)
    if data:
        return LibraryFilter.from_dict(data)
    return LibraryFilter(text=query)


def _row_to_meta(row: sqlite3.Row) -> BookMetadata:
    authors = json.loads(row["authors"]) if row["authors"] else []
    return BookMetadata(
        title=row["title"] or "",
        authors=authors,
        publisher=row["publisher"] or "",
        published=row["published"] or "",
        language=row["language"] or "",
        isbn=row["isbn"] or "",
        series=row["series"] or "",
        series_index=row["series_index"],
        page_count=row["page_count"] or 0,
        source_path=row["path"] or "",
    )


class Library:
    """SQLite-gestützte Bibliothek. Nutzbar als Kontextmanager."""

    def __init__(self, db_path: str | None = None):
        self._path = db_path or str(library_path())
        self._conn = sqlite3.connect(self._path)
        self._conn.row_factory = sqlite3.Row
        self._migrate()

    def _migrate(self) -> None:
        self._conn.execute(_SCHEMA)
        columns = {row[1] for row in self._conn.execute("PRAGMA table_info(books)")}
        if "thumbnail" not in columns:
            self._conn.execute("ALTER TABLE books ADD COLUMN thumbnail BLOB")
        self._conn.commit()

    def close(self) -> None:
        self._conn.close()

    def __enter__(self) -> Library:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def upsert(self, meta: BookMetadata, status: str = STATUS_IMPORTED) -> None:
        thumb = None
        if meta.has_cover():
            try:
                thumb = make_thumbnail(meta.cover)
            except Exception:  # noqa: BLE001 - defekte Cover nie fatal
                thumb = None
        if thumb is None:
            row = self._conn.execute(
                "SELECT thumbnail FROM books WHERE path = ?", (meta.source_path,)
            ).fetchone()
            if row is not None:
                thumb = row["thumbnail"]

        self._conn.execute(
            """
            INSERT INTO books (
                path, title, authors, publisher, published, isbn, language,
                series, series_index, page_count, has_cover, thumbnail,
                status, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(path) DO UPDATE SET
                title=excluded.title,
                authors=excluded.authors,
                publisher=excluded.publisher,
                published=excluded.published,
                isbn=excluded.isbn,
                language=excluded.language,
                series=excluded.series,
                series_index=excluded.series_index,
                page_count=excluded.page_count,
                has_cover=excluded.has_cover,
                thumbnail=excluded.thumbnail,
                status=excluded.status,
                updated_at=excluded.updated_at
            """,
            (
                meta.source_path,
                meta.title,
                json.dumps(meta.authors, ensure_ascii=False),
                meta.publisher,
                meta.published,
                meta.isbn,
                meta.language,
                meta.series,
                meta.series_index,
                meta.page_count,
                1 if meta.has_cover() else 0,
                thumb,
                status,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        self._conn.commit()

    def set_status(self, path: str, status: str) -> None:
        self._conn.execute(
            "UPDATE books SET status = ?, updated_at = ? WHERE path = ?",
            (status, datetime.now(timezone.utc).isoformat(), path),
        )
        self._conn.commit()

    def remove(self, path: str) -> None:
        self._conn.execute("DELETE FROM books WHERE path = ?", (path,))
        self._conn.commit()

    def get(self, path: str) -> BookMetadata | None:
        row = self._conn.execute("SELECT * FROM books WHERE path = ?", (path,)).fetchone()
        return _row_to_meta(row) if row is not None else None

    def get_status(self, path: str) -> str | None:
        row = self._conn.execute("SELECT status FROM books WHERE path = ?", (path,)).fetchone()
        return row["status"] if row is not None else None

    def all(self) -> list[BookMetadata]:
        rows = self._conn.execute("SELECT * FROM books ORDER BY updated_at DESC").fetchall()
        return [_row_to_meta(row) for row in rows]

    def count(self) -> int:
        return self._conn.execute("SELECT COUNT(*) FROM books").fetchone()[0]

    def get_thumbnail(self, path: str) -> bytes | None:
        row = self._conn.execute(
            "SELECT thumbnail FROM books WHERE path = ?", (path,)
        ).fetchone()
        return row["thumbnail"] if row is not None else None

    def search(self, query_filter: LibraryFilter) -> list[BookMetadata]:
        """Wendet `query_filter` über parametrisierte Queries an."""
        sql = "SELECT * FROM books WHERE 1=1"
        params: list[object] = []
        if query_filter.text:
            sql += " AND (title LIKE ? OR authors LIKE ? OR series LIKE ?)"
            like = f"%{query_filter.text}%"
            params += [like, like, like]
        if query_filter.missing_cover is True:
            sql += " AND has_cover = 0"
        elif query_filter.missing_cover is False:
            sql += " AND has_cover = 1"
        if query_filter.status:
            sql += " AND status = ?"
            params.append(query_filter.status)
        if query_filter.series:
            sql += " AND series LIKE ?"
            params.append(f"%{query_filter.series}%")
        if query_filter.year_from:
            sql += " AND CAST(substr(published, 1, 4) AS INTEGER) >= ?"
            params.append(query_filter.year_from)
        if query_filter.year_to:
            sql += " AND CAST(substr(published, 1, 4) AS INTEGER) <= ?"
            params.append(query_filter.year_to)
        if query_filter.language:
            sql += " AND language = ?"
            params.append(query_filter.language)
        sql += " ORDER BY updated_at DESC"
        rows = self._conn.execute(sql, params).fetchall()
        return [_row_to_meta(row) for row in rows]
