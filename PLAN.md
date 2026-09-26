# kindle-meta – Projektplan

## Meilenstein A – Grundgerüst (erledigt)
Lesen/Anreichern/Schreiben für EPUB/PDF, GUI-Grundgerüst, CLI, Backup/
Undo, SQLite-Bibliothek mit Thumbnails, Serien-Metadaten, ISBN-Erkennung.

## Meilenstein B – Mehr Formate & bessere Treffer (erledigt)
MOBI/AZW3 über Calibre, FB2, Fuzzy-Ranking der Vorschläge, eigene
Spracherkennung ohne externe Abhängigkeit, DNB als vierte Quelle.

## Meilenstein C – Komfort (erledigt)
Bibliotheks-Tab mit Cover-Grid, Einstellungen-Dialog, Cover-Editor
(Zuschneiden/Drehen), Stapelverarbeitung mit Fortschritt/Abbruch,
CBZ/CBR-Unterstützung.

## Meilenstein D – Reife (erledigt)
CI (Lint + Tests, Python 3.10–3.12), PyInstaller-Packaging,
Ordner-Überwachung (`watch`), Anreicherungs-Profile (geschützte Felder),
Apple Books als vierte Provider-Quelle, manuelle KI-Recherche
(„🤖 KI abfragen").

## Meilenstein E – KI-Optimierung (dieser Umzug)

Anlass: Migration in dieses Repository (siehe `UMZUG.md`) nach Verlust
des alten Repos, verbunden mit der Bitte, die App dabei durch eine neue
KI-Version zu optimieren. Umgesetzt wurden drei konkrete Erweiterungen:

1. **Aktuelle, konfigurierbare KI-Modelle** statt einer fixen alten
   Konstante: `llm_model_fast` (Default `claude-haiku-4-5-20251001`) für
   reine Textextraktion, `llm_model_research` (Default `claude-sonnet-5`)
   für Recherche und Qualitätsprüfung – beide über die Einstellungen
   änderbar.
2. **KI-Qualitätsprüfung vor dem Speichern** (`llm.review_metadata`):
   prüft die fertigen Metadaten auf Konsistenz (ISBN/Titel/Verlag, Datum,
   Sprache der Beschreibung, Serienhinweis ohne gesetzte Serie), ohne
   Werte zu erfinden. Per Checkbox in der GUI bzw. `--ai-check` /
   `--strict-ai-check` in der CLI.
3. **Automatische Serien-/Dubletten-Erkennung und natürlichsprachige
   Bibliothekssuche**: `duplicates.find_duplicate_groups()`,
   `series.check_series_consistency()` (inkl. optionalem KI-Vorschlag für
   fehlende Bandnummern über `llm.suggest_series_index`) sowie
   `library.build_filter_from_query()` (`llm.parse_library_query()`
   übersetzt eine natürlichsprachige Anfrage in ein festes, typisiertes
   Filterobjekt – nie in von der KI erzeugtes SQL).

## Offene Ideen (optional)

- DjVu lesen
- Comic-Metadaten (`ComicInfo.xml`) auch schreiben
- Kindle-Sammlungen über Serien-Metadaten prüfen/optimieren
- Oberfläche mehrsprachig (i18n)
- Cloud-Backup von Bibliothek/Einstellungen
- KI-gestützte Cover-Bewertung (Bildqualität, Bildausschnitt) vor dem Schreiben
