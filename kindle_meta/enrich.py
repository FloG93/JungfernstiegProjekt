"""Orchestrierung: liest, reichert an und liefert Vorschläge + Cover-Kandidaten."""

from __future__ import annotations

from dataclasses import dataclass
from dataclasses import replace as dataclass_replace
from pathlib import Path

from kindle_meta import isbn as isbn_module
from kindle_meta import lang as lang_module
from kindle_meta import llm, matching, providers
from kindle_meta.models import BookMetadata
from kindle_meta.readers import read_metadata


@dataclass
class CoverCandidate:
    label: str
    data: bytes
    mime: str


@dataclass
class EnrichmentResult:
    original: BookMetadata
    suggestions: list[BookMetadata]
    used_llm: bool

    @property
    def best(self) -> BookMetadata | None:
        return self.suggestions[0] if self.suggestions else None

    def best_with(self, protect: set[str] | None = None) -> BookMetadata | None:
        if not self.suggestions:
            return None
        return self.original.merged_with(self.suggestions[0], prefer_other=True, protect=protect)

    def cover_candidates(self) -> list[CoverCandidate]:
        candidates: list[CoverCandidate] = []
        seen: set[bytes] = set()
        if self.original.has_cover() and self.original.cover not in seen:
            candidates.append(
                CoverCandidate("Aus Datei", self.original.cover, self.original.cover_mime)
            )
            seen.add(self.original.cover)
        for i, suggestion in enumerate(self.suggestions):
            if suggestion.has_cover() and suggestion.cover not in seen:
                candidates.append(
                    CoverCandidate(f"Vorschlag {i + 1}", suggestion.cover, suggestion.cover_mime)
                )
                seen.add(suggestion.cover)
        return candidates


def build_query(meta: BookMetadata) -> str:
    """Baut die Suchanfrage: Titel + erster Autor, sonst erste 12 Wörter der Textprobe."""
    if meta.title:
        first_author = meta.authors[0] if meta.authors else ""
        return f"{meta.title} {first_author}".strip()
    words = (meta.sample_text or "").split()[:12]
    return " ".join(words)


def _apply_guessed(meta: BookMetadata, guessed: dict) -> BookMetadata:
    updates: dict[str, object] = {}
    for key in ("title", "publisher", "published", "isbn", "language"):
        value = guessed.get(key)
        if value and not getattr(meta, key):
            updates[key] = value
    authors = guessed.get("authors")
    if authors and not meta.authors:
        updates["authors"] = list(authors)
    return dataclass_replace(meta, **updates) if updates else meta


def enrich_metadata(
    original: BookMetadata, *, use_llm: bool = True, max_results: int = 5
) -> EnrichmentResult:
    """Reihenfolge: 1) ISBN aus Textprobe, 2) Sprache erkennen, 3) KI-
    Fallback nur wenn Titel oder Autor fehlt, 4) gezielte ISBN-Suche,
    5) kombinierte Suche, 6) nach Ähnlichkeit ranken.
    """
    meta = original
    used_llm = False

    found_isbn = isbn_module.find_isbn(meta.sample_text)
    if found_isbn and not meta.isbn:
        meta = dataclass_replace(meta, isbn=found_isbn)

    detected_lang = lang_module.detect(meta.sample_text)

    if use_llm and (not meta.title or not meta.author_str):
        guessed = llm.guess_metadata(meta.sample_text)
        if guessed:
            used_llm = True
            meta = _apply_guessed(meta, guessed)

    candidates: list[BookMetadata] = []
    if meta.isbn:
        candidates += providers.search_by_isbn(meta.isbn)
    query = build_query(meta)
    if query:
        candidates += providers.search(query, max_results=max_results, language=detected_lang)

    ranked = matching.rank(meta, candidates)
    return EnrichmentResult(original=meta, suggestions=ranked, used_llm=used_llm)


def enrich_file(path: str, *, use_llm: bool = True, max_results: int = 5) -> EnrichmentResult:
    original = read_metadata(path)
    return enrich_metadata(original, use_llm=use_llm, max_results=max_results)


@dataclass
class BatchOutcome:
    path: str
    result: EnrichmentResult | None
    written_to: str | None
    error: str | None

    @property
    def ok(self) -> bool:
        return self.error is None


def enrich_batch(
    paths: list[str],
    *,
    apply: bool = False,
    out_dir: str | None = None,
    use_llm: bool = True,
    max_results: int = 5,
    optimize_cover: bool = False,
    backup: bool = False,
    protect: set[str] | None = None,
    progress=None,
    should_cancel=None,
) -> list[BatchOutcome]:
    """Reichert mehrere Dateien nacheinander an. Fehler einzelner Dateien
    stoppen den Stapel nicht; geschrieben wird nur bei ≥ 1 Vorschlag.
    """
    from kindle_meta.writers import write_metadata

    outcomes: list[BatchOutcome] = []
    total = len(paths)
    for i, path in enumerate(paths):
        if should_cancel and should_cancel():
            break
        error: str | None = None
        written_to: str | None = None
        result: EnrichmentResult | None = None
        try:
            result = enrich_file(path, use_llm=use_llm, max_results=max_results)
            if apply and result.suggestions:
                final_meta = result.best_with(protect)
                out_path = str(Path(out_dir) / Path(path).name) if out_dir else None
                written_to = write_metadata(
                    final_meta, out_path, optimize_cover=optimize_cover, backup=backup
                )
        except Exception as exc:  # noqa: BLE001 - ein Fehler stoppt nicht den Stapel
            error = str(exc)
        outcome = BatchOutcome(path=path, result=result, written_to=written_to, error=error)
        outcomes.append(outcome)
        if progress:
            progress(i, total, path, outcome)
    return outcomes
