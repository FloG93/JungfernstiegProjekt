"""Metadaten-Suche über Online-Quellen: Google Books, Open Library, DNB, Apple Books.

Alle öffentlichen Suchfunktionen geben bei Netzwerk- oder Parserfehlern eine
leere Liste zurück, nie eine Exception – ein Ausfall einer Quelle darf die
übrigen nicht verhindern.

Bewusst nicht integriert: Amazon (keine offene API, Scraping gegen AGB),
WorldCat (freie API eingestellt).
"""

from __future__ import annotations

import re
from xml.etree import ElementTree as ET

from kindle_meta.models import BookMetadata

_TIMEOUT = 15

_LANG_MAP = {
    "ger": "de",
    "deu": "de",
    "eng": "en",
    "fre": "fr",
    "fra": "fr",
    "spa": "es",
    "ita": "it",
    "dut": "nl",
    "nld": "nl",
    "por": "pt",
}


def _lang2(code: str) -> str:
    if not code:
        return ""
    code = code.lower()
    if len(code) == 2:
        return code
    return _LANG_MAP.get(code, "")


def _fetch_cover(url: str) -> tuple[bytes, str] | None:
    import requests

    try:
        resp = requests.get(url, timeout=_TIMEOUT)
        resp.raise_for_status()
        if not resp.content:
            return None
        return resp.content, resp.headers.get("Content-Type", "image/jpeg")
    except Exception:  # noqa: BLE001 - Netzwerkfehler nie eskalieren
        return None


# --- Google Books -----------------------------------------------------


def search_google_books(
    query: str,
    *,
    max_results: int = 5,
    language: str | None = None,
    fetch_covers: bool = True,
) -> list[BookMetadata]:
    import requests

    params = {"q": query, "maxResults": max_results}
    if language:
        params["langRestrict"] = language
    try:
        resp = requests.get(
            "https://www.googleapis.com/books/v1/volumes", params=params, timeout=_TIMEOUT
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception:  # noqa: BLE001
        return []
    return parse_google_books(data, fetch_covers=fetch_covers)


def parse_google_books(data: dict, *, fetch_covers: bool = True) -> list[BookMetadata]:
    results = []
    for item in data.get("items") or []:
        info = item.get("volumeInfo") or {}
        meta = BookMetadata()
        meta.title = info.get("title", "") or ""
        meta.authors = info.get("authors") or []
        meta.publisher = info.get("publisher", "") or ""
        meta.published = info.get("publishedDate", "") or ""
        meta.description = info.get("description", "") or ""
        meta.subjects = info.get("categories") or []
        meta.page_count = info.get("pageCount", 0) or 0
        meta.language = _lang2(info.get("language", ""))

        isbn13 = isbn10 = ""
        for ident in info.get("industryIdentifiers") or []:
            if ident.get("type") == "ISBN_13":
                isbn13 = ident.get("identifier", "")
            elif ident.get("type") == "ISBN_10":
                isbn10 = ident.get("identifier", "")
        meta.isbn = isbn13 or isbn10

        image_links = info.get("imageLinks") or {}
        thumbnail = image_links.get("thumbnail") or image_links.get("smallThumbnail")
        if fetch_covers and thumbnail:
            cover = _fetch_cover(thumbnail.replace("http://", "https://"))
            if cover:
                meta.cover, meta.cover_mime = cover
        results.append(meta)
    return results


# --- Open Library -----------------------------------------------------


def search_open_library(
    query: str, *, max_results: int = 5, fetch_covers: bool = True
) -> list[BookMetadata]:
    import requests

    try:
        resp = requests.get(
            "https://openlibrary.org/search.json",
            params={"q": query, "limit": max_results},
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception:  # noqa: BLE001
        return []
    return parse_open_library(data, max_results=max_results, fetch_covers=fetch_covers)


def parse_open_library(
    data: dict, *, max_results: int = 5, fetch_covers: bool = True
) -> list[BookMetadata]:
    results = []
    for doc in (data.get("docs") or [])[:max_results]:
        meta = BookMetadata()
        meta.title = doc.get("title", "") or ""
        meta.authors = doc.get("author_name") or []
        publishers = doc.get("publisher") or []
        meta.publisher = publishers[0] if publishers else ""
        published = doc.get("first_publish_year")
        meta.published = str(published) if published else ""
        isbns = doc.get("isbn") or []
        meta.isbn = isbns[0] if isbns else ""
        languages = doc.get("language") or []
        meta.language = languages[0] if languages else ""
        meta.subjects = (doc.get("subject") or [])[:10]

        cover_id = doc.get("cover_i")
        if fetch_covers and cover_id:
            cover = _fetch_cover(f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg")
            if cover:
                meta.cover, meta.cover_mime = cover
        results.append(meta)
    return results


# --- DNB (SRU/OAI-DC) -----------------------------------------------------


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _elem_text(elem) -> str:
    return (elem.text or "").strip() if elem is not None else ""


def search_dnb(query: str, *, max_results: int = 5) -> list[BookMetadata]:
    import requests

    try:
        resp = requests.get(
            "https://services.dnb.de/sru/dnb",
            params={
                "version": "1.1",
                "operation": "searchRetrieve",
                "query": f'WOE="{query}"',
                "recordSchema": "oai_dc",
                "maximumRecords": max_results,
            },
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
    except Exception:  # noqa: BLE001
        return []
    return parse_dnb_oai_dc(resp.text)


def parse_dnb_oai_dc(xml_text: str) -> list[BookMetadata]:
    """Parst eine DNB-SRU-Antwort im `oai_dc`-Schema."""
    from kindle_meta.isbn import is_valid, normalize

    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []

    results = []
    for record in root.iter():
        if _local(record.tag) != "dc":
            continue
        meta = BookMetadata()
        for child in record:
            local_name = _local(child.tag)
            text = _elem_text(child)
            if not text:
                continue
            if local_name == "title" and not meta.title:
                meta.title = text
            elif local_name == "creator":
                name = re.sub(r"\s*\[[^\]]*\]\s*", "", text).strip()
                if name:
                    meta.authors.append(name)
            elif local_name == "publisher" and not meta.publisher:
                meta.publisher = text
            elif local_name == "date" and not meta.published:
                meta.published = text
            elif local_name == "language" and not meta.language:
                meta.language = _lang2(text)
            elif local_name == "identifier" and not meta.isbn:
                candidate = normalize(text)
                if is_valid(candidate):
                    meta.isbn = candidate
        results.append(meta)
    return results


# --- Apple Books (iTunes Search API) ---------------------------------------


def search_apple_books(
    query: str, *, max_results: int = 5, fetch_covers: bool = True
) -> list[BookMetadata]:
    import requests

    try:
        resp = requests.get(
            "https://itunes.apple.com/search",
            params={
                "term": query,
                "media": "ebook",
                "entity": "ebook",
                "limit": max_results,
            },
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception:  # noqa: BLE001
        return []
    return parse_apple_json(data, fetch_covers=fetch_covers)


def parse_apple_json(data: dict, *, fetch_covers: bool = True) -> list[BookMetadata]:
    results = []
    for item in data.get("results") or []:
        meta = BookMetadata()
        meta.title = item.get("trackName", "") or ""
        artist = item.get("artistName", "")
        meta.authors = [artist] if artist else []
        meta.description = item.get("description", "") or ""
        release_date = item.get("releaseDate", "") or ""
        meta.published = release_date[:10] if release_date else ""
        meta.subjects = item.get("genres") or []

        artwork = item.get("artworkUrl100")
        if fetch_covers and artwork:
            cover = _fetch_cover(artwork.replace("100x100bb", "600x600bb"))
            if cover:
                meta.cover, meta.cover_mime = cover
        results.append(meta)
    return results


# --- Kombinierte Suche ------------------------------------------------------


def search(
    query: str,
    *,
    max_results: int = 5,
    fetch_covers: bool = True,
    language: str | None = None,
) -> list[BookMetadata]:
    """Durchsucht alle vier Quellen und gibt die zusammengeführte Trefferliste zurück."""
    results: list[BookMetadata] = []
    results += search_google_books(
        query, max_results=max_results, language=language, fetch_covers=fetch_covers
    )
    results += search_open_library(query, max_results=max_results, fetch_covers=fetch_covers)
    results += search_dnb(query, max_results=max_results)
    results += search_apple_books(query, max_results=max_results, fetch_covers=fetch_covers)
    return results


def search_by_isbn(isbn: str) -> list[BookMetadata]:
    """Gezielte ISBN-Suche: erst Google Books, dann Open Library."""
    results = search_google_books(f"isbn:{isbn}", max_results=5)
    if results:
        return results
    return search_open_library(isbn, max_results=5)
