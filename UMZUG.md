# UMZUG – kindle-meta

> **Übergabedokument für die nächste Code-Session.** Stand: 2026-09-26.
> Zuerst **Abschnitt 1 (Lage)** und **Abschnitt 7 (Checkliste)** lesen.
> Abschnitte 4–6 und 8 sind so detailliert, dass das Projekt notfalls auch
> ohne vorhandenen Code nachgebaut werden kann.

---

## 0. TL;DR

- **Was:** `kindle-meta` – Python-Desktop-App (PySide6) + CLI. Liest E-Books
  (EPUB, PDF, FB2, CBZ/CBR, MOBI/AZW3), reichert Metadaten aus 4 Online-Quellen
  + optional KI (Claude) an und schreibt sie **eingebettet** zurück, damit ein
  Kindle Cover, Autor, Verlag, Datum, ISBN und Serie korrekt anzeigt.
- **Letzter bekannter Stand:** Branch `main` @ `7339336`
  („Merge pull request #2 …“), **89 Tests grün, 1 übersprungen** (Calibre),
  Ruff-Lint sauber, GitHub-Actions-CI vorhanden.
- **⚠️ Altes Repo nicht mehr erreichbar:** `github.com/flogramsch-blip/kindle-meta`
  liefert 404. Der Code muss aus einer **lokalen Kopie des Nutzers** kommen
  (siehe Abschnitt 1).
- **Aufgabe der nächsten Session:** Code ins neue Repo überführen, Tests grün
  bekommen, Links anpassen, CI prüfen, `main` als Default-Branch setzen.

---

## 1. Lage bei der Übergabe

| Punkt | Stand |
|---|---|
| Altes Repo | `https://github.com/flogramsch-blip/kindle-meta` – am 2026-09-26 **404** (API und `git ls-remote`) |
| Konto mit Zugriff | `FloG93` (sichtbar: `3D-Druck`, `Arbeit`, `JungfernstiegProjekt`) – **kein** `kindle-meta` |
| Kopie in der alten Session | **verloren** (Container zurückgesetzt) |
| Wahrscheinlichste Quelle | **Lokaler Klon beim Nutzer (Windows)** – er hat per `git clone` + `pip install -e ".[gui]"` installiert |

**Prüfen, ob die lokale Kopie vollständig ist** (im Projektordner):

```bash
git checkout main
git log --oneline -3
```

- Zeigt `7339336 Merge pull request #2 …` → **vollständig**.
- Zeigt höchstens `c31df2c Merge pull request #1 …` → Stand **ohne** Apple Books
  und ohne KI-Knopf. Diese Teile gemäß Abschnitt 4 (`providers.search_apple_books`,
  `llm.research_metadata`, GUI-Knopf „🤖 KI abfragen") nachbauen.
- Keine Kopie vorhanden → Projekt anhand der Abschnitte 3–6 und 8 neu aufbauen.

---

## 2. Was die App macht

Ein Kindle zeigt Cover/Metadaten nur zuverlässig an, wenn sie **in der Datei
eingebettet** sind (Umbenennen reicht nicht). Ablauf:

1. **Lesen** – vorhandene Metadaten + Textprobe (erste ~4000 Zeichen).
2. **Anreichern** – ISBN und Sprache aus dem Text erkennen; KI-Fallback, falls
   Titel/Autor fehlen; gezielte ISBN-Suche; kombinierte Suche in 4 Datenbanken;
   Treffer nach Ähnlichkeit sortieren.
3. **Prüfen/Auswählen** – Vorschlag wählen, Felder aus mehreren Treffern
   kombinieren („Vergleichen"), Cover wählen/drehen/zuschneiden, optional
   manuelle KI-Recherche („🤖 KI abfragen") als zusätzlicher Vorschlag.
4. **Schreiben** – Metadaten + Cover + Serie eingebettet zurückschreiben
   (optional mit Backup, Cover-Optimierung, geschützten Feldern).
5. **Aufs Gerät** – Send-to-Kindle per E-Mail oder USB; optional Konvertierung
   nach AZW3 via Calibre.

---

## 3. Repository-Struktur (Soll)

```
kindle-meta/
├── .github/workflows/ci.yml        # Lint + Tests + Coverage, Py 3.10–3.12
├── .gitignore
├── PLAN.md                         # Meilensteine A–D (erledigt) + offene Ideen
├── README.md                       # inkl. Einsteiger-Schnellstart (Deutsch)
├── UMZUG.md                        # dieses Dokument
├── pyproject.toml
├── packaging/
│   ├── kindle-meta.spec            # PyInstaller-Spec (Ein-Datei-GUI-App)
│   └── kindle_meta_gui.py          # Launcher für PyInstaller
├── kindle_meta/
│   ├── __init__.py                 # __version__ = "0.1.0", exportiert BookMetadata
│   ├── models.py  readers.py  writers.py  calibre.py
│   ├── providers.py  llm.py  matching.py  lang.py  isbn.py
│   ├── covers.py  enrich.py  backup.py  library.py  config.py
│   ├── profile.py  watch.py  sendmail.py  cli.py
│   └── gui/__init__.py  gui/app.py
└── tests/
    ├── conftest.py                 # Fixtures sample_epub (Pillow-Cover), sample_pdf
    ├── test_models.py  test_readers.py  test_writers.py  test_batch.py
    ├── test_calibre.py  test_calibre_integration.py  test_covers.py
    ├── test_sendmail.py  test_isbn.py  test_backup_library.py  test_series.py
    ├── test_gui.py  test_lang_matching.py  test_dnb.py  test_fb2.py
    ├── test_profile_watch.py  test_comic.py  test_cli.py  test_llm.py
```

---

## 4. Module im Detail

### Überblick

| Modul | Aufgabe |
|---|---|
| `models.py` | `BookMetadata` (zentrales Datenmodell) + Merge-Logik |
| `readers.py` | Lesen: EPUB, PDF, FB2, CBZ/CBR; MOBI/AZW3/AZW → `calibre` |
| `writers.py` | Schreiben: EPUB, PDF; MOBI/AZW3 → `calibre`; Backup/Cover-Optimierung |
| `calibre.py` | `ebook-meta`/`ebook-convert` ansteuern, Ausgabe parsen |
| `providers.py` | Google Books, Open Library, DNB, Apple Books |
| `llm.py` | Claude: automatischer Fallback + manuelle Recherche |
| `matching.py` | Ähnlichkeits-Score + Ranking der Vorschläge |
| `lang.py` | Spracherkennung über Stoppwörter (ohne Abhängigkeit) |
| `isbn.py` | ISBN-10/13 finden + Prüfziffer validieren |
| `covers.py` | Cover optimieren, drehen, zuschneiden, Thumbnail |
| `enrich.py` | Orchestrierung, Cover-Kandidaten, Stapellauf |
| `backup.py` | Sicherungskopien anlegen/wiederherstellen |
| `library.py` | SQLite-Bibliothek inkl. Thumbnails + Migration |
| `config.py` | App-Verzeichnis + `Settings` (keyring optional) |
| `profile.py` | Geschützte Felder (Anreicherungs-Profile) |
| `watch.py` | Ordner-Überwachung (Polling) |
| `sendmail.py` | Send-to-Kindle per SMTP |
| `cli.py` | 10 Kommandos |
| `gui/app.py` | PySide6-Oberfläche + Dialoge |

### `models.py`
`@dataclass BookMetadata`: `title`, `authors: list[str]`, `publisher`,
`published` (ISO-Datum oder Jahr), `language`, `isbn`, `description`,
`page_count`, `series`, `series_index: float`, `subjects: list[str]`,
`cover: bytes`, `cover_mime`, `sample_text`, `source_path`.
- `author_str` (Property, `", "`-verbunden), `has_cover()`.
- `merged_with(other, *, prefer_other=True, protect=None)`: leere Werte
  überschreiben nie gesetzte; bei `prefer_other` gewinnt `other`. Felder in
  `protect` behalten den eigenen Wert, **sofern** dieser nicht leer ist.
  `sample_text`/`source_path` kommen bevorzugt von `self`.

### `readers.py`
`read_metadata(path) -> BookMetadata` (setzt `source_path`), Dispatch per Endung;
`UnsupportedFormat` sonst. `SAMPLE_CHARS = 4000`. Abhängigkeiten **lazy** importieren.
- **EPUB** (`ebooklib`): DC-Felder `title/creator/publisher/date/language/description/subject`;
  ISBN aus `identifier` (Schema enthält „isbn" oder 10/13 Ziffern);
  Serie aus OPF-Meta `calibre:series` / `calibre:series_index`
  (liegen als `(None, {"name":…, "content":…})` in `book.get_metadata("OPF", "meta")`).
  Cover: 1) `ITEM_COVER`, 2) `<meta name="cover">`-ID, 3) erstes Bild mit „cover" im Namen.
  Textprobe: HTML der Dokumente entschlackt.
- **PDF** (`pypdf`): `/Title`, `/Author` (split an `;`, `&`, „and", „und"),
  `/CreationDate`, `page_count`, Textprobe aus ersten 5 Seiten.
- **FB2** (XML, namespace-agnostisch über Local-Names): `title-info`
  (`book-title`, `author` aus first/middle/last-name, `lang`, `genre`, `annotation`),
  `publish-info` (`publisher`, `year`, `isbn`), Cover via
  `<coverpage><image href="#id">` → `<binary id>` (base64), Textprobe aus `<body>`.
- **CBZ** (zipfile) / **CBR** (optional `rarfile`, sonst `UnsupportedFormat` mit Hinweis):
  `ComicInfo.xml` (`Title`, `Series`, `Number`→`series_index`, `Writer`/`Penciller`→Autoren,
  `Publisher`, `Year`, `Summary`, `LanguageISO`, `Genre`), Cover = erstes Bild alphabetisch.
- **MOBI/AZW3/AZW** → `calibre.read_metadata`.

### `writers.py`
`write_metadata(meta, out_path=None, *, optimize_cover=False, backup=False) -> str`
- `out_path` ≠ Quelle → Datei vorher kopieren (Original bleibt). Sonst in-place;
  dann mit `backup=True` zuerst `backup.create_backup`.
- `optimize_cover=True` → `covers.optimize_for_kindle` vor dem Schreiben.
- **EPUB:** DC-Felder komplett ersetzen (alte Werte löschen), Creators neu,
  ISBN als `identifier` (+ `set_identifier`), Subjects, Calibre-Serien-Meta setzen/entfernen
  (Index ohne `.0` bei ganzen Zahlen), **vorhandenes Cover erst entfernen**, dann
  `set_cover`; schreiben mit `epub.write_epub(path, book, {"epub3_pages": False})`.
- **PDF:** `PdfWriter.append(reader)`, `add_metadata` (`/Title`, `/Author`, `/Producer`=Verlag,
  `/Keywords`, `/Subject`=Beschreibung), in `.tmp` schreiben und `os.replace`.
- **MOBI/AZW3/AZW** → `calibre.write_metadata`.
- **FB2/CBZ/CBR** → `WriteError` mit Hinweis „erst nach EPUB/AZW3 konvertieren".
- Außerdem `calibre_available()`, `convert_with_calibre(src, out_ext="azw3")`.

### `calibre.py`
`available()` (prüft `ebook-meta` im PATH), `CalibreNotFound`.
- `read_metadata(path)`: `ebook-meta <path> --get-cover <tmp.jpg>`, Ausgabe mit
  `parse_ebook_meta_output(text)` parsen (Zeilen `Key : Value`, eingerückte
  Fortsetzungszeilen; `Author(s)` ohne `[Sortname]`, getrennt an `&`/`;`;
  `Published` nur Datumsteil; `Identifiers` → `isbn:`; `Series` „Name [2]" oder „Name #2").
- `write_metadata(meta, path)`: `ebook-meta <path>` + `build_write_args(meta)`
  (`--title`, `--authors "A & B"`, `--publisher`, `--date`, `--language`, `--comments`,
  `--tags`, `--identifier isbn:…`, `--series`, `--index`) + `--cover <tmp>`.
- `convert(src, out_ext="azw3")` via `ebook-convert`.

### `providers.py`
Alle Funktionen geben bei Fehlern **`[]`** zurück (nie Exception). `_TIMEOUT = 15`.
- `search(query, *, max_results=5, fetch_covers=True, language=None)` →
  Google Books (+ `langRestrict`) + Open Library + DNB + Apple Books.
- `search_by_isbn(isbn)` → Google Books `isbn:…`, sonst Open Library.
- **Google Books:** `https://www.googleapis.com/books/v1/volumes`; ISBN_13 bevorzugt;
  Cover aus `imageLinks.thumbnail` (http→https). `_lang2()` bildet
  `ger/deu/eng/fre/fra/spa/ita/dut/nld/por` auf 2-Buchstaben-Codes ab.
- **Open Library:** `https://openlibrary.org/search.json`; Cover
  `https://covers.openlibrary.org/b/id/{cover_i}-L.jpg`.
- **DNB:** SRU `https://services.dnb.de/sru/dnb`, `version=1.1`,
  `operation=searchRetrieve`, `query=WOE="<query>"`, `recordSchema=oai_dc`.
  `parse_dnb_oai_dc(xml)`: Rollen wie `[Verfasser]` aus Autoren entfernen;
  `identifier` **nur als ISBN übernehmen, wenn Prüfziffer gültig**. Kein Cover.
- **Apple Books:** `https://itunes.apple.com/search`, `media=ebook`, `entity=ebook`.
  `parse_apple_json(data)`: `trackName`, `artistName`, `description`,
  `releaseDate[:10]`, `genres`; Cover `artworkUrl100` mit `100x100bb`→`600x600bb`.
  Keine ISBN, kein Verlag.
- **Bewusst nicht integriert:** Amazon (keine offene API, Scraping gegen AGB),
  WorldCat (freie API eingestellt).

### `llm.py`
Konstante `MODEL` (Modell-ID; bei Bedarf auf ein aktuelles Claude-Modell setzen).
- `available()`: `ANTHROPIC_API_KEY` gesetzt **und** `anthropic` importierbar.
- `guess_metadata(sample_text)`: nur **Extraktion aus dem Text**, nicht raten →
  JSON `title, authors, publisher, published, isbn, language`.
- `research_metadata(known)`: **manuelle Recherche** – identifiziert das Buch aus
  Titel/Autor/ISBN/Textprobe und darf Modellwissen nutzen; bei Unsicherheit `null`,
  keine erfundene ISBN; zusätzlich `description, subjects, series, series_index`.
  Ohne Kontext oder ohne Verfügbarkeit → `None`.
- `_extract_json(raw)`: erstes `{` bis letztes `}` parsen.

### `matching.py`
`similarity(a, b)` (normalisiert, `difflib.SequenceMatcher`, leer → 0).
`score(reference, candidate)` = `0.6·Titel + 0.3·Autor` (nur wenn Referenz Titel
oder Autor hat) `+ 0.03` je vorhandenem Feld (publisher, published, isbn, cover,
page_count) `+ 0.5` bei gleicher ISBN. `rank(reference, candidates)` absteigend.

### `lang.py`
`detect(text, *, min_tokens=20)`: Stoppwort-Zählung für `de, en, fr, es, it, nl, pt`;
`None` bei zu wenig Text, keinem Treffer oder Gleichstand.

### `isbn.py`
`normalize`, `is_valid_isbn10`, `is_valid_isbn13`, `is_valid`,
`find_isbn(text)` (Regex-Kandidaten, Prüfziffer, **ISBN-13 bevorzugt**).

### `covers.py`
`TARGET_RATIO = 1.6`, `TARGET_HEIGHT = 1680`, `JPEG_QUALITY = 85`, `CoverError`.
- `optimize_for_kindle(data, *, target_height, crop_to_ratio=False, quality)` →
  RGB-JPEG (Transparenz auf Weiß), optional mittig auf 1,6:1 zuschneiden,
  **nur verkleinern**.
- `rotate(data, degrees)` (im Uhrzeigersinn, `expand=True`),
  `crop(data, (l, t, r, b))` (ungültige Box → `CoverError`),
  `thumbnail(data, max_side=200)`.

### `enrich.py`
- `EnrichmentResult(original, suggestions, used_llm)`: `best`,
  `best_with(protect)`, `cover_candidates` (dedupliziert, „Aus Datei" zuerst).
- `CoverCandidate(label, data, mime)`.
- `build_query(meta)`: Titel + erster Autor, sonst erste 12 Wörter der Textprobe.
- `enrich_metadata(original, *, use_llm=True, max_results=5)` – Reihenfolge:
  1. ISBN aus Textprobe (`isbn.find_isbn`), 2. Sprache (`lang.detect`),
  3. KI-Fallback nur wenn Titel **oder** Autor fehlt (`prefer_other=False`),
  4. `search_by_isbn`, 5. `search(query, language=…)`, 6. `matching.rank`.
- `enrich_file(path, …)`.
- `BatchOutcome(path, result, written_to, error)` + `ok`.
- `enrich_batch(paths, *, apply, out_dir, use_llm, max_results, optimize_cover,
  backup, protect, progress, should_cancel)`: Fehler einzelner Dateien stoppen
  nicht; geschrieben wird nur mit ≥ 1 Vorschlag; `progress(i, total, path, outcome)`;
  `should_cancel()` vor jeder Datei.

### `backup.py`
Ablage `<app_home>/backups/`, Name `YYYYmmdd-HHMMSS-ffffff__<datei>`.
`create_backup(path)`, `list_backups(path)` (neueste zuerst), `restore_latest(path)`.

### `library.py`
SQLite `<app_home>/library.db`, Tabelle `books`
(`path` PK, `title`, `authors` JSON, `publisher`, `published`, `isbn`, `language`,
`series`, `series_index`, `page_count`, `has_cover`, `thumbnail` BLOB, `status`,
`updated_at`). `_migrate()` ergänzt fehlende `thumbnail`-Spalte.
`upsert(meta, status)` (Thumbnail aus Cover, `COALESCE` behält altes),
`set_status`, `remove`, `get`, `get_status`, `all`, `count`, `get_thumbnail`.
Status: `imported`, `enriched`, `written`, `sent`. Kontextmanager.

### `config.py`
`app_home()` = `$KINDLE_META_HOME` oder `~/.kindle-meta` (wird angelegt),
`backups_dir()`, `library_path()`. `Settings`: `settings.json`; geheime Schlüssel
(`smtp_pass`) über `keyring`, falls installiert, sonst Datei-Fallback.
Genutzte Schlüssel: `kindle_addr`, `smtp_host`, `smtp_port`, `smtp_user`,
`smtp_pass`, `smtp_from`, `protected_fields`.

### `profile.py`
`PROTECTABLE_FIELDS`, `parse_protected("cover, title")` (unbekannte ignorieren;
`cover` ergänzt `cover_mime`), `load_protected()`, `save_protected()`
(Settings-Schlüssel `protected_fields`).

### `watch.py`
`SUPPORTED_EXTS` (epub, pdf, fb2, cbz, cbr, mobi, azw3, azw).
`FolderWatcher(folder)`: `prime()` (Bestand merken), `scan()` (neue Dateien),
`run(callback, *, interval=5.0, iterations=None, process_existing=False)`.

### `sendmail.py`
`SmtpConfig.from_env()` (`KINDLE_SMTP_HOST/PORT/USER/PASS`, `KINDLE_FROM`) und
`SmtpConfig.load(settings)` (Umgebung hat Vorrang, sonst Settings).
`build_message(file, to, from)` (Formate: epub, pdf, azw3, mobi, docx, txt),
`send_to_kindle(file, to, config=None)` (Port 465 → SSL, sonst STARTTLS). `SendError`.

### `cli.py` (`kindle-meta …`)
| Kommando | Optionen |
|---|---|
| `info PATH` | – |
| `enrich PATH` | `--no-llm` |
| `apply PATH` | `--out --title --author --publisher --date --isbn --series --series-index --optimize-cover --no-backup` |
| `batch PATHS…` | `--apply --out-dir --no-llm --optimize-cover --no-backup --protect` |
| `convert PATH` | `--to` (Standard `azw3`) |
| `send PATH` | `--to` (Pflicht) |
| `undo PATH` | – |
| `library` | – |
| `watch FOLDER` | `--apply --out-dir --no-llm --interval --existing` |

Geschriebene Dateien werden in der Bibliothek vermerkt (`_maybe_record`).
Fehler aus `kindle_meta`-Modulen sowie `OSError/ValueError/RuntimeError` →
`Fehler: …` auf stderr, Exit-Code 1.

### `gui/app.py` (`kindle-meta-gui`)
- `MainWindow` mit Menü **Datei → Einstellungen/Beenden** und Tabs
  **„Bearbeiten"** / **„Bibliothek"**. Arbeit in `QThreadPool` (`Worker`,
  `BatchWorker` mit Fortschritt + Abbruch).
- **Bearbeiten:** Dateiliste (Drag & Drop, Mehrfachauswahl, „Ausgewählte
  entfernen/senden"); Stapelbereich (Cover optimieren, „Alle anreichern &
  speichern …", Fortschrittsbalken, Abbrechen); Cover-Anzeige mit „Cover
  ersetzen", ↺/↻, „Zuschneiden …"; Formular (Titel, Autor(en), Verlag, Datum,
  ISBN, Sprache, Serie, Serien-Nr., Beschreibung); Cover-Auswahl-Leiste;
  Vorschlags-Combo + **„Online suchen / anreichern"** + **„🤖 KI abfragen"** +
  **„Vergleichen …"**; Checkboxen „Cover optimieren" / „Backup vor
  Überschreiben" (Standard an); „Speichern", „An Kindle senden …"; Statuszeile.
- **KI-Knopf:** ohne `llm.available()` Hinweisdialog; sonst
  `llm.research_metadata` im Worker → Ergebnis **vorne** in die Vorschläge,
  markiert über `_ai_ids` und Label-Präfix „🤖 KI: "; ggf. KI-Cover in die
  Cover-Auswahl. Online- und KI-Vorschläge sind im Vergleichsdialog kombinierbar.
- **Bibliothek:** Cover-Grid (`QListWidget` IconMode) aus der SQLite-Bibliothek,
  Suchfeld (Titel/Autor/Serie), Doppelklick öffnet im Editor.
- **Dialoge:** `SettingsDialog` (Felder = Settings-Schlüssel oben, Passwort
  maskiert), `CompareDialog` (pro Feld editierbare Combo mit allen Kandidatenwerten,
  `result_metadata()`), `CropDialog` (`_CropLabel` mit `QRubberBand`, Anzeige-
  auf Originalkoordinaten hochrechnen, `covers.crop`).

### `packaging/`
`kindle-meta.spec`: `Analysis(["kindle_meta_gui.py"], pathex=[".."])`,
`hiddenimports = ebooklib, ebooklib.epub, pypdf, PIL, PIL.Image, requests`,
`excludes=["tkinter"]`, `console=False`, Name `kindle-meta`.

---

## 5. Abhängigkeiten (`pyproject.toml`)

- Build: `setuptools>=68`. Paket: `kindle-meta` `0.1.0`, `requires-python >=3.10`, Lizenz MIT.
- **Kern:** `ebooklib>=0.18`, `pypdf>=4.0`, `requests>=2.28`, `Pillow>=10.0`
- **Extras:** `gui` = `PySide6>=6.5` · `llm` = `anthropic>=0.40` ·
  `keyring` = `keyring>=24` · `build` = `pyinstaller>=6.0` ·
  `comics` = `rarfile>=4.0` · `dev` = `pytest>=7.0`, `pytest-cov>=4.0`,
  `PySide6>=6.5`, `ruff>=0.5`
- **Einstiegspunkte:** `kindle-meta = kindle_meta.cli:main`,
  GUI-Script `kindle-meta-gui = kindle_meta.gui.app:main`
- `[tool.setuptools.packages.find] include = ["kindle_meta*"]`
- `[tool.pytest.ini_options] testpaths = ["tests"]`
- `[tool.coverage.run] source = ["kindle_meta"]`, `omit = ["kindle_meta/gui/*"]`
- `[tool.ruff] line-length = 100`, `target-version = "py310"`;
  `[tool.ruff.lint] select = ["E","F","I","W","B"]`, `ignore = ["B008"]`

---

## 6. Befehle

```bash
# Installation (Entwicklung)
pip install -e ".[dev,gui]"          # optional zusätzlich: llm, keyring, comics

# Linux headless: Qt-Systembibliotheken
sudo apt-get update && sudo apt-get install -y libegl1 libgl1 libxkbcommon0 libdbus-1-3

# Lint + Tests + Coverage
ruff check kindle_meta tests
QT_QPA_PLATFORM=offscreen pytest -q --cov=kindle_meta --cov-report=term-missing
# Soll: 89 passed, 1 skipped (Calibre-Integrationstest)

# Starten
kindle-meta-gui                      # GUI (Fallback: python -m kindle_meta.gui.app)
kindle-meta info buch.epub           # CLI

# Packaging
pip install -e ".[gui,build]" && pyinstaller packaging/kindle-meta.spec
```

---

## 7. Umzugs-Checkliste (für die nächste Session)

1. **Ziel klären:** Name/URL des neuen Repos vom Nutzer erfragen; Repo muss der
   Session zugänglich sein (ggf. hinzufügen lassen).
2. **Code beschaffen** – aus der lokalen Kopie des Nutzers (Abschnitt 1).
   Variante **mit Historie** (empfohlen), im alten Projektordner beim Nutzer:
   ```bash
   git checkout main
   git remote add neu https://github.com/<OWNER>/<NEUES-REPO>.git
   git push neu main
   git remote rename origin alt && git remote rename neu origin
   ```
   Variante **ohne Historie:** Dateien (ohne `.git`) in das neue Repo kopieren,
   `git add -A && git commit -m "Initial import: kindle-meta"`, pushen.
3. **Vollständigkeit prüfen:** alle Dateien aus Abschnitt 3 vorhanden;
   `grep -r "research_metadata" kindle_meta` und `grep -r "search_apple_books" kindle_meta`
   liefern Treffer (sonst fehlt PR #2 → nachbauen).
4. **Umgebung + Tests:** Abschnitt 6 ausführen → Ruff sauber, **89 passed, 1 skipped**.
5. **Verweise anpassen:** `grep -rn "flogramsch-blip" .` → mindestens den
   Klon-Link im README-Schnellstart auf das neue Repo ändern.
6. **Dieses Dokument** (`UMZUG.md`) im Repo-Root ablegen und mitcommitten.
7. **Pushen, CI prüfen** (Actions-Tab: Lint + Tests auf 3.10/3.11/3.12 grün).
8. **GitHub-Einstellungen:** Default-Branch auf `main` setzen (im alten Repo war
   noch der Feature-Branch `claude/ebook-reader-metadata-sm313c` Default).
9. **Nutzer informieren:** lokales Update künftig mit
   `git pull && pip install -e ".[gui]"` im Projektordner.

---

## 8. Fallstricke & Lessons Learned

| Problem | Lösung |
|---|---|
| `pypdf` importiert `cryptography`; die Debian-Systemversion war defekt (`_cffi_backend` fehlt, PanicException) | `pip install cffi cryptography` |
| `ebooklib.write_epub` bricht beim erneuten Schreiben mit „Document is empty" ab | Optionen `{"epub3_pages": False}` |
| `set_cover` auf EPUB mit vorhandenem Cover erzeugt doppelte ZIP-Einträge; Kindle zeigt evtl. altes Cover | vorher `_remove_existing_cover` (Items + OPF-`cover`-Meta entfernen) |
| Calibre-Serien-Meta liegt in `metadata[OPF-Namespace]["meta"]` als Tupel | gezielt über `name` filtern/ersetzen |
| Handgeschriebenes Hex-PNG in Fixture war defekt → Pillow-Fehler → modaler `QMessageBox` blockierte GUI-Test endlos | Testbilder immer mit Pillow erzeugen; in GUI-Tests `QMessageBox.information/warning/critical/question` wegpatchen (Fixture `no_modal_dialogs`) |
| PySide6 startet headless nicht (`libEGL.so.1` fehlt) | Qt-Systembibliotheken installieren (Abschnitt 6), `QT_QPA_PLATFORM=offscreen` |
| pytest mit Qt lieferte in der Sandbox im Vordergrund teils keine Ausgabe | Ausgabe in Datei umleiten bzw. detached laufen lassen |
| `langdetect` ließ sich nicht bauen | eigene Stoppwort-Erkennung (`lang.py`) |
| Google Books antwortet von geteilten IPs mit HTTP 429 | Provider liefern `[]`, die übrigen Quellen tragen die Suche |
| DNB liefert Rollen-Zusätze („[Verfasser]") und interne Nummern als `identifier` | Rollen entfernen, ISBN per Prüfziffer validieren |
| Testdaten-Irrtümer: `0000000000` und `1160959676` sind **gültige** ISBN-10 | für „ungültig" z. B. `1234567890` bzw. `1160959677` nutzen |
| Netzwerk in Tests | Provider per `monkeypatch` ersetzen; lazily importierte Module (`requests`, `anthropic`) über `monkeypatch.setitem(sys.modules, …)` mocken |
| Calibre fehlt in CI/Sandbox | `test_calibre_integration.py` per `skipif` überspringen; Parser/Argumente separat testen |

---

## 9. Konventionen

- **Sprache:** Oberfläche, Doku, Docstrings, Kommentare und Commit-Messages auf **Deutsch**.
- **Architektur:** Kern-Logik strikt getrennt von der GUI; GUI ist dünne Schicht.
- **Optionale Abhängigkeiten lazy importieren** (ebooklib, pypdf, PIL, requests,
  anthropic, rarfile, keyring); PySide6 nur in `gui/`.
- **Netzwerkfehler** führen zu leeren Ergebnissen, nie zum Absturz.
- **Parser separat testbar** halten (`parse_dnb_oai_dc`, `parse_apple_json`,
  `parse_ebook_meta_output`, `build_write_args`).
- **Tests** greifen nie aufs Netz zu; GUI-Tests offscreen und ohne modale Dialoge.
- **Stil:** Ruff (Zeilenlänge 100), Typannotationen mit `from __future__ import annotations`.
- **Commits:** beschreibend, deutsch, Zusammenfassung + Stichpunkte.

---

## 10. Git-Historie (Referenz, altes Repo)

| Commit | Inhalt |
|---|---|
| `bd99bd6` | Grundgerüst: Lesen, Anreichern, Schreiben, GUI, CLI |
| `dd388ef` | MOBI/AZW3 (Calibre), Stapelverarbeitung, Cover-Auswahl |
| `d0d351d` | Cover-Optimierung, Send-to-Kindle, Stapel-Fortschritt/Abbruch |
| `b70c94a` | Meilenstein A: Backup/Undo, SQLite-Bibliothek, Serien-Meta, ISBN-Erkennung |
| `c17d6db` | Meilenstein C: Bibliotheks-Tab, Einstellungen-Dialog, Cover-Editor |
| `0ddc896` | Meilenstein B: Fuzzy-Ranking, Spracherkennung, DNB, FB2 |
| `eb29259` | Meilenstein D: CI, PyInstaller, Watch-Ordner, Profile |
| `41bb873` | Feinschliff (Vergleichen, Zuschnitt, Mehrfachauswahl), CBZ/CBR, Sprachfilter, Coverage, CLI-Tests |
| `03ad66d` | README: Einsteiger-Schnellstart |
| `c31df2c` | Merge PR #1 |
| `4b13485` | Apple Books + manueller KI-Recherche-Knopf |
| `7339336` | Merge PR #2 (**letzter Stand von `main`**) |

---

## 11. Offene Ideen (optional, aus `PLAN.md`)

- DjVu lesen
- Comic-Metadaten (`ComicInfo.xml`) auch schreiben
- Kindle-Sammlungen über Serien-Metadaten prüfen/optimieren
- Oberfläche mehrsprachig (i18n)
- Cloud-Backup von Bibliothek/Einstellungen

---

## 12. Startprompt für die neue Session

```text
Lies UMZUG.md im Repo-Root vollständig. Das Projekt kindle-meta zieht in dieses
Repository um. Arbeite die Checkliste in Abschnitt 7 ab:
1. Prüfe, ob alle Dateien aus Abschnitt 3 vorhanden sind (inkl. PR-#2-Inhalte).
2. Installiere gemäß Abschnitt 6, führe Ruff und pytest (offscreen) aus.
   Soll: 89 passed, 1 skipped.
3. Ersetze Verweise auf flogramsch-blip/kindle-meta durch dieses Repo.
4. Committe, pushe und prüfe die CI.
Beachte die Fallstricke in Abschnitt 8 und die Konventionen in Abschnitt 9.
Falls Code fehlt, baue ihn anhand von Abschnitt 4 nach.
```
