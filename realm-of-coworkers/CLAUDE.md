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

## Mitgeliefert
- packages/content/ ist vollständig und geprüft (17.5). In M1 nur Loader und Zod-Schemas bauen, die Daten nicht neu erzeugen.
- tools/validate_content.py und tools/crosscheck_balance.py laufen in der CI und in pnpm balance mit.
- docs/OPEN.md enthält bereits getroffene Entscheidungen (E-001 bis E-019) und offene Fragen.
