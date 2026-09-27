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

### CLI-Kommandos

| Kommando | Zweck |
|---|---|
| `info PATH` | Metadaten einer Datei anzeigen |
| `enrich PATH` | Vorschläge suchen, ohne zu schreiben |
| `apply PATH` | Anreichern und schreiben (`--out`, `--title`, `--author`, `--publisher`, `--date`, `--isbn`, `--series`, `--series-index`, `--optimize-cover`, `--no-backup`, `--ai-check`, `--strict-ai-check`) |
| `batch PATHS…` | Mehrere Dateien anreichern (`--apply`, `--out-dir`, `--no-llm`, `--optimize-cover`, `--no-backup`, `--protect`) |
| `convert PATH` | Mit Calibre konvertieren (`--to`) |
| `send PATH --to ADRESSE` | Per E-Mail an den Kindle senden |
| `undo PATH` | Letztes Backup wiederherstellen |
| `library` | Bibliothek anzeigen/durchsuchen (`--query`, auch natürlichsprachig) |
| `watch FOLDER` | Ordner überwachen (`--apply`, `--out-dir`, `--no-llm`, `--interval`, `--existing`) |
| `duplicates` | Dubletten in der Bibliothek finden |
| `series-check` | Serien-Konsistenz prüfen |

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

## Packaging

```bash
pip install -e ".[gui,build]"
cd packaging && pyinstaller kindle-meta.spec
```

Erzeugt eine Ein-Datei-GUI-App (`kindle-meta.spec`, Launcher
`kindle_meta_gui.py`).

## Update

```bash
git pull && pip install -e ".[gui]"
```

## Weiterführende Dokumente

- [`PLAN.md`](PLAN.md) – Meilensteine und offene Ideen.
- [`UMZUG.md`](UMZUG.md) – Übergabedokument des Repo-Umzugs, aus dem dieses
  Projekt neu aufgebaut wurde.

## Weiteres Projekt im Repo: PianoScribe

Im Ordner [`pianoscribe/`](pianoscribe/) liegt eine eigenständige Desktop-App, die aus
Audiodateien Klaviernoten erzeugt (Separation, Transkription, Notensatz, PDF-Export). Details in
[`pianoscribe/README.md`](pianoscribe/README.md).

## Lizenz

MIT
