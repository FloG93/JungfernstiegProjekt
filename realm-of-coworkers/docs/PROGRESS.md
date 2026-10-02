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
| M7 Client-Grundlage | erledigt | 2026-10-02 | Mobiler Client (E-022): Phaser-4-Szene mit Platzhalter-Figuren aus Code, Parallax je Kapitel, Telegraphen in drei Darstellungen (14.6), schwebende Zahlen, Pings. Interpolation mit 100 ms Puffer, Extrapolation bis 250 ms, Vorhersage der eigenen Bewegung mit Korrektur ab 24 px in 100 ms. Touch-HUD (Stick, Fähigkeiten mit Auto-Cast per langem Drücken, Trank, Rolle, Wechsel), Tastatur nach 14.7, Party-Leiste, Stage- und Boss-Leiste, Bereit-Bildschirm am Tor, Wiederverbinden. WebAudio-Klänge ohne Dateien. Abnahme: Playwright spielt Stage 1 solo auf dem Handy-Viewport bis zur Truhe (OPEN-038 bis OPEN-040) |
| M8 Lager und Menüs | erledigt | 2026-10-02 | Anmeldung, Heldenwahl und -erstellung, Lager mit Schmiede, Juwelier, Archiv (Chronik), Bosstafel, Tavernentisch, Ausrüstung mit Vergleich und Empfehlung (14.5), Beute-Bildschirm mit „Alles Empfohlene anlegen“, Einstellungen (Ton, Barrierefreiheit, Idle-Schalter), Online-Liste, Einladungen, Chat mit Schnellnachrichten, PWA. Verwaltung per `pnpm admin`. Abnahme: Playwright-Ablauf Registrieren, Held erstellen, ausrüsten, Gem kombinieren, verzaubern (OPEN-037) |
| M9 Mehrspieler | erledigt | 2026-10-02 | WebSocket `/ws` mit Cookie-Anmeldung, Origin-Prüfung, hello/4001, Ersetzen alter Verbindungen (4002), Zod-Prüfung und Rate-Limits. Lobby mit Online-Liste (Abwesend nach 10 min), Party per Code und Einladung, Anführer, Stage-Wahl mit Nachzügler-Regel, Bereit, Countdown, Chat. RunInstance: Simulation 20 Hz auf dem Server, Delta-Snapshots 10 Hz (vollständig alle 5 s), Ereignisse sofort, Topf-Regel je Spieler, Elite-Beute, Truhe, Boss-Beute mit Helfer und Kampfstufe, Autopilot 90 s, Wiedereinstieg am Checkpoint, Solo-Pause, Auto-Weiter, run_log mit Seed und Eingaben. Messung 6 Clients (3 × 150 ms, 3 × 400 ms), Stage 2: 5,8 KB/s komprimiert je Client (Ziel < 30), Snapshot höchstens 6,1 KB (Grenze 8), Eingaben nach einer Rundlaufzeit bestätigt, alle sehen dieselbe Welt. Annahmen OPEN-027 bis OPEN-036 |
| M10 pnpm balance | offen | | TypeScript-Port von tools/balance/reference/ref_model.py |
| M11 Politur | offen | | |
| M12 Härtung und Betrieb | offen | | |

## Bereits vorhanden (vor M0 eingebracht)

- `docs/spec/` – Spezifikation, eine Datei je Abschnitt
- `packages/content/` – alle Inhaltsdateien aus 15.5, fertig und geprüft
- `tools/validate_content.py`, `tools/crosscheck_balance.py`, `tools/balance/reference/ref_model.py`
- `CLAUDE.md`, `docs/OPEN.md`, Workspace-Dateien und CI

## Letzte Sitzung

2026-10-02: M7, M8 und M9 abgeschlossen. 230 Unit-Tests und 2 Browser-Tests grün. Offen: M10 bis M12. Nächster Schritt: M10 `pnpm balance` als TypeScript-Port von ref_model.py.
