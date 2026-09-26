from __future__ import annotations

from kindle_meta.isbn import find_isbn, is_valid, is_valid_isbn10, is_valid_isbn13, normalize


def test_normalize_strips_non_isbn_chars():
    assert normalize("978-3-16-148410-0") == "9783161484100"
    assert normalize("1-160-95967-6") == "1160959676"


def test_isbn10_edge_cases_are_valid():
    # Mathematische Sonderfälle: 0000000000 und 1160959676 sind gültige ISBN-10.
    assert is_valid_isbn10("0000000000") is True
    assert is_valid_isbn10("1160959676") is True


def test_isbn10_invalid_examples():
    assert is_valid_isbn10("1234567890") is False
    assert is_valid_isbn10("1160959677") is False


def test_isbn13_valid_and_invalid():
    assert is_valid_isbn13("9783161484100") is True
    assert is_valid_isbn13("9783161484101") is False


def test_is_valid_accepts_either_length():
    assert is_valid("1160959676") is True
    assert is_valid("9783161484100") is True
    assert is_valid("1234567890") is False


def test_find_isbn_prefers_isbn13_over_isbn10():
    text = "Diese Ausgabe hat ISBN-10 1160959676, aktuell ISBN 978-3-16-148410-0."
    assert find_isbn(text) == "9783161484100"


def test_find_isbn_finds_isbn10_when_no_isbn13_present():
    text = "Alte Ausgabe, ISBN 1160959676, siehe Impressum."
    assert find_isbn(text) == "1160959676"


def test_find_isbn_returns_none_when_nothing_valid():
    assert find_isbn("Hier steht keine gültige Nummer, nur 1234567890.") is None
    assert find_isbn("") is None
    assert find_isbn(None) is None
