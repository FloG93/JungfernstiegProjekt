"""Serien-Konsistenzprüfung über die Bibliothek."""

from __future__ import annotations

from dataclasses import dataclass, field

from kindle_meta.models import BookMetadata


@dataclass
class SeriesIssue:
    series: str
    kind: str  # "missing_index" | "duplicate_index" | "gap"
    message: str
    books: list[BookMetadata] = field(default_factory=list)


def check_series_consistency(books: list[BookMetadata] | None = None) -> list[SeriesIssue]:
    """Findet fehlende/doppelte Bandnummern und Lücken je Serie."""
    if books is None:
        from kindle_meta.library import Library

        with Library() as lib:
            books = lib.all()

    by_series: dict[str, list[BookMetadata]] = {}
    for book in books:
        if book.series:
            by_series.setdefault(book.series, []).append(book)

    issues: list[SeriesIssue] = []
    for series_name, entries in by_series.items():
        issues.extend(_missing_index_issues(series_name, entries))
        indexed = [b for b in entries if b.series_index is not None]
        issues.extend(_duplicate_index_issues(series_name, indexed))
        issues.extend(_gap_issues(series_name, indexed))
    return issues


def _missing_index_issues(series_name: str, entries: list[BookMetadata]) -> list[SeriesIssue]:
    missing = [b for b in entries if b.series_index is None]
    if not missing:
        return []
    return [
        SeriesIssue(
            series=series_name,
            kind="missing_index",
            message=f"{len(missing)} Buch/Bücher in '{series_name}' ohne Bandnummer.",
            books=missing,
        )
    ]


def _duplicate_index_issues(
    series_name: str, indexed: list[BookMetadata]
) -> list[SeriesIssue]:
    by_index: dict[float, list[BookMetadata]] = {}
    for book in indexed:
        by_index.setdefault(book.series_index, []).append(book)
    issues = []
    for index, books_at_index in sorted(by_index.items()):
        if len(books_at_index) > 1:
            issues.append(
                SeriesIssue(
                    series=series_name,
                    kind="duplicate_index",
                    message=f"Band {index:g} in '{series_name}' ist mehrfach vergeben.",
                    books=books_at_index,
                )
            )
    return issues


def _gap_issues(series_name: str, indexed: list[BookMetadata]) -> list[SeriesIssue]:
    integer_values = sorted(
        {int(b.series_index) for b in indexed if float(b.series_index).is_integer()}
    )
    if not integer_values:
        return []
    issues = []
    expected = integer_values[0]
    for value in integer_values:
        while expected < value:
            issues.append(
                SeriesIssue(
                    series=series_name,
                    kind="gap",
                    message=f"Band {expected} in '{series_name}' fehlt.",
                    books=[],
                )
            )
            expected += 1
        expected = value + 1
    return issues


def known_books_payload(entries: list[BookMetadata]) -> list[dict]:
    """Baut die kompakte `known_books`-Liste für `llm.suggest_series_index`."""
    return [
        {"title": b.title, "series_index": b.series_index}
        for b in entries
        if b.series_index is not None
    ]
