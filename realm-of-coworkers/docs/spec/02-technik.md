## 2 Technischer Rahmen

Das Spiel ist ein TypeScript-Monorepo: Phaser-3-Client, autoritativer Node-Server mit WebSocket, SQLite als Speicher, alles in einem Docker-Container. Der Server rechnet jeden Kampf. Der Client zeigt nur an und sendet Absichten.

### 2.1 Technologie-Stack

| Bereich | Wahl | Hinweis |
| --- | --- | --- |
| Sprache | TypeScript 5, `strict: true` | Ein Typensatz für Client und Server |
| Paketverwaltung | pnpm Workspaces | 4 Pakete, siehe 2.2 |
| Client | Vite (aktuelle Hauptversion), Phaser 4.1 (WebGL) | Menüs, Inventar und Tooltips als HTML/CSS mit Preact über dem Canvas |
| Server | Node 24 LTS, Fastify 5, `ws` | Eingaben mit Zod validiert |
| Datenbank | SQLite via `better-sqlite3`, Migrationen mit Kysely | Datei `data/aethra.db` |
| Login | Benutzername + Passwort (argon2id), Einladungscode | httpOnly-Session-Cookie, `sameSite=lax` |
| Tests | Vitest (Simulation, Balance), Playwright (Rauchtest) |  |
| Deployment | Multi-Stage-`Dockerfile` und `docker-compose.yml` | TLS/WSS über Reverse Proxy (Caddy oder nginx) |
| CI | GitHub Actions: lint, typecheck, test, build, `pnpm balance` | Balance-Test bricht bei Verstößen gegen Abschnitt 13 ab |

Die genauen Versionen legt Meilenstein M0 fest und pinnt sie in `package.json` (`engines.node` mindestens 24). Es gilt die API von Phaser 4. Beispiele für Phaser 3 sind nicht ohne Prüfung übertragbar. Laut Release-Hinweisen bringt Phaser 4 einen `skills/`-Ordner mit Phaser-4-Wissen mit; Claude Code bindet ihn beim Einrichten ein.

### 2.2 Repository-Struktur

```text
realm-of-coworkers/
  CLAUDE.md                  Arbeitsregeln für Claude Code (17.2)
  apps/client/               Vite + Phaser 4 + Preact-UI
  apps/server/               Fastify, WebSocket-Gateway, Lobby, RunInstance
  packages/shared/           Typen, Zod-Schemas, Protokoll, Formeln, deterministische Simulation, Handler
  packages/content/          JSON-Inhalte (15.5)
  tools/balance/             pnpm balance: TypeScript-Port des Referenzmodells, Grenzen aus 13.9
  tools/balance/reference/   ref_model.py (Anhang A), unverändert
  data/                      SQLite-Datei (nicht im Git)
  docs/spec/                 diese Spezifikation, eine Markdown-Datei je Abschnitt
  docs/OPEN.md               offene Fragen und gefundene Widersprüche
  docs/PROGRESS.md           Stand der Umsetzung je Meilenstein
```

Pfadangaben der Form `content/…` in diesem Dokument meinen immer `packages/content/…`.

### 2.3 Architektur

| Komponente | Aufgabe |
| --- | --- |
| Client | Rendert mit 60 FPS, interpoliert Server-Snapshots (100 ms Puffer), sendet Eingaben, zeigt UI |
| Gateway | WebSocket-Verbindungen, Login-Prüfung, Rate-Limit (max. 30 Nachrichten/s je Client) |
| Lobby-Service | Parties, Einladungscodes, Bereit-Status, Stage-Auswahl |
| RunInstance | Eine laufende Stage. Simulation mit 20 Ticks pro Sekunde (50 ms). Genau eine pro Party |
| Persistenz | Speichert Helden, Inventar, Timer und Fortschritt transaktionell |
| Content-Loader | Liest und validiert alle JSON-Dateien beim Serverstart, Startabbruch bei Fehlern |

Regeln:

- Der Solo-Modus ist eine RunInstance mit einem Spieler. Es gibt nur einen Codepfad.
- Die Simulation liegt in `packages/shared` und ist deterministisch (Zufall über `mulberry32` mit Seed pro Run). Damit lassen sich Kämpfe in Tests exakt wiederholen.
- Server sendet 10 Mal pro Sekunde Delta-Snapshots (jeder zweite Tick) und Ereignisse (Treffer, Tod, Loot) sofort.
- Der Client sendet höchstens 20 Eingaben pro Sekunde: Bewegung, Fähigkeit, Ausweichen, Waffenwechsel, Trank, Fokusziel.

### 2.4 Verbindungsabbruch

Bei Abbruch hält der Server den Helden 90 Sekunden im **Autopilot** (Automatikangriff, keine Fähigkeiten, keine Bewegung). Kehrt der Spieler mit demselben Session-Token zurück, übernimmt er den Helden wieder. Nach 90 Sekunden wird der Held aus dem Run entfernt und die Gegnerstärke passt sich der neuen Gruppengröße an (Abschnitt 11). Ist keiner mehr verbunden, endet der Run nach 5 Minuten.

### 2.5 Speichern

- Gespeichert wird bei Loot-Erhalt, Levelabschluss, Bossabschluss, Ausrüstungsänderung und Verzauberung, jeweils in einer Transaktion.
- Der Run-Zustand selbst wird nicht gespeichert. Ein Serverneustart bricht laufende Runs ab, bereits erhaltener Loot bleibt erhalten.
- Loot wird beim Drop sofort in die Datenbank geschrieben, nicht erst am Levelende.

### 2.6 Integrität

Der Server prüft jede Eingabe: Abklingzeiten, Reichweiten, Besitz von Items, Slot-Regeln. Der Client hat keine Autorität über Schaden, Loot oder Timer. Ungültige Nachrichten werden verworfen und geloggt.

### 2.7 Leistungsziele

- Client: 60 FPS mit 6 Helden und bis zu 40 Gegnern und Projektilen auf einem Laptop mit integrierter Grafik.
- Server: höchstens 5 % einer CPU-Kern-Auslastung pro laufendem Run, mindestens 10 gleichzeitige Runs.
- Erstladen des Clients unter 3 MB (ohne Audio).

### 2.8 Umgebungsvariablen

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `PORT` | 3000 | HTTP/WebSocket-Port |
| `DB_PATH` | `./data/aethra.db` | SQLite-Datei |
| `SESSION_SECRET` | keiner (Pflicht) | Signatur der Session-Cookies |
| `INVITE_CODE` | keiner (Pflicht) | Einladungscode für die Registrierung |
| `TICK_RATE` | 20 | Simulations-Ticks pro Sekunde |
| `BOSS_TIMER_SCALE` | 1.0 | Faktor für alle Boss-Timer (0 zum Testen) |
| `LOG_LEVEL` | `info` | Protokollstufe |
