# Stand der Umsetzung

Je Sitzung einen Meilenstein (16.2). Nach jeder Sitzung diesen Stand aktualisieren.

| Meilenstein | Status | Datum | Hinweise |
| --- | --- | --- | --- |
| M0 Gerüst | erledigt | 2026-10-01 | pnpm-Workspace, TS 6 strict mit Projektverweisen, ESLint 10 (no-magic-numbers in sim), Vitest 5, Dockerfile, docker-compose, CI im Repo-Wurzelverzeichnis |
| M1 Shared-Kern | erledigt | 2026-10-01 | Zod-Schemas aller Dateien, Loader mit Querprüfungen, Formeln, Werteberechnung, Item-Erzeugung, mulberry32. Ergänzte Dateien siehe OPEN-006 bis OPEN-008 |
| M2 Kampfsimulation | erledigt | 2026-10-01 | Tick-Simulation (20 Hz), Effekt-Schema, 15 Helden-Handler mit eigener Datei und Test, Status (6.3/6.4), Bedrohung, Zonen/Telegraphen, Auto-Cast. Gemessenes K: Krieger 1,119 · Magier 1,657 · Waldläufer 1,649 · Schurke 1,664 · Kleriker 0,655 · Runenweber 0,839 (OPEN-013) |
| M3 Gegner, Stages, Autowalk | erledigt | 2026-10-01 | Gegner-KI (Bedrohung, 110 %, Spott, Angriffsplätze, Fernkampf), Spawn-Budget, Begegnungen, Checkpoints, Leine, Gefahren, Wipe, Topf-Regel, Elite-Beute. Kampfzeit 6 Klassen: 152 s / 173 s (Modell 161 / 160), Magier und Schurke solo innerhalb ±15 %; übrige Solo-Werte in OPEN-024 |
| M4 Bosse | erledigt | 2026-10-01 | 6 Bosse mit vier Angriffen, Signaturen, Passiven, Phasen und Elementwechsel, Wutwechsel, Adds, Enrage, Kampfstufe, Wipe und Neustart; Auto-Ausweichen (E-023). Dauer normalisiert innerhalb ±10 % für Magier, Waldläufer, Schurke; Messwerte und Vorschlag für Krieger und Kleriker in OPEN-025 |
| M5 Persistenz und HTTP | erledigt | 2026-10-01 | SQLite mit Kysely-Migrationen, Konten (argon2id, Einladungscode, signiertes Cookie 30 Tage), alle Endpunkte aus 15.2 mit Tests, Transaktionen, HERO_IN_RUN, Überlauftruhe mit automatischem Verkauf (8.9) |
| M6 Beute und Fortschritt | erledigt | 2026-10-01 | Beute aus Truhen, Elite und Bossen (10.000 Würfe unter 2 Prozentpunkten), Topf-Regel, XP mit Stufenaufstieg, Waffen-XP, Boss-Timer und Kampfstufe. Kampagne 224.654 XP (12.4 exakt), 28.674 Gold, Ausrüstungskurve 12.9 innerhalb ±0,03 |
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
