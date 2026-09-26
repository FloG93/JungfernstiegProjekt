"""Zentrales Datenmodell für Buch-Metadaten."""

from __future__ import annotations

from dataclasses import dataclass, field, fields, replace

# Felder, die beim Zusammenführen immer vom Ausgangsobjekt (self) übernommen
# werden, unabhängig von prefer_other/protect.
_ALWAYS_FROM_SELF = {"sample_text", "source_path"}


def _is_set(value: object) -> bool:
    """Prüft, ob ein Feldwert als "gesetzt" gilt (nicht leer/None/0)."""
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip() != ""
    if isinstance(value, (list, tuple, set, bytes)):
        return len(value) > 0
    if isinstance(value, (int, float)):
        return value != 0
    return bool(value)


@dataclass
class BookMetadata:
    """Metadaten eines E-Books, unabhängig vom Dateiformat."""

    title: str = ""
    authors: list[str] = field(default_factory=list)
    publisher: str = ""
    published: str = ""
    language: str = ""
    isbn: str = ""
    description: str = ""
    page_count: int = 0
    series: str = ""
    series_index: float | None = None
    subjects: list[str] = field(default_factory=list)
    cover: bytes | None = None
    cover_mime: str = ""
    sample_text: str = ""
    source_path: str = ""

    @property
    def author_str(self) -> str:
        return ", ".join(self.authors) if self.authors else ""

    def has_cover(self) -> bool:
        return bool(self.cover)

    def merged_with(
        self,
        other: BookMetadata,
        *,
        prefer_other: bool = True,
        protect: set[str] | None = None,
    ) -> BookMetadata:
        """Führt `self` mit `other` zusammen.

        Leere Werte überschreiben nie gesetzte Werte. Bei `prefer_other=True`
        gewinnt `other`, sofern gesetzt. Felder in `protect` behalten den
        eigenen Wert, sofern dieser nicht leer ist. `sample_text` und
        `source_path` kommen immer von `self`.
        """
        protect = protect or set()
        result = replace(self)
        for f in fields(self):
            name = f.name
            if name in _ALWAYS_FROM_SELF:
                continue
            self_val = getattr(self, name)
            other_val = getattr(other, name)
            if name in protect and _is_set(self_val):
                continue
            if prefer_other:
                if _is_set(other_val):
                    setattr(result, name, other_val)
            else:
                if not _is_set(self_val) and _is_set(other_val):
                    setattr(result, name, other_val)
        return result
