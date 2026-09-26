from __future__ import annotations

from kindle_meta import lang, matching
from kindle_meta.models import BookMetadata

GERMAN_TEXT = (
    "Der Wind war nicht mehr wie am Morgen, und die Sonne stand tief über "
    "dem Wald, als er sich auf den Weg machte und nach Hause ging, denn es "
    "war schon spät und die Straße war noch lang."
)

ENGLISH_TEXT = (
    "The sun was setting over the hills and the wind was cold, but he did "
    "not stop, for the road was long and the house was still far from "
    "where he was standing at that moment in time."
)


def test_detect_returns_none_for_short_text():
    assert lang.detect("Der die das", min_tokens=20) is None


def test_detect_german():
    assert lang.detect(GERMAN_TEXT) == "de"


def test_detect_english():
    assert lang.detect(ENGLISH_TEXT) == "en"


def test_detect_returns_none_without_stopword_hits():
    gibberish = " ".join(f"wortxyz{i}" for i in range(30))
    assert lang.detect(gibberish) is None


def test_detect_returns_none_on_empty_text():
    assert lang.detect("") is None
    assert lang.detect(None) is None


def test_similarity_empty_strings_is_zero():
    assert matching.similarity("", "Titel") == 0.0
    assert matching.similarity("Titel", "") == 0.0


def test_similarity_identical_strings_is_one():
    assert matching.similarity("Der Herr der Ringe", "der herr der ringe") == 1.0


def test_score_rewards_title_author_and_matching_isbn():
    reference = BookMetadata(
        title="Der Herr der Ringe", authors=["J.R.R. Tolkien"], isbn="1160959676"
    )
    good = BookMetadata(
        title="Der Herr der Ringe",
        authors=["J.R.R. Tolkien"],
        isbn="1160959676",
        publisher="Klett-Cotta",
        published="1954",
        page_count=1200,
        cover=b"cover",
    )
    bad = BookMetadata(title="Ein anderes Buch", authors=["Jemand Anders"])
    assert matching.score(reference, good) > matching.score(reference, bad)


def test_rank_sorts_descending():
    reference = BookMetadata(title="Die Verwandlung", authors=["Franz Kafka"])
    close = BookMetadata(title="Die Verwandlung", authors=["Franz Kafka"])
    far = BookMetadata(title="Nichts Passendes", authors=["Wer auch immer"])
    ranked = matching.rank(reference, [far, close])
    assert ranked[0] is close
    assert ranked[1] is far
