from __future__ import annotations

from kindle_meta import enrich, providers
from kindle_meta.models import BookMetadata


def test_build_query_prefers_title_and_first_author():
    meta = BookMetadata(title="Die Beispielreise", authors=["Anna Musterfrau", "Zweiter Autor"])
    assert enrich.build_query(meta) == "Die Beispielreise Anna Musterfrau"


def test_build_query_falls_back_to_sample_text_words():
    meta = BookMetadata(sample_text=" ".join(f"wort{i}" for i in range(20)))
    query = enrich.build_query(meta)
    assert len(query.split()) == 12
    assert query.startswith("wort0 wort1")


def test_enrich_metadata_finds_isbn_from_sample_text(monkeypatch):
    monkeypatch.setattr(providers, "search_by_isbn", lambda isbn: [])
    monkeypatch.setattr(providers, "search", lambda *a, **k: [])
    meta = BookMetadata(
        title="Bekannt", authors=["Autor"], sample_text="Die Nummer ISBN 1160959676 steht hier."
    )
    result = enrich.enrich_metadata(meta, use_llm=False)
    assert result.original.isbn == "1160959676"


def test_enrich_metadata_uses_llm_only_when_title_or_author_missing(monkeypatch):
    calls = []
    monkeypatch.setattr(providers, "search_by_isbn", lambda isbn: [])
    monkeypatch.setattr(providers, "search", lambda *a, **k: [])

    def fake_guess(text):
        calls.append(text)
        return {"title": "Erratener Titel", "authors": ["Erratener Autor"]}

    from kindle_meta import llm

    monkeypatch.setattr(llm, "guess_metadata", fake_guess)

    meta_missing_title = BookMetadata(sample_text="Ein Text ohne Titel.")
    result = enrich.enrich_metadata(meta_missing_title, use_llm=True)
    assert result.used_llm is True
    assert result.original.title == "Erratener Titel"
    assert len(calls) == 1

    calls.clear()
    meta_complete = BookMetadata(title="Da", authors=["Autor"], sample_text="Text")
    result2 = enrich.enrich_metadata(meta_complete, use_llm=True)
    assert result2.used_llm is False
    assert len(calls) == 0


def test_enrich_metadata_ranks_suggestions_by_similarity(monkeypatch):
    good = BookMetadata(title="Die Beispielreise", authors=["Anna Musterfrau"])
    bad = BookMetadata(title="Voellig anders", authors=["Wer auch immer"])
    monkeypatch.setattr(providers, "search_by_isbn", lambda isbn: [])
    monkeypatch.setattr(providers, "search", lambda *a, **k: [bad, good])

    meta = BookMetadata(title="Die Beispielreise", authors=["Anna Musterfrau"])
    result = enrich.enrich_metadata(meta, use_llm=False)
    assert result.suggestions[0] is good


def test_enrichment_result_best_with_merges_and_protects():
    original = BookMetadata(title="Original", cover=b"eigenes-cover")
    suggestion = BookMetadata(title="Vorschlag", publisher="Verlag", cover=b"anderes-cover")
    result = enrich.EnrichmentResult(original=original, suggestions=[suggestion], used_llm=False)

    merged = result.best_with(protect={"cover"})
    assert merged.title == "Vorschlag"
    assert merged.publisher == "Verlag"
    assert merged.cover == b"eigenes-cover"


def test_enrichment_result_best_with_returns_none_without_suggestions():
    result = enrich.EnrichmentResult(original=BookMetadata(), suggestions=[], used_llm=False)
    assert result.best_with() is None
    assert result.best is None


def test_cover_candidates_deduplicates_and_orders_file_first():
    original = BookMetadata(cover=b"cover-a", cover_mime="image/jpeg")
    suggestion1 = BookMetadata(cover=b"cover-a", cover_mime="image/jpeg")
    suggestion2 = BookMetadata(cover=b"cover-b", cover_mime="image/jpeg")
    result = enrich.EnrichmentResult(
        original=original, suggestions=[suggestion1, suggestion2], used_llm=False
    )
    candidates = result.cover_candidates()
    assert [c.label for c in candidates] == ["Aus Datei", "Vorschlag 2"]


def test_enrich_batch_writes_only_with_suggestions(monkeypatch, sample_epub):
    good = BookMetadata(title="Die Beispielreise", authors=["Anna Musterfrau"])
    monkeypatch.setattr(providers, "search_by_isbn", lambda isbn: [])
    monkeypatch.setattr(providers, "search", lambda *a, **k: [good])

    from kindle_meta.readers import read_metadata

    outcomes = enrich.enrich_batch([sample_epub], apply=True, use_llm=False)
    assert len(outcomes) == 1
    assert outcomes[0].ok
    assert outcomes[0].written_to == sample_epub

    reread = read_metadata(sample_epub)
    assert reread.title == "Die Beispielreise"


def test_enrich_batch_skips_writing_without_suggestions(monkeypatch, sample_epub):
    monkeypatch.setattr(providers, "search_by_isbn", lambda isbn: [])
    monkeypatch.setattr(providers, "search", lambda *a, **k: [])

    outcomes = enrich.enrich_batch([sample_epub], apply=True, use_llm=False)
    assert len(outcomes) == 1
    assert outcomes[0].ok
    assert outcomes[0].written_to is None


def test_enrich_batch_continues_after_error(tmp_path, monkeypatch):
    monkeypatch.setattr(providers, "search_by_isbn", lambda isbn: [])
    monkeypatch.setattr(providers, "search", lambda *a, **k: [])

    missing_path = str(tmp_path / "existiert-nicht.epub")
    outcomes = enrich.enrich_batch([missing_path, missing_path], use_llm=False)
    assert len(outcomes) == 2
    assert all(not o.ok for o in outcomes)


def test_enrich_batch_reports_progress_and_respects_cancel(monkeypatch, sample_epub):
    monkeypatch.setattr(providers, "search_by_isbn", lambda isbn: [])
    monkeypatch.setattr(providers, "search", lambda *a, **k: [])

    progress_calls = []

    def progress(i, total, path, outcome):
        progress_calls.append((i, total, path))

    outcomes = enrich.enrich_batch(
        [sample_epub, sample_epub, sample_epub],
        use_llm=False,
        progress=progress,
        should_cancel=lambda: len(progress_calls) >= 2,
    )
    assert len(outcomes) == 2
    assert len(progress_calls) == 2
