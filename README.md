# kindle-meta

Desktop-App (PySide6) + Kommandozeilen-Tool, um E-Book-Metadaten (EPUB, PDF,
FB2, CBZ/CBR, MOBI/AZW3) aus mehreren Online-Quellen und optional per KI
(Claude) anzureichern und **eingebettet** zurückzuschreiben – nur so zeigt ein
Kindle Cover, Autor, Verlag, Datum, ISBN und Serie korrekt an.

## Funktionsumfang

1. **Lesen** – vorhandene Metadaten + Textprobe aus der Datei.
2. **Anreichern** – ISBN/Sprache aus dem Text erkennen, Suche in Google Books,
   Open Library, DNB und Apple Books, optional KI-Fallback und KI-Recherche.
3. **Prüfen/Auswählen** – Vorschläge vergleichen und kombinieren, Cover
   wählen/drehen/zuschneiden.
4. **Schreiben** – Metadaten, Cover und Serie eingebettet zurückschreiben
   (mit Backup, Cover-Optimierung, geschützten Feldern).
5. **Aufs Gerät** – Send-to-Kindle per E-Mail oder Konvertierung nach AZW3
   via Calibre.

### KI-Funktionen

- Automatischer KI-Fallback, falls Titel/Autor nach dem Lesen fehlen, sowie
  eine manuelle KI-Recherche über den Knopf „🤖 KI abfragen".
- **KI-Qualitätsprüfung** vor dem Speichern (`--ai-check` / Checkbox in der
  GUI): warnt vor unplausiblen Kombinationen (z. B. ISBN passt nicht zum
  Titel, Sprache der Beschreibung weicht ab), ohne Werte zu erfinden.
- **Automatische Serien- und Dubletten-Erkennung** in der Bibliothek
  (`kindle-meta duplicates`, `kindle-meta series-check`).
- **Natürlichsprachige Bibliothekssuche** (`kindle-meta library --query "…"`
  bzw. Suchfeld in der GUI).

## Einsteiger-Schnellstart

```bash
git clone https://github.com/FloG93/JungfernstiegProjekt.git
cd JungfernstiegProjekt
pip install -e ".[gui]"          # optional zusätzlich: llm, keyring, comics
kindle-meta-gui                  # GUI starten (Fallback: python -m kindle_meta.gui.app)
kindle-meta info buch.epub       # CLI-Beispiel
```

Für die KI-Funktionen zusätzlich `pip install -e ".[llm]"` und
`ANTHROPIC_API_KEY` setzen.

## Entwicklung

```bash
pip install -e ".[dev,gui]"

# Linux headless: Qt-Systembibliotheken
sudo apt-get update && sudo apt-get install -y libegl1 libgl1 libxkbcommon0 libdbus-1-3

# Lint + Tests + Coverage
ruff check kindle_meta tests
QT_QPA_PLATFORM=offscreen pytest -q --cov=kindle_meta --cov-report=term-missing
```

## Update

```bash
git pull && pip install -e ".[gui]"
```

## Lizenz

MIT
