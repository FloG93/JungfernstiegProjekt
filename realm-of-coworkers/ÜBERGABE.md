# Übergabe an Claude Code

Dieses Verzeichnis ist das vorbereitete Repository für `realm-of-coworkers`.

## Einrichten

```bash
git init && git add -A && git commit -m "Spezifikation, Inhalte und Gerüst"
```

Danach Claude Code im Verzeichnis öffnen und den Auftrag für M0 aus `docs/AUFTRAEGE.md` senden.

## Was schon da ist

| Pfad | Inhalt |
| --- | --- |
| `CLAUDE.md` | Arbeitsregeln (Spezifikation 17.2) |
| `docs/spec/` | Spezifikation, eine Datei je Abschnitt, plus Übersicht |
| `docs/OPEN.md` | Entscheidungen E-001 bis E-019 und offene Fragen |
| `docs/PROGRESS.md` | Stand je Meilenstein |
| `docs/AUFTRAEGE.md` | fertige Auftragstexte je Meilenstein |
| `packages/content/` | alle Inhaltsdateien, fertig und geprüft |
| `tools/validate_content.py` | prüft die Inhalte gegen die Spezifikation |
| `tools/crosscheck_balance.py` | rechnet die Inhalte gegen das Referenzmodell nach |
| `tools/balance/reference/ref_model.py` | Referenzmodell, identisch mit Anhang A |
| `package.json`, `pnpm-workspace.yaml`, `.github/workflows/ci.yml`, `.env.example`, `.gitignore` | Gerüst und CI |

## Prüfen

```bash
python3 tools/validate_content.py
python3 tools/crosscheck_balance.py
```

Beide müssen ohne Fehler durchlaufen. Sie hängen auch in `pnpm content:check` und in der CI.

## Vor dem Start noch klären

- Boss-Timer und Kampfstufe: pro Held (so geschrieben) oder pro Account? Kommentar im Dokument bei 10.9.
- OPEN-002, OPEN-003, OPEN-004 in `docs/OPEN.md` (alle unkritisch).

Die führende Fassung der Spezifikation bleibt das Claude-Dokument. Nach Änderungen dort die
betroffenen Dateien in `docs/spec/` neu exportieren (17.1).
