## 17 Übergabe an Claude Code

Diese Spezifikation wird mit Claude Code umgesetzt. Dieser Abschnitt legt fest, wie das Dokument ins Repository kommt und nach welchen Regeln gearbeitet wird.

### 17.1 Dokument ins Repository

1. Das Dokument als Markdown exportieren und in `docs/spec/` je Abschnitt eine Datei anlegen: `01-vision.md`, `02-technik.md`, `03-welt.md`, `04-klassen.md`, `05-werte.md`, `06-kampf.md`, `07-gems-artefakte.md`, `08-ausruestung.md`, `09-level.md`, `10-bosse.md`, `11-multiplayer.md`, `12-progression.md`, `13-balancing.md`, `14-oberflaeche.md`, `15-datenmodell.md`, `16-umsetzung.md`, `17-uebergabe.md`. So lädt Claude Code nur die Abschnitte, die eine Aufgabe braucht.
2. Den Code aus Anhang A unverändert als `tools/balance/reference/ref_model.py` ablegen. `python3 ref_model.py` muss die Werte aus Abschnitt 13 ausgeben.
3. `CLAUDE.md` mit dem Inhalt aus 17.2 ins Wurzelverzeichnis legen und `docs/PROGRESS.md` leer anlegen.

   Das fertige Content-Paket übernehmen: `packages/content/` mit allen Dateien aus 15.5, `tools/validate_content.py`, `tools/crosscheck_balance.py` und `docs/OPEN.md`. Die Inhalte sind bereits erzeugt und geprüft (17.5). Meilenstein M1 übernimmt sie, statt sie neu zu schreiben.
4. Dieses Dokument bleibt die führende Fassung. Nach Änderungen werden die betroffenen Dateien in `docs/spec/` neu exportiert.

### 17.2 Inhalt von CLAUDE.md

```markdown
# Realm of Coworkers – Regeln für Claude Code

## Quelle der Wahrheit
- Spezifikation: docs/spec/ (Rangfolge in 01-vision.md, Abschnitt 1.6).
- Vor jeder Aufgabe die betroffenen Abschnitte lesen, nicht die ganze Spezifikation.
- Referenzmodell: tools/balance/reference/ref_model.py.

## Harte Regeln
1. Keine Spielzahl im Code. Jede Zahl kommt aus packages/content/*.json.
2. Nicht raten. Fehlt eine Regel oder widersprechen sich Stellen: Eintrag in docs/OPEN.md
   (Abschnitt, Frage, Vorschlag), die einfachste spezifikationstreue Annahme treffen,
   im Code mit // OPEN-<Nummer> markieren.
3. Die Simulation liegt nur in packages/shared und ist deterministisch: kein Date.now,
   kein Math.random, keine Abhängigkeit von der Reihenfolge ungeordneter Objekte.
   Zufall nur über den Run-Zufallsgenerator (mulberry32).
4. Der Server ist autoritativ. Der Client berechnet weder Schaden noch Beute.
5. Mechaniken außerhalb des Effekt-Schemas nur als Handler (15.5): eine Datei und ein Test je Handler.
6. IDs und Feldnamen exakt wie in 15-datenmodell.md.

## Arbeitsablauf
- Ein Meilenstein (16.2) pro Sitzung, in Reihenfolge M0 bis M12.
- Zuerst die Tests für die Abnahme schreiben, dann umsetzen.
- Nach jeder Änderung: pnpm lint && pnpm typecheck && pnpm test, ab M10 zusätzlich pnpm balance.
- Ein Commit je abgeschlossenem Teilschritt, Nachricht mit Präfix des Meilensteins ("M3: Spawn-Budget").
- Am Ende jeder Sitzung docs/PROGRESS.md aktualisieren: erledigt, offen, nächster Schritt.

## Befehle
pnpm install · pnpm dev · pnpm test · pnpm balance · pnpm build · docker compose up
```

### 17.3 Ablauf pro Meilenstein

Eine Claude-Code-Sitzung je Meilenstein. M1 legt alle Content-Dateien vollständig an, bevor Kampflogik entsteht. Vorlage für den Auftrag:

```text
Lies CLAUDE.md, docs/PROGRESS.md und docs/spec/16-umsetzung.md.
Setze Meilenstein M3 um. Relevante Abschnitte: docs/spec/09-level.md,
docs/spec/06-kampf.md und docs/spec/15-datenmodell.md.
Schreibe zuerst die Tests für die Abnahme aus 16.2, dann die Umsetzung.
Trage Unklarheiten in docs/OPEN.md ein, statt zu raten.
Höre auf, sobald die Abnahme grün ist, und aktualisiere docs/PROGRESS.md.
```

Nach jeder Sitzung werden die Einträge in `docs/OPEN.md` geklärt und in dieses Dokument übernommen (17.1, Punkt 4).

### 17.4 Wann ein Meilenstein fertig ist

- `pnpm lint`, `pnpm typecheck`, `pnpm test` und ab M10 `pnpm balance` laufen grün.
- Die Abnahme aus 16.2 ist durch automatische Tests belegt.
- In `packages/shared/src/sim` meldet die Lint-Regel `no-magic-numbers` keine Verstöße (erlaubt sind 0, 1, −1, 2 und 100).
- Neue offene Punkte stehen in `docs/OPEN.md`, der Stand in `docs/PROGRESS.md`.

### 17.5 Mitgeliefertes Content-Paket

Alle Dateien aus 15.5 sind fertig erzeugt und maschinell geprüft. Claude Code übernimmt sie unverändert und erzeugt in M1 nur noch den Loader und die Zod-Schemas.

| Bestandteil | Umfang |
| --- | --- |
| Klassen und Fähigkeiten | 6 Klassen, 36 Fähigkeiten |
| Statuseffekte und Elemente | 27 Statuseffekte, 7 Elemente |
| Gegner und Level | 9 Gegnertypen mit Elite, 6 Arenen, Paletten, 30 Stages |
| Bosse | 6 Bosse mit Phasen, Angriffen und Signaturangriffen |
| Ausrüstung und Beute | Namensbausteine, zwei Beutetabellen, Gems, 18 Artefakte |
| Werte und Texte | `balance.json`, 30 Stage-Texte, 12 Dialoge, Epilog, 222 Oberflächentexte |

Zwei Prüfwerkzeuge gehören dazu und laufen in `pnpm balance` und in der CI mit:

- `tools/validate_content.py` prüft jede Datei gegen diese Spezifikation: IDs, Schemas, Wertebereiche, Summen der Wahrscheinlichkeiten, Querverweise zwischen den Dateien, die Koeffizienten K je Klasse (13.2) und die Auflösung jedes Artefakt-Pfades auf eine vorhandene Fähigkeit oder einen vorhandenen Parameter.
- `tools/crosscheck_balance.py` rechnet die Daten gegen das Referenzmodell aus Anhang A nach: RefLeben, Boss-Leben nach 13.4, Kampfdauer je Klasse gegen die Grenzen aus 13.9, XP- und Gold-Kurve sowie die Obergrenzen für Gems und Artefakte.

Entscheidungen, die beim Erzeugen nötig waren (E-001 bis E-019), stehen in `docs/OPEN.md` und sind in dieser Spezifikation nachgetragen.
