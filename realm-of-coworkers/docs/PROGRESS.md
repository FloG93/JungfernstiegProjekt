# Stand der Umsetzung

Je Sitzung einen Meilenstein (16.2). Nach jeder Sitzung diesen Stand aktualisieren.

| Meilenstein | Status | Datum | Hinweise |
| --- | --- | --- | --- |
| M0 Gerüst | erledigt | 2026-10-01 | pnpm-Workspace, TS 6 strict mit Projektverweisen, ESLint 10 (no-magic-numbers in sim), Vitest 5, Dockerfile, docker-compose, CI im Repo-Wurzelverzeichnis |
| M1 Shared-Kern | erledigt | 2026-10-01 | Zod-Schemas aller Dateien, Loader mit Querprüfungen, Formeln, Werteberechnung, Item-Erzeugung, mulberry32. Ergänzte Dateien siehe OPEN-006 bis OPEN-008 |
| M2 Kampfsimulation | erledigt | 2026-10-01 | Tick-Simulation (20 Hz), Effekt-Schema, 15 Helden-Handler mit eigener Datei und Test, Status (6.3/6.4), Bedrohung, Zonen/Telegraphen, Auto-Cast. Gemessenes K: Krieger 1,119 · Magier 1,657 · Waldläufer 1,649 · Schurke 1,664 · Kleriker 0,655 · Runenweber 0,839 (OPEN-013) |
| M3 Gegner, Stages, Autowalk | offen | | |
| M4 Bosse | offen | | |
| M5 Persistenz und HTTP | offen | | |
| M6 Beute und Fortschritt | offen | | |
| M7 Client-Grundlage | offen | | |
| M8 Lager und Menüs | offen | | |
| M9 Mehrspieler | offen | | |
| M10 pnpm balance | offen | | TypeScript-Port von tools/balance/reference/ref_model.py |
| M11 Politur | offen | | |
| M12 Härtung und Betrieb | offen | | |

## Bereits vorhanden (vor M0 eingebracht)

- `docs/spec/` – Spezifikation, eine Datei je Abschnitt
- `packages/content/` – alle Inhaltsdateien aus 15.5, fertig und geprüft
- `tools/validate_content.py`, `tools/crosscheck_balance.py`, `tools/balance/reference/ref_model.py`
- `CLAUDE.md`, `docs/OPEN.md`, Workspace-Dateien und CI

## Letzte Sitzung

Noch keine. Nächster Schritt: M0 nach 16.2.
