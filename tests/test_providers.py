from __future__ import annotations

import requests

from kindle_meta import providers

GOOGLE_BOOKS_RESPONSE = {
    "items": [
        {
            "volumeInfo": {
                "title": "Die Beispielreise",
                "authors": ["Anna Musterfrau"],
                "publisher": "Testverlag",
                "publishedDate": "2021-05-01",
                "description": "Eine Beschreibung",
                "categories": ["Fiction"],
                "pageCount": 320,
                "language": "de",
                "industryIdentifiers": [
                    {"type": "ISBN_10", "identifier": "1160959676"},
                    {"type": "ISBN_13", "identifier": "9783161484100"},
                ],
                "imageLinks": {"thumbnail": "http://books.google.com/cover.jpg"},
            }
        }
    ]
}

OPEN_LIBRARY_RESPONSE = {
    "docs": [
        {
            "title": "Die Beispielreise",
            "author_name": ["Anna Musterfrau"],
            "publisher": ["Testverlag"],
            "first_publish_year": 2021,
            "isbn": ["9783161484100"],
            "language": ["ger"],
            "subject": ["Fiction", "Adventure"],
            "cover_i": 12345,
        }
    ]
}

DNB_RESPONSE = """<?xml version="1.0" encoding="UTF-8"?>
<searchRetrieveResponse xmlns="http://www.loc.gov/zing/srw/">
  <records>
    <record>
      <recordData>
        <oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/"
                    xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>Die Beispielreise</dc:title>
          <dc:creator>Musterfrau, Anna [Verfasser]</dc:creator>
          <dc:publisher>Testverlag</dc:publisher>
          <dc:date>2021</dc:date>
          <dc:language>ger</dc:language>
          <dc:identifier>9783161484100</dc:identifier>
          <dc:identifier>(DE-101)999999999</dc:identifier>
        </oai_dc:dc>
      </recordData>
    </record>
  </records>
</searchRetrieveResponse>
"""

APPLE_RESPONSE = {
    "results": [
        {
            "trackName": "Die Beispielreise",
            "artistName": "Anna Musterfrau",
            "description": "Eine Beschreibung",
            "releaseDate": "2021-05-01T07:00:00Z",
            "genres": ["Fiction"],
            "artworkUrl100": "https://example.com/100x100bb.jpg",
        }
    ]
}


class _FakeResponse:
    def __init__(self, json_data=None, text_data="", status_code=200, content=b"", headers=None):
        self._json_data = json_data
        self.text = text_data
        self.status_code = status_code
        self.content = content
        self.headers = headers or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"HTTP {self.status_code}")

    def json(self):
        return self._json_data


def test_search_google_books_parses_response(monkeypatch):
    monkeypatch.setattr(
        requests, "get", lambda url, params=None, timeout=None: _FakeResponse(GOOGLE_BOOKS_RESPONSE)
    )
    results = providers.search_google_books("Die Beispielreise", fetch_covers=False)
    assert len(results) == 1
    meta = results[0]
    assert meta.title == "Die Beispielreise"
    assert meta.authors == ["Anna Musterfrau"]
    assert meta.isbn == "9783161484100"  # ISBN-13 bevorzugt
    assert meta.language == "de"


def test_search_google_books_returns_empty_on_network_error(monkeypatch):
    def _raise(*args, **kwargs):
        raise requests.ConnectionError("kein Netz")

    monkeypatch.setattr(requests, "get", _raise)
    assert providers.search_google_books("irgendwas") == []


def test_search_google_books_returns_empty_on_http_error(monkeypatch):
    monkeypatch.setattr(
        requests, "get", lambda *a, **k: _FakeResponse(status_code=429)
    )
    assert providers.search_google_books("irgendwas") == []


def test_search_open_library_parses_response(monkeypatch):
    monkeypatch.setattr(requests, "get", lambda *a, **k: _FakeResponse(OPEN_LIBRARY_RESPONSE))
    results = providers.search_open_library("Die Beispielreise", fetch_covers=False)
    assert len(results) == 1
    meta = results[0]
    assert meta.title == "Die Beispielreise"
    assert meta.publisher == "Testverlag"
    assert meta.isbn == "9783161484100"


def test_search_open_library_returns_empty_on_error(monkeypatch):
    def _raise(*a, **k):
        raise requests.Timeout()

    monkeypatch.setattr(requests, "get", _raise)
    assert providers.search_open_library("x") == []


def test_parse_dnb_oai_dc_strips_role_and_validates_isbn():
    results = providers.parse_dnb_oai_dc(DNB_RESPONSE)
    assert len(results) == 1
    meta = results[0]
    assert meta.title == "Die Beispielreise"
    assert meta.authors == ["Musterfrau, Anna"]
    assert meta.publisher == "Testverlag"
    assert meta.language == "de"
    # Die zweite Identifier-Nummer ist keine gültige ISBN und wird ignoriert.
    assert meta.isbn == "9783161484100"


def test_parse_dnb_oai_dc_returns_empty_on_invalid_xml():
    assert providers.parse_dnb_oai_dc("<nicht schließend>") == []


def test_search_dnb_returns_empty_on_network_error(monkeypatch):
    def _raise(*a, **k):
        raise requests.ConnectionError()

    monkeypatch.setattr(requests, "get", _raise)
    assert providers.search_dnb("x") == []


def test_parse_apple_json_maps_fields():
    results = providers.parse_apple_json(APPLE_RESPONSE, fetch_covers=False)
    assert len(results) == 1
    meta = results[0]
    assert meta.title == "Die Beispielreise"
    assert meta.authors == ["Anna Musterfrau"]
    assert meta.published == "2021-05-01"
    assert meta.subjects == ["Fiction"]
    assert meta.isbn == ""
    assert meta.publisher == ""


def test_search_apple_books_returns_empty_on_error(monkeypatch):
    def _raise(*a, **k):
        raise requests.ConnectionError()

    monkeypatch.setattr(requests, "get", _raise)
    assert providers.search_apple_books("x") == []


def test_fetch_cover_replaces_http_with_https_and_returns_bytes(monkeypatch):
    captured_urls = []

    def fake_get(url, timeout=None):
        captured_urls.append(url)
        return _FakeResponse(content=b"coverdata", headers={"Content-Type": "image/jpeg"})

    monkeypatch.setattr(requests, "get", fake_get)
    cover = providers._fetch_cover("https://example.com/cover.jpg")
    assert cover == (b"coverdata", "image/jpeg")


def test_fetch_cover_returns_none_on_error(monkeypatch):
    def _raise(*a, **k):
        raise requests.ConnectionError()

    monkeypatch.setattr(requests, "get", _raise)
    assert providers._fetch_cover("https://example.com/x.jpg") is None


def test_search_combines_all_four_sources(monkeypatch):
    def fake_get(url, params=None, timeout=None, **kwargs):
        if "googleapis" in url:
            return _FakeResponse(GOOGLE_BOOKS_RESPONSE)
        if "openlibrary" in url:
            return _FakeResponse(OPEN_LIBRARY_RESPONSE)
        if "dnb.de" in url:
            return _FakeResponse(text_data=DNB_RESPONSE)
        if "itunes.apple.com" in url:
            return _FakeResponse(APPLE_RESPONSE)
        raise AssertionError(f"Unerwartete URL: {url}")

    monkeypatch.setattr(requests, "get", fake_get)
    results = providers.search("Die Beispielreise", fetch_covers=False)
    assert len(results) == 4


def test_search_by_isbn_prefers_google_books(monkeypatch):
    monkeypatch.setattr(requests, "get", lambda *a, **k: _FakeResponse(GOOGLE_BOOKS_RESPONSE))
    results = providers.search_by_isbn("9783161484100")
    assert len(results) == 1
    assert results[0].title == "Die Beispielreise"


def test_search_by_isbn_falls_back_to_open_library(monkeypatch):
    def fake_get(url, params=None, timeout=None, **kwargs):
        if "googleapis" in url:
            return _FakeResponse({"items": []})
        return _FakeResponse(OPEN_LIBRARY_RESPONSE)

    monkeypatch.setattr(requests, "get", fake_get)
    results = providers.search_by_isbn("9783161484100")
    assert len(results) == 1
    assert results[0].publisher == "Testverlag"
