"""Automatische Dubletten-Erkennung in der Bibliothek."""

from __future__ import annotations

from kindle_meta.isbn import normalize as normalize_isbn
from kindle_meta.matching import score
from kindle_meta.models import BookMetadata

DEFAULT_THRESHOLD = 0.85


def find_duplicate_groups(
    books: list[BookMetadata] | None = None, *, threshold: float = DEFAULT_THRESHOLD
) -> list[list[BookMetadata]]:
    """Gruppiert Bibliothekseinträge, die vermutlich dasselbe Buch sind.

    Zwei Einträge gelten als Dublette, wenn ihre ISBN exakt übereinstimmt
    oder ihr Ähnlichkeits-Score (`kindle_meta.matching.score`) den
    Schwellwert erreicht. Ohne `books` wird die gespeicherte Bibliothek
    gelesen.
    """
    if books is None:
        from kindle_meta.library import Library

        with Library() as lib:
            books = lib.all()

    groups: list[list[BookMetadata]] = []
    assigned: set[int] = set()
    for i, book in enumerate(books):
        if i in assigned:
            continue
        group = [book]
        for j in range(i + 1, len(books)):
            if j in assigned:
                continue
            if _is_duplicate(book, books[j], threshold=threshold):
                group.append(books[j])
                assigned.add(j)
        if len(group) > 1:
            assigned.add(i)
            groups.append(group)
    return groups


def _is_duplicate(a: BookMetadata, b: BookMetadata, *, threshold: float) -> bool:
    if a.isbn and b.isbn and normalize_isbn(a.isbn) == normalize_isbn(b.isbn):
        return True
    return score(a, b) >= threshold
