"""Einfache Spracherkennung über Stoppwörter, ohne externe Abhängigkeit."""

from __future__ import annotations

import re

_WORD_RE = re.compile(r"[^\W\d_]+", re.UNICODE)

STOPWORDS: dict[str, set[str]] = {
    "de": {
        "der", "die", "das", "und", "ist", "nicht", "ein", "eine", "mit",
        "für", "auf", "von", "zu", "im", "dem", "den", "des", "als", "auch",
        "aber", "sich", "nach", "bei", "wie", "wird", "sind", "war", "aus",
        "noch", "nur", "einem", "einer",
    },
    "en": {
        "the", "and", "is", "not", "a", "an", "with", "for", "on", "of",
        "to", "in", "that", "this", "are", "was", "as", "but", "it", "by",
        "from", "at", "be", "have", "has", "you", "your",
    },
    "fr": {
        "le", "la", "les", "et", "est", "pas", "un", "une", "avec", "pour",
        "sur", "de", "du", "des", "dans", "que", "qui", "au", "aux", "ce",
        "cette", "mais", "il", "elle",
    },
    "es": {
        "el", "la", "los", "las", "y", "es", "no", "un", "una", "con",
        "para", "en", "de", "del", "que", "por", "se", "su", "sus", "pero",
        "como",
    },
    "it": {
        "il", "lo", "la", "gli", "le", "e", "non", "un", "uno", "una",
        "con", "per", "su", "di", "del", "della", "che", "come", "ma", "si",
    },
    "nl": {
        "de", "het", "een", "en", "is", "niet", "met", "voor", "op", "van",
        "in", "dat", "die", "als", "maar", "zijn", "was", "aan", "er", "te",
    },
    "pt": {
        "o", "a", "os", "as", "e", "não", "um", "uma", "com", "para", "em",
        "de", "do", "da", "que", "por", "se", "seu", "sua", "mas", "como",
    },
}


def detect(text: str, *, min_tokens: int = 20) -> str | None:
    """Erkennt die Sprache über Stoppwort-Häufigkeit.

    Gibt `None` zurück bei zu wenig Text, wenn kein Stoppwort trifft, oder
    bei Gleichstand zwischen mehreren Sprachen.
    """
    if not text:
        return None
    tokens = [t.lower() for t in _WORD_RE.findall(text)]
    if len(tokens) < min_tokens:
        return None
    counts = {lang: sum(1 for t in tokens if t in words) for lang, words in STOPWORDS.items()}
    best_count = max(counts.values())
    if best_count == 0:
        return None
    best_langs = [lang for lang, count in counts.items() if count == best_count]
    if len(best_langs) != 1:
        return None
    return best_langs[0]
