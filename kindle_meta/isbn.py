"""Erkennung und Validierung von ISBN-10/13."""

from __future__ import annotations

import re

_NON_ISBN_CHARS = re.compile(r"[^0-9Xx]")
_ISBN_CANDIDATE = re.compile(r"(?<![0-9Xx-])[0-9][0-9Xx\- ]{8,15}[0-9Xx](?![0-9Xx-])")


def normalize(value: str) -> str:
    """Entfernt alles außer Ziffern und X, wandelt X in Großbuchstaben."""
    return _NON_ISBN_CHARS.sub("", value or "").upper()


def is_valid_isbn10(value: str) -> bool:
    isbn = normalize(value)
    if len(isbn) != 10 or not isbn[:9].isdigit():
        return False
    if not (isbn[9].isdigit() or isbn[9] == "X"):
        return False
    total = 0
    for i, ch in enumerate(isbn):
        digit = 10 if ch == "X" else int(ch)
        total += (10 - i) * digit
    return total % 11 == 0


def is_valid_isbn13(value: str) -> bool:
    isbn = normalize(value)
    if len(isbn) != 13 or not isbn.isdigit():
        return False
    total = sum(int(d) * (1 if i % 2 == 0 else 3) for i, d in enumerate(isbn))
    return total % 10 == 0


def is_valid(value: str) -> bool:
    return is_valid_isbn10(value) or is_valid_isbn13(value)


def find_isbn(text: str) -> str | None:
    """Sucht im Text nach einer gültigen ISBN. ISBN-13 wird bevorzugt."""
    if not text:
        return None
    found_10: list[str] = []
    found_13: list[str] = []
    for match in _ISBN_CANDIDATE.finditer(text):
        candidate = normalize(match.group(0))
        if len(candidate) == 13 and is_valid_isbn13(candidate):
            found_13.append(candidate)
        elif len(candidate) == 10 and is_valid_isbn10(candidate):
            found_10.append(candidate)
    if found_13:
        return found_13[0]
    if found_10:
        return found_10[0]
    return None
