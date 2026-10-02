# Aethra – Die Splitterchroniken

Ein kooperatives Idle-RPG für Kollegen: Stages und Bosse allein oder in einer Party mit bis zu sechs Leuten,
auf dem Handy (Hoch- und Querformat, als App installierbar) oder am Rechner. Ein Run läuft auch ohne Eingaben weiter
(Autowalk, Auto-Cast, Auto-Trank, Auto-Ausweichen, Auto-Weiter); wer aktiv spielt, ist schneller und überlebt mehr.

Die Spezifikation liegt in `docs/spec/`, getroffene Entscheidungen und offene Punkte in `docs/OPEN.md`,
der Stand je Meilenstein in `docs/PROGRESS.md`.

## Spielen

1. Die Adresse des Servers öffnen und mit dem **Einladungscode** ein Konto anlegen.
2. Einen Helden erstellen: sechs Klassen (Krieger, Magier, Waldläufer, Schurke, Kleriker, Runenweber), je Klasse ein Held.
3. Im **Lager** liegen die Stationen: Ausrüstung, Schmiede (Element, Waffenstufe, Verzaubern), Juwelier (Gems),
   Archiv (Artefakte, Chronik), Bosstafel und Tavernentisch (Party, Stage-Wahl).
4. **Solo starten** oder eine **Party erstellen** und den sechsstelligen Code weitergeben. Mitspieler lassen sich auch
   direkt aus der Online-Liste einladen. Der Anführer wählt die Stage, alle tippen „Bereit“.
5. Auf dem Handy: im Browser „Zum Startbildschirm hinzufügen“, dann startet das Spiel wie eine App.

**Bedienung:** Stick links unten (Linkshänder: in den Einstellungen umschalten), Fähigkeiten rechts. Langes Drücken auf eine
Fähigkeit schaltet ihren Auto-Cast. Gegner antippen setzt den Fokus, den Boden antippen läuft dorthin, langes Drücken
auf die Szene setzt einen Ping. Am Rechner: WASD bewegen, Leertaste rollen, 1–3 und R Fähigkeiten, F Trank, Q Waffe,
Tab Ziel, T Autowalk, P Pause, Eingabe Chat; die Tasten lassen sich in den Einstellungen ändern.

## Spielen ohne eigenen Server: GitHub Codespaces

GitHub allein (etwa GitHub Pages) reicht nicht: Der Server rechnet die Kämpfe, hält die Verbindungen und speichert die
Spielstände. Ein Codespace ist ein Rechner bei GitHub, auf dem dieser Server läuft, im Rahmen des Freikontingents kostenlos:

1. Diesen Link öffnen:
   <https://codespaces.new/FloG93/JungfernstiegProjekt?quickstart=1&devcontainer_path=.devcontainer/aethra/devcontainer.json>
   (oder auf GitHub: **Code → Codespaces → ⋯ → New with options**, Konfiguration „Aethra (Realm of Coworkers)“).
2. Der erste Aufbau dauert einige Minuten. Danach startet der Server von selbst, und das Terminal zeigt die Adresse
   (`https://…-3000.app.github.dev`) und den Einladungscode.
3. Die Adresse auf dem Handy öffnen, mit dem Code ein Konto anlegen und beides an die Kollegen schicken. Port 3000 wird
   automatisch öffentlich gestellt. Klappt das nicht: im Reiter **PORTS** Rechtsklick auf 3000 → **Port Visibility → Public**.

Gut zu wissen:

- Frei sind für persönliche Konten 120 Kernstunden im Monat, also 60 Stunden auf der kleinsten Maschine mit 2 Kernen.
- Ein Codespace stoppt nach einer Leerlaufzeit (Standard 30 Minuten, unter github.com/settings/codespaces bis 240 Minuten).
  Dann den Link erneut öffnen: Er setzt denselben Codespace fort, der Server startet wieder, Adresse und Spielstände bleiben.
- Nach 30 Tagen ohne Nutzung löscht GitHub den Codespace und damit die Spielstände. Für dauerhaftes Spielen ist ein eigener
  Server besser (siehe unten).
- Den Einladungscode legt der erste Start zufällig an (`.env`). Ein eigener Code geht als Codespaces-Secret `INVITE_CODE`.

## Spielen auf dem eigenen Rechner: `pnpm play`

Mit Node 24 und pnpm 10 (`corepack enable`):

```bash
pnpm install
pnpm play     # baut bei Bedarf, legt .env mit Einladungscode an, startet den Server
```

Das Terminal zeigt die Adressen, zum Beispiel `http://192.168.1.20:3000` für Handys im selben WLAN. Manche Firmen-WLANs
trennen die Geräte voneinander, dann bleibt nur ein Codespace oder ein Server. Ohne HTTPS läuft das Spiel im Browser,
lässt sich aber nicht als App installieren.

## Spielen mit eigenem Raspberry Pi (ohne Docker)

Ein Raspberry Pi im Heimnetz reicht als Server (10 Runs brauchen 3 % eines Kerns). Getestet ist das Paket mit Node 22,
wie es auf dem 32-Bit-Raspberry-Pi-2 läuft (für 32-Bit-ARM gibt es kein Node 24, OPEN-048). Ab dem Raspberry Pi 3 mit
64-Bit-System nimmt das Skript Node 24.

1. **SD-Karte** mit dem Raspberry Pi Imager beschreiben: Gerät „Raspberry Pi 2“, System „Raspberry Pi OS Lite (32-bit)“
   (ab Pi 3: 64-bit). In den Einstellungen des Imagers Hostname `aethra`, Benutzer mit Passwort und SSH einschalten.
2. Den Pi per **LAN-Kabel** mit der Fritzbox verbinden (der Pi 2 hat kein WLAN) und einschalten.
3. **Paket** besorgen: `pnpm pi:bundle` erzeugt `dist/aethra-pi.tar.gz`. Alternativ liegt es nach jedem Push im
   GitHub-Actions-Lauf unter „Artifacts → aethra-pi“ (als ZIP, darin die `.tar.gz`). Auf den Pi kopieren:
   `scp aethra-pi.tar.gz BENUTZER@aethra.local:` (klappt `aethra.local` nicht: `aethra.fritz.box` oder die IP aus der Fritzbox).
4. Auf dem Pi (`ssh BENUTZER@aethra.local`):
   ```bash
   tar xzf aethra-pi.tar.gz
   sudo ./aethra/install.sh
   ```
   Beim ersten Mal dauert das auf dem Pi 2 etwa 15 bis 30 Minuten.
5. Die Frage nach **Tailscale Funnel** mit „J“ beantworten, den angezeigten Link öffnen und mit einem kostenlosen
   Tailscale-Konto anmelden. Fragt Tailscale nach dem Freischalten von HTTPS oder Funnel, bestätigen. Am Ende zeigt das
   Skript die feste Adresse (`https://aethra.….ts.net`) und den Einladungscode. Die Adresse funktioniert im Büro, im
   Heimnetz und über mobile Daten. In der Fritzbox ist keine Portfreigabe nötig, auch nicht bei DS-Lite.

Gut zu wissen:

- **Aktualisieren:** neues Paket kopieren, dann `rm -rf aethra && tar xzf aethra-pi.tar.gz && sudo ./aethra/install.sh`.
  Spielstände und Einstellungen bleiben.
- **Bedienung:** `systemctl status aethra`, `journalctl -u aethra -f`, Verwaltung mit `sudo aethra-admin help`.
  Einstellungen in `/etc/aethra/aethra.env`, Daten und Sicherungen in `/var/lib/aethra`.
- **VPN:** Der Pi selbst sollte nicht über einen VPN-Anbieter (etwa hide.me) ins Netz gehen; auf den Handys stört ein VPN nicht.
- **Node 22** bekommt Sicherheitsupdates bis April 2027. Danach braucht es einen 64-Bit-Pi (ab Raspberry Pi 3) oder einen
  anderen Rechner.

## Betreiben

### Mit Docker (empfohlen)

```bash
cp .env.example .env        # INVITE_CODE und SESSION_SECRET (mindestens 16 Zeichen) setzen
docker compose up -d        # Server auf Port 3000, Daten und Sicherungen in ./data
```

Für den Zugang von außen gehört ein Reverse Proxy mit TLS davor (WebSocket unter `/ws`), zum Beispiel Caddy:

```
spiel.example.de {
  reverse_proxy localhost:3000
}
```

Dann in `.env` zusätzlich `COOKIE_SECURE=1` setzen.

### Ohne Docker

Am einfachsten mit `pnpm play` (siehe oben) oder dem Raspberry-Pi-Paket, das auf jedem Debian-Rechner läuft.
Der Server läuft ab Node 22, entwickelt wird mit Node 24. Von Hand mit Node 24 und pnpm 10 (`corepack enable`):

```bash
pnpm install
pnpm build
cd apps/server && SESSION_SECRET=… INVITE_CODE=… node dist/main.js
```

### Umgebungsvariablen

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `PORT` | 3000 | HTTP und WebSocket |
| `DB_PATH` | `./data/aethra.db` | SQLite-Datei |
| `SESSION_SECRET` | – (Pflicht) | Signatur der Sitzungs-Cookies, mindestens 16 Zeichen |
| `INVITE_CODE` | – (Pflicht) | Einladungscode für neue Konten |
| `TICK_RATE` | 20 | Takt der Simulation pro Sekunde (Echtzeit; höhere Werte beschleunigen, nur für Tests) |
| `BOSS_TIMER_SCALE` | 1.0 | Faktor für alle Boss-Timer (0 zum Testen) |
| `LOG_LEVEL` | `info` | Protokollstufe |
| `COOKIE_SECURE` | aus | `1` hinter HTTPS |
| `ALLOWED_ORIGINS` | – | weitere Adressen, die den WebSocket öffnen dürfen, mit Komma getrennt; nötig, wenn ein Proxy den Host umschreibt (nginx ohne `proxy_set_header Host $host`). Im Codespace setzt `pnpm play` sie selbst |
| `BACKUP_DIR` | `<DB-Ordner>/backups` | Ziel der Sicherungen |
| `BACKUP_KEEP_DAYS` | 14 | Aufbewahrung der Sicherungen in Tagen |
| `BACKUP_HOUR` | 3 | Stunde der nächtlichen Sicherung |
| `PUBLIC_DIR`, `CONTENT_DIR` | im Image gesetzt | gebauter Client und Inhaltsdateien |

### Sicherung, Verwaltung, Überwachung

- **Sicherung:** beim Start (also vor jedem Update) und jede Nacht um `BACKUP_HOUR`, 14 Tage aufbewahrt, als
  vollständige SQLite-Dateien in `data/backups/`. Wiederherstellen: Server stoppen, Sicherung als `data/aethra.db`
  kopieren, Server starten.
- **Verwaltung** (`docker compose exec aethra node dist/admin.js …` bzw. `pnpm admin …`):
  `reset-password <benutzer> <passwort>`, für Support und Tests außerdem `gold`, `splinters`, `level`, `gear`, `item`,
  `gems`, `weapon-level`, `clear`. Ohne Argumente zeigt das Werkzeug alle Befehle.
- **Überwachung:** `GET /api/health` liefert Version, Inhalts-Hash, laufende Runs und Speicher.
- Ein Neustart bricht laufende Runs ab; erhaltene Beute und Fortschritt bleiben (gespeichert je Begegnung und sofort beim Drop).

## Entwickeln

```bash
pnpm install
cp .env.example .env     # für pnpm dev
pnpm dev                 # Client auf :5173 (leitet /api, /ws, /content an :3000 weiter), Server auf :3000
```

| Befehl | Zweck |
| --- | --- |
| `pnpm lint`, `pnpm typecheck`, `pnpm test` | ESLint, TypeScript, Vitest (Simulation, Server, Protokoll, Client-Logik) |
| `pnpm balance` | Inhaltsprüfungen und Referenzmodell (13.9) samt gemessenem K |
| `pnpm e2e` | baut alles und spielt im Browser (Playwright, Handy-Ansicht); lokal mit `PW_CHROMIUM=/pfad/zu/chrome` |
| `pnpm play` | baut bei Bedarf und startet den Server zum Spielen (auch im Codespace) |
| `pnpm pi:bundle` | Paket für den Raspberry Pi und andere Rechner ohne Docker (`dist/aethra-pi.tar.gz`) |
| `pnpm --filter @aethra/server loadtest` | 10 Runs mit je 6 Helden, misst die Rechenzeit (`RUNS`, `SECONDS`) |
| `pnpm content:check` | Inhaltsdateien gegen die Spezifikation |

Aufbau:

| Pfad | Inhalt |
| --- | --- |
| `packages/shared` | Simulation (deterministisch, 20 Ticks/s), Formeln, Beute, Protokoll, Snapshots |
| `packages/content` | alle Spieldaten als JSON (keine Spielzahl im Code) |
| `apps/server` | Fastify, SQLite (Kysely), WebSocket-Gateway, Lobby, Runs, Sicherung, Verwaltung |
| `apps/client` | Vite, Preact (Menüs, HUD), Phaser 4 (Spielszene), PWA |
| `tools/balance` | `pnpm balance`, TypeScript-Port des Referenzmodells |
| `e2e` | Browser-Tests (Abnahme M7, M8, Leistung) |

## Kennzahlen

Gemessen am 2. Oktober 2026 (Details in `docs/PROGRESS.md`):

- Lasttest: 10 Runs mit je 6 Helden über 10 Minuten Spielzeit brauchen 3 % eines CPU-Kerns (Ziel: unter 60 %).
- Netz: rund 7 KB/s je Client komprimiert (Ziel: unter 30 KB/s), Snapshots höchstens rund 6 KB (Grenze 8 KB).
- Client: Erstladen 281 KB (Ziel: unter 3 MB), die Spielszene rechnet mit 6 Helden und 40 Gegnern rund 1 ms je Frame.
