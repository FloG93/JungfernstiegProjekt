"""Ähnlichkeits-Score und Ranking von Metadaten-Vorschlägen."""

from __future__ import annotations

import re
from difflib import SequenceMatcher

from kindle_meta.isbn import normalize as normalize_isbn
from kindle_meta.models import BookMetadata

_WHITESPACE_RE = re.compile(r"\s+")


def _normalize(value: str) -> str:
    return _WHITESPACE_RE.sub(" ", (value or "").strip().lower())


def similarity(a: str, b: str) -> float:
    """Normalisierte Ähnlichkeit zweier Strings (0.0-1.0), leer -> 0."""
    na, nb = _normalize(a), _normalize(b)
    if not na or not nb:
        return 0.0
    return SequenceMatcher(None, na, nb).ratio()


def score(reference: BookMetadata, candidate: BookMetadata) -> float:
    """Bewertet, wie gut `candidate` zu `reference` passt."""
    total = 0.0
    if reference.title or reference.author_str:
        total += 0.6 * similarity(reference.title, candidate.title)
        total += 0.3 * similarity(reference.author_str, candidate.author_str)
    if candidate.publisher:
        total += 0.03
    if candidate.published:
        total += 0.03
    if candidate.isbn:
        total += 0.03
    if candidate.has_cover():
        total += 0.03
    if candidate.page_count:
        total += 0.03
    if (
        reference.isbn
        and candidate.isbn
        and normalize_isbn(reference.isbn) == normalize_isbn(candidate.isbn)
    ):
        total += 0.5
    return total


def rank(reference: BookMetadata, candidates: list[BookMetadata]) -> list[BookMetadata]:
    """Sortiert `candidates` absteigend nach `score`."""
    return sorted(candidates, key=lambda c: score(reference, c), reverse=True)
