# CLAUDE.md – Schussauswertung Live

Kontext für jede Sitzung. Maßgeblich ist die vollständige Arbeitsanweisung in
`docs/ANWEISUNG.md`; der freigegebene Umsetzungsplan steht in `docs/PLAN.md`.
Der Rest des Repos (`kindle_meta/`, `packaging/`, `pyproject.toml` usw.) ist ein
anderes Projekt und wird hier nicht angefasst.

## Ziel (Abschnitt 1)

PWA für ein Android-Handy, das fest an einem Spektiv hängt und die 25-m-Pistolenscheibe
live filmt. Die App

- erkennt die Scheibe automatisch und kalibriert Pixel → Millimeter,
- erkennt jeden neuen Treffer live aus dem Kamerastream,
- liefert Position, Abweichung von der Mitte (mm, Richtung) und Ringzahl,
- analysiert Gruppen (Gruppenmittelpunkt = systematischer Versatz, Streukreis, Trend),
- gibt alles als Text und per Sprachausgabe (de-DE) aus.

Wichtigste Prämisse: Nach der einmaligen Einrichtung läuft die App **ohne Bedienung**.

## Harte Rahmenbedingungen (Abschnitt 2)

- Nur Web-App/PWA, Ziel aktueller Chrome auf Android. Keine APK, kein Capacitor.
- Kein Server-Backend, keine Cloud-KI, keine Bild-Uploads – alles läuft auf dem Handy.
- Nach dem ersten Laden vollständig offline (Service Worker, alle Assets lokal).
- Eingabe nur der Live-Kamerastream; kein Foto-Modus in der Oberfläche.
  Synthetische Bilder/Videos und Fake-Kamera sind für Entwicklung und Tests erlaubt.
- Prototyp: 25 m Pistole, Präzisionsscheibe. Weitere Scheiben nur als Konfigurationsdatensatz.
- Sprache: Oberfläche, Sprachausgabe und Nutzerdoku Deutsch; Bezeichner, Kommentare und
  Commit-Nachrichten Englisch.
- Datenschutz: keine Telemetrie, keine Tracker, keine externen Requests nach dem Laden.
- Zusatzwunsch des Nutzers: Anmeldung mit Name und Passwort. Die Whitelist liegt nicht im
  Browser, sondern unzugänglich beim Repo (GitHub-Secret); Details in `docs/PLAN.md`.

## Offene Punkte (Abschnitt 3) – bis zur Antwort konfigurierbar mit Standardwert

| Punkt | Standardwert |
|---|---|
| Handy | Android, aktueller Chrome |
| Kaliber | 5,6 mm (.22 lr), in den Einstellungen wählbar |
| Scheibe | Geometrie aus Abschnitt 5.2 – Nutzer muss Ø 10er-Ring und Ø Spiegel nachmessen |
| Ansageumfang | ausführlich (Ring + Abweichung + Richtung), umschaltbar auf kurz |
| Serienlänge | 5 Schuss, automatisch beenden; zusätzlich Knopf „Serie beenden" |
| Hosting | GitHub Pages dieses Repos (Vorschlag, siehe `docs/PLAN.md`) |
| Spektiv/Adapter | unbekannt |

Antworten des Nutzers werden hier nachgetragen.

## Arbeitsweise (Abschnitte 0 und 16)

- Meilensteine M0–M6 der Reihe nach, jeder vollständig (Code, Tests, Doku), danach ein kurzer
  Bericht und ein Tag. Tags heißen `schuss-m0`, `schuss-m1`, … (das Repo enthält mehrere Projekte).
- Nachweise strikt trennen: *durch automatische Tests belegt* / *nur durch Code-Lesen geprüft* /
  *nur am echten Schießstand prüfbar*. Nie „funktioniert" ohne Ausführung.
- Keine Platzhalter oder Attrappen. Nicht Gebautes steht in `docs/OFFEN.md`, kleine
  Entscheidungen in `docs/ENTSCHEIDUNGEN.md` (Datum, Entscheidung, Grund).
- Bei echter Unklarheit den Nutzer fragen. Der Nutzer ist Maker/Sportschütze: Berichte in
  normalem Deutsch, Befehle kopierfertig.

## Definition of Done (Abschnitt 15) – vor der Übergabe tatsächlich ausführen

1. `tsc --noEmit`, ESLint und Prettier ohne Fehler.
2. Alle Unit- und Playwright-Tests grün, mit Anzahl.
3. Akzeptanzziele aus 12.3 als Tabelle (Ziel vs. gemessen), inkl. Störungsszenarien.
4. Offline-Test: keine externen Requests, App nach Offline-Reload nutzbar, Service Worker aktiv.
5. Produktions-Build, Bündelgröße und Ladezeit dokumentiert, keine ungenutzten großen Abhängigkeiten.
6. Wertung: Kontrollwerte aus 5.3 und Grenzfälle als Tests.
7. Koordinaten/Richtung: Spiegeltests grün.
8. Ansagetexte kurz/ausführlich für ≥ 10 Beispieltreffer geprüft; TTS-Aufrufe im E2E-Test belegt.
9. Simulierter Dauerlauf ≥ 30 Minuten ohne Speicherwachstum.
10. Datenschutz per Netzwerküberwachung bestätigt.
11. Dokumentation vollständig und konsistent; Befehle darin wirklich ausgeführt.
12. Konsistenzprüfung gegen Abschnitte 1–14, jede Abweichung begründet.
13. Grenzen in `docs/GRENZEN.md` und `docs/TESTPROTOKOLL_SCHIESSSTAND.md`.
14. Kurzer Übergabebericht (deutsch): gebaut, installieren, erstes Testschießen, Rückmeldung.
