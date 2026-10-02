# Content-Paket für realm-of-coworkers

> Ursprünglich die README des vorbereiteten Pakets. Die Inhalte sind seit M1 eingebunden; die Anleitung zum Spiel und zum Betrieb steht in der README im Wurzelverzeichnis.

Fertige Inhaltsdateien und Prüfwerkzeuge zur Spezifikation „Realm of Coworkers – RPG Web-App“.
Claude Code übernimmt dieses Paket in Meilenstein M1 (Abschnitt 16.2) und erzeugt die Daten nicht selbst.

## Einbinden

1. Ordner `packages/content/` und `tools/` ins Repository kopieren.
2. `docs/OPEN.md` übernehmen und weiterführen.
3. Prüfen: `python3 tools/validate_content.py` und `python3 tools/crosscheck_balance.py`.
4. Beide Prüfungen gehören in `pnpm balance` (Meilenstein M10) und in die CI.

## Inhalt

| Datei | Inhalt | Spezifikation |
| --- | --- | --- |
| `classes.json` | 6 Klassen | 4, 5.4 |
| `skills.json` | 36 Fähigkeiten | 4 |
| `status.json` | 27 Statuseffekte | 6.3, 6.4 |
| `elements.json` | 7 Elemente | 6.1, 14.8 |
| `enemies.json` | 9 Gegnertypen und Elite | 9.3, 9.7 |
| `arenas.json` | 6 Arenen | 10.2 |
| `levels/palette.json` | Gegneranteile je Kapitel | 9.5 |
| `levels/stage-01.json` bis `stage-30.json` | 30 Stages | 9 |
| `bosses.json` | 6 Bosse | 10 |
| `items/names.json` | Namensbausteine | 8.3, 8.5 |
| `loot/stage-loot.json`, `loot/boss-drops.json` | Beutetabellen | 12.8, 10.8 |
| `gems.json`, `artifacts.json` | Gems und 18 Artefakte | 7 |
| `balance.json` | alle Konstanten | 15.5 |
| `story/kapitel1.json` bis `kapitel6.json` | 30 Stage-Texte, 12 Bossdialoge, Epilog | 3.2 |
| `i18n/de.json` | 222 Oberflächentexte | 14.10 |

## Prüfwerkzeuge

- `tools/validate_content.py` prüft jede Datei gegen die Spezifikation: IDs, Schemas, Wertebereiche, Summen von Wahrscheinlichkeiten, Querverweise zwischen den Dateien und die Koeffizienten K je Klasse.
- `tools/crosscheck_balance.py` rechnet die Daten gegen das Referenzmodell (Anhang A der Spezifikation) nach: RefLeben, Boss-Leben, Kampfdauer je Klasse, XP- und Gold-Kurve, Obergrenzen.
- `tools/balance/reference/ref_model.py` ist das Referenzmodell selbst, unverändert aus Anhang A.

Beide Prüfskripte melden Fehler mit Verweis auf den Abschnitt und enden mit Exit-Code 1.
