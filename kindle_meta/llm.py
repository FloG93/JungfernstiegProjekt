"""KI-Anbindung (Claude): Extraktion, manuelle Recherche und Qualitätsprüfung.

Ohne `ANTHROPIC_API_KEY`/Paket `anthropic` oder bei einem API-Fehler geben
alle Funktionen `None` zurück, nie eine Exception.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

from kindle_meta.models import BookMetadata

# Fallback-Modelle, falls keine Settings verfügbar sind (z. B. reine
# Bibliotheksnutzung ohne config.Settings). guess_metadata() ist reine
# Textextraktion und nutzt das schnellere/günstigere Modell, research_
# metadata()/review_metadata() benötigen mehr Weltwissen bzw. Sorgfalt und
# nutzen das leistungsfähigere Modell.
MODEL_FAST = "claude-haiku-4-5-20251001"
MODEL_RESEARCH = "claude-sonnet-5"

_SAMPLE_CHARS_FOR_PROMPT = 4000


@dataclass
class QualityIssue:
    """Eine einzelne von der KI gefundene Unstimmigkeit."""

    field: str
    message: str
    suggestion: str | None = None


@dataclass
class QualityReport:
    """Ergebnis von `review_metadata()`."""

    ok: bool
    issues: list[QualityIssue] = field(default_factory=list)


def _model_fast() -> str:
    try:
        from kindle_meta.config import Settings

        return str(Settings().get("llm_model_fast", MODEL_FAST) or MODEL_FAST)
    except Exception:  # noqa: BLE001 - Settings optional, nie fatal
        return MODEL_FAST


def _model_research() -> str:
    try:
        from kindle_meta.config import Settings

        return str(Settings().get("llm_model_research", MODEL_RESEARCH) or MODEL_RESEARCH)
    except Exception:  # noqa: BLE001 - Settings optional, nie fatal
        return MODEL_RESEARCH


def available() -> bool:
    """`ANTHROPIC_API_KEY` gesetzt und das Paket `anthropic` importierbar."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return False
    try:
        import anthropic  # noqa: F401
    except ImportError:
        return False
    return True


def _extract_json(raw: str) -> dict | None:
    """Parst das erste `{`...letzte `}` im Text als JSON."""
    if not raw:
        return None
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end < start:
        return None
    try:
        return json.loads(raw[start : end + 1])
    except json.JSONDecodeError:
        return None


def _call_claude(model: str, system: str, user: str, *, max_tokens: int = 1024) -> str | None:
    if not available():
        return None
    try:
        import anthropic

        client = anthropic.Anthropic()
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        parts = [
            block.text for block in response.content if getattr(block, "type", "") == "text"
        ]
        return "".join(parts)
    except Exception:  # noqa: BLE001 - API-Fehler dürfen nie eskalieren
        return None


def guess_metadata(sample_text: str) -> dict | None:
    """Extrahiert Titel/Autor/Verlag/Datum/ISBN/Sprache NUR aus dem Text.

    Rein extraktiv, kein Raten. Nutzt das schnelle Modell, da es sich um
    eine einfache Textextraktion handelt.
    """
    if not sample_text or not sample_text.strip():
        return None
    system = (
        "Du extrahierst Buch-Metadaten ausschließlich aus dem gegebenen "
        "Textauszug. Erfinde nichts - ist ein Feld im Text nicht erkennbar, "
        "setze es auf null. Antworte ausschließlich mit einem JSON-Objekt "
        'mit den Schlüsseln "title", "authors", "publisher", "published", '
        '"isbn", "language".'
    )
    raw = _call_claude(_model_fast(), system, sample_text[:_SAMPLE_CHARS_FOR_PROMPT])
    return _extract_json(raw) if raw else None


def research_metadata(known: BookMetadata | None) -> dict | None:
    """Manuelle Recherche: identifiziert das Buch anhand vorhandener Hinweise
    und darf dabei Modellwissen nutzen. Bei Unsicherheit `null` je Feld,
    nie eine erfundene ISBN.
    """
    if known is None:
        return None
    has_context = bool(known.title or known.author_str or known.isbn or known.sample_text)
    if not has_context:
        return None
    system = (
        "Du identifizierst ein Buch anhand der gegebenen Hinweise (Titel, "
        "Autor, ISBN, Textauszug) und darfst dazu dein Wissen über "
        "existierende Bücher nutzen. Bist du dir bei einem Feld nicht "
        "sicher, setze es auf null - erfinde niemals eine ISBN. Antworte "
        'ausschließlich mit einem JSON-Objekt mit den Schlüsseln "title", '
        '"authors", "publisher", "published", "isbn", "language", '
        '"description", "subjects", "series", "series_index".'
    )
    payload = {
        "title": known.title,
        "authors": known.authors,
        "isbn": known.isbn,
        "sample_text": known.sample_text[:2000],
    }
    raw = _call_claude(_model_research(), system, json.dumps(payload, ensure_ascii=False))
    return _extract_json(raw) if raw else None


def review_metadata(meta: BookMetadata) -> QualityReport | None:
    """KI-Qualitätsprüfung vor dem Speichern: prüft Konsistenz der bereits
    zusammengestellten Metadaten (ISBN passt zur Prüfziffer/zum Titel?
    Datum plausibel? Sprache der Beschreibung passt zu `language`? deutet
    der Titel auf eine Serie hin, obwohl `series` leer ist?), OHNE neue
    Werte zu erfinden. `None`, wenn keine KI verfügbar ist oder ein Fehler
    auftritt.
    """
    if not available():
        return None
    system = (
        "Du prüfst Buch-Metadaten auf Konsistenz, bevor sie gespeichert "
        "werden. Erfinde keine neuen Werte, korrigiere nur offensichtliche "
        "Unstimmigkeiten. Antworte ausschließlich mit einem JSON-Objekt: "
        '{"ok": bool, "issues": [{"field": str, "message": str, '
        '"suggestion": str oder null}]}. Wenn alles plausibel ist, gib '
        '{"ok": true, "issues": []} zurück.'
    )
    payload = {
        "title": meta.title,
        "authors": meta.authors,
        "publisher": meta.publisher,
        "published": meta.published,
        "language": meta.language,
        "isbn": meta.isbn,
        "description": meta.description[:1000],
        "series": meta.series,
        "series_index": meta.series_index,
    }
    raw = _call_claude(_model_research(), system, json.dumps(payload, ensure_ascii=False))
    data = _extract_json(raw) if raw else None
    if data is None:
        return None
    issues = [
        QualityIssue(
            field=str(item.get("field", "")),
            message=str(item.get("message", "")),
            suggestion=item.get("suggestion"),
        )
        for item in (data.get("issues") or [])
        if isinstance(item, dict)
    ]
    return QualityReport(ok=bool(data.get("ok", not issues)), issues=issues)
