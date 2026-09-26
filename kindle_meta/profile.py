"""Geschützte Felder (Anreicherungs-Profile): welche Felder beim Anreichern
nie überschrieben werden sollen.
"""

from __future__ import annotations

PROTECTABLE_FIELDS = {
    "title",
    "authors",
    "publisher",
    "published",
    "language",
    "isbn",
    "description",
    "page_count",
    "series",
    "series_index",
    "subjects",
    "cover",
}


def parse_protected(raw: str) -> set[str]:
    """Parst eine Komma-Liste geschützter Felder; unbekannte werden
    ignoriert. `cover` ergänzt automatisch `cover_mime`.
    """
    fields: set[str] = set()
    for part in (raw or "").split(","):
        name = part.strip()
        if name in PROTECTABLE_FIELDS:
            fields.add(name)
    if "cover" in fields:
        fields.add("cover_mime")
    return fields


def load_protected() -> set[str]:
    from kindle_meta.config import Settings

    raw = Settings().get("protected_fields", "") or ""
    return parse_protected(str(raw))


def save_protected(fields: set[str]) -> None:
    from kindle_meta.config import Settings

    Settings().set("protected_fields", ", ".join(sorted(fields)))
