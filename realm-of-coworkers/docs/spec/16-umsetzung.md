## 16 Umsetzungsplan, Abnahme und Konsistenzprüfung

### 16.1 Grundsätze

1. **Daten zuerst.** Alle Zahlen dieser Spezifikation gehören in `packages/content` (15.5). Kein Balancewert steht im Code.
2. **Kern vor Oberfläche.** Die Kampfsimulation läuft zuerst kopflos in `packages/shared` und wird durch Tests belegt. Erst danach kommen Server und Client.
3. **Ein Codepfad.** Solo, Koop, Test und `pnpm balance` verwenden dieselbe deterministische Simulation (2.3).
4. **Jeder Meilenstein ist lauffähig** und hat Abnahmetests. Keine Oberfläche ohne Testpfad.
5. **Platzhalter statt Warten.** Grafik und Audio dürfen zunächst einfarbig sein (16.5).

### 16.2 Meilensteine

| Nr. | Ergebnis | Abnahme | Aufwand |
| --- | --- | --- | --- |
| M0 | Gerüst: pnpm-Monorepo, CLAUDE.md, docs/spec, docs/OPEN.md, ref\_model.py, TypeScript strict, Lint, Vitest, CI, Dockerfile | `pnpm test` und CI laufen grün | S |
| M1 | Shared-Kern: Zod-Schemas, alle Content-Dateien vollständig nach 15.5, Content-Loader, Formeln aus Abschnitt 5, Werteberechnung, Zufallszähler | Rechenbeispiele aus 5.3 (219,0 Punkte) und 5.6 (38 % Mitigation) sowie die Referenzwerte aus 13.3 stimmen | M |
| M2 | Kopflose Kampfsimulation: Entitäten, Fähigkeiten aus JSON, Status, Bedrohung, Telegraphen, 6 Klassen | Test je Fähigkeit; gemessenes K jeder Klasse weicht höchstens 10 % von 13.2 ab | L |
| M3 | Gegner, Stages, Spawn-Logik, Autowalk, Begegnungen | Kampfzeiten pro Stage aus 13.7 innerhalb ±15 %; gleicher Seed liefert gleiche Ereignisse | L |
| M4 | Bosse: Phasen, Angriffe, Adds, Enrage, Skalierung nach n und Kampfstufe | Kampfdauer aus 13.5 innerhalb ±10 %; Wipe und Neustart funktionieren | L |
| M5 | Persistenz und HTTP-Schnittstelle: Konto, Held, Ausrüstung, Gems, Artefakte, Verzauberung, Wirtschaft | Alle Endpunkte aus 15.2 mit Tests; Transaktionen; Sperre laufender Helden | L |
| M6 | Beute und Fortschritt: Beutetabellen, XP- und Gold-Töpfe, Levelaufstieg, Timer, Beutestufe | Tempo 12.4, Ausrüstungskurve 12.9 und Gold 12.5 innerhalb der Grenzen aus 13.9 | M |
| M7 | Client-Grundlage: Phaser-Szene, Snapshot-Anzeige, Interpolation, Vorhersage der Bewegung, Eingaben, HUD | Solo-Stage spielbar mit 60 FPS und Platzhalter-Grafik | L |
| M8 | Lager und Menüs: alle Stationen, Ausrüstung, Tooltips, Vergleich, Bosstafel | Playwright-Ablauf: Registrieren, Held erstellen, ausrüsten, Gem kombinieren, verzaubern | L |
| M9 | Mehrspieler: Gateway, Lobby, Party, Bereit-Bildschirm, Snapshots, Wiederverbindung, Helfer-Modus | Test mit 6 kopflosen Clients bei 150 und 400 ms künstlicher Latenz | L |
| M10 | `pnpm balance` als TypeScript-Port des Referenzmodells (Anhang A) mit allen Prüfungen aus 13.9 | Ausgaben stimmen mit ref\_model.py überein (13.11); Werkzeug ist grün auf den Daten der Spezifikation und rot, wenn eine Konstante verändert wird | M |
| M11 | Politur: Grafik, Audio, Barrierefreiheit (14.6), i18n | Alle Punkte der Checkliste in 16.3 | L |
| M12 | Härtung und Betrieb: Rate-Limits, Sicherung, Lasttest, Dokumentation | Ziele aus 2.7 erreicht (10 Runs, 60 FPS, unter 3 MB) | M |

Aufwand: S klein, M mittel, L groß. M2 bis M4 tragen das größte Risiko, sie sollten früh und mit vielen Tests entstehen.

### 16.3 Abnahmekriterien

| Bereich | Kriterium |
| --- | --- |
| Klassen | Alle 6 Klassen sind solo bis Stage 30 spielbar. Jede Fähigkeit wirkt wie in Abschnitt 4 beschrieben |
| Werte | Ein Held zeigt Werte, die dem Rechenweg aus Abschnitt 5 entsprechen. Obergrenzen (8.8) greifen |
| Elemente | Schwäche ×1,5 und Resistenz ×0,5 wirken (6.1), Boss-Phasenwechsel ändert Element und Schwäche |
| Statuseffekte | Alle Effekte aus 6.3 mit Dauer, Stapeln und Reinigung (6.4) |
| Kampf | Bedrohung, Spott, Wutwechsel, Telegraphen, Ausweichrolle, Wiederbeleben, Wipe verhalten sich wie in 6 und 10 |
| Stages | 30 Stages mit Begegnungen, Checkpoints, Elite, Gefahr, Story-Text |
| Autowalk | Läuft, stoppt bei Begegnungen, wartet auf Zurückgebliebene, T schaltet um |
| Bosse | 6 Bosse mit Phasen, Adds, Signaturangriff, Enrage, Skalierung nach n und Kampfstufe |
| Beute | Tabellen aus 12.8 und 10.8 eingehalten (Test mit 10.000 Würfen, Abweichung unter 2 Prozentpunkten) |
| Ausrüstung | 7 Slots, Seltenheiten, Waffenstufen, Waffenwechsel, Element, Verzauberung, Übertragen |
| Gems und Artefakte | Kombinieren, Tauschen, Freischaltung, Aufwerten, Effekte (7) |
| Wirtschaft | Preise aus 12.6, Verkauf, keine negativen Guthaben, Transaktionen |
| Timer | Boss-Timer pro Held, Helfer-Modus, Beutestufe (10.9) |
| Mehrspieler | Party, Code, Einladung, Bereit-Bildschirm, Nachzügler-Regel, Wiederverbindung, Solo-Pause |
| Server | Autoritativ, Eingaben validiert, Rate-Limit, Absturz verliert höchstens die laufende Begegnung |
| Client | 60 FPS mit 6 Helden und 40 Einheiten, Erstladen unter 3 MB, Tastenbelegung änderbar |
| Barrierefreiheit | Kontur-Telegraph, Farbsehschwäche-Paletten, Schriftgröße, weniger Bewegung, Element-Symbole (14.6) |
| Balance | `pnpm balance` erfüllt alle Grenzen aus 13.9 |
| Betrieb | `docker compose up` startet den Server, Sicherung der Datenbank ist eingerichtet |

### 16.4 Testplan

- **Einheitentests (Vitest):** Formeln, Budgetverteilung, Werteberechnung, Mitigation, Spawn-Budget, XP- und Gold-Töpfe, Kosten.
- **Simulationstests:** deterministische Läufe mit festem Seed; Ereignisprotokoll wird als Datei verglichen; Fähigkeiten einzeln; 6 Klassen gegen Boss.
- **Balance-Test (`pnpm balance`):** rechnet die Modelle aus Abschnitt 13 aus den echten Daten nach und misst zusätzlich K und die Kampfdauer per Simulation.
- **Integrationstests:** HTTP-Schnittstelle mit einer Test-Datenbank; WebSocket-Protokoll mit mehreren Clients.
- **E2E (Playwright):** Registrieren bis Bosskampf; Party mit 2 Browsern; Wiederverbindung.
- **Last:** 10 Runs à 6 Helden für 10 Minuten; CPU unter 60 % eines Kerns (11.10).

### 16.5 Grafik und Audio in der Umsetzung

- Bis Grafiken vorliegen, zeichnet der Client einfarbige Figuren mit Klassen-Symbol und Namensschild sowie einfarbige Telegraphen. Alle Schnittstellen (Atlas, Animationsnamen) stehen vorab fest (14.8).
- Geeignet sind Assets mit freier Lizenz (CC0). Herkunft und Lizenz jeder Datei stehen in `packages/content/ASSETS.md`.
- Audio wird als Ogg geliefert; fehlt eine Datei, spielt der Client nichts und meldet nur im Log.

### 16.6 Betrieb

- **Start:** `docker compose up -d`. Umgebungsvariablen laut 2.8 in einer `.env`. Daten in einem Volume `data/`.
- **TLS:** Reverse Proxy (Caddy oder nginx) vor Port 3000 mit WSS.
- **Sicherung:** Nächtlich `sqlite3 aethra.db .backup` in ein Sicherungsverzeichnis, 14 Tage aufbewahren. Vor jedem Deployment eine zusätzliche Kopie.
- **Überwachung:** `/api/health` (Version, Zahl der Runs, Speicher). Logstufe über `LOG_LEVEL`.
- **Konten:** Neue Kollegen registrieren sich mit dem Einladungscode. Es gibt keine E-Mail-Adresse und keine Passwort-Rücksetzung. Ein Administrator setzt Passwörter per Kommandozeile zurück (`pnpm admin reset-password <name>`).

### 16.7 Konsistenzprüfung

Die Spezifikation wurde Abschnitt für Abschnitt gegen das Balance-Modell und gegeneinander geprüft. Die folgende Tabelle nennt die zentralen Größen, ihre Definition und alle Stellen, an denen sie verwendet werden. Ändert man eine Größe, müssen diese Stellen mit angepasst werden (im Code entfällt das, weil alles aus `balance.json` gelesen wird).

| Größe | Wert | Definiert in | Verwendet in |
| --- | --- | --- | --- |
| Lebensfaktor Boss F(n) | 1 + 0,75 (n − 1) | 10.3 | 9.6, 13.4, 13.5 |
| Schadensfaktor Boss M(n) | 0,25 + 0,15 (n − 1) | 10.3 | 10.4, 13.6 |
| Anzahlfaktor C(n) und Lebensfaktor H(n) | 1 + 0,5 (n − 1); F ÷ C | 9.6 | 9.5, 10.4, 12.3 |
| Kampfstufe | +5 % je Stufe, 0 bis 4 | 10.9 | 8.2, 10.3, 10.8, 15.5 |
| Enrage | 480 s | 10.1 | 13.5, 14.4 |
| RefLeben | 407 bis 1.427 | 13.3 | 6.3, 9.3, 9.7, 9.8, 10.4 |
| Punktebudget Item | Slot × (8 + 2,2 × iLvl) × Seltenheit | 5.3 | 7.1, 8, 12.9, 13.8 |
| Umrechnung Punkte in Werte | 6 / 0,5 / 1 / 1 / 0,15 / 0,10 / 0,4 | 5.4 | 7.2, 7.6, 13.2 |
| Item-Stufe | 1 bis 34, Stage-Nummer, 5 × Kapitel + Beutestufe | 8.2 | 5.3, 10.8, 12.8 |
| Gem-Punkte | 5 / 9 / 14 / 19 / 25 | 7.2 | 7.8, 13.8 |
| Artefakt-Punkte | 12 / 18 / 24 / 30 / 36 | 7.6 | 7.8, 13.8 |
| Waffen-XP und Waffenbonus | 300 × i^1,4; +3 % je Stufe | 8.4 | 12.2, 13.8, 15.5 |
| Verzauberung | 100 × Rang² | 8.7 | 12.6, 13.8 |
| XP-Kurve | 100 × L^1,5 | 12.1 | 12.4, 13.8 |
| Gold-Topf | 66 × (2 + 0,6 × s) | 12.5 | 12.3, 12.6 |
| Boss-Timer | 15 / 25 / 40 / 60 / 90 / 120 Minuten | 10.9 | 3.3, 14.2 |
| Gegner-Leben und -Schaden | 60 + 38 Lv; 1 + 0,35 Lv | 9.4 | 13.4, 13.7 |
| Mitigation | W ÷ (W + 40 + 12 × Lv) | 5.6 | 9.4, 13.6 |
| Punkte je Begegnung | 8 / 10 / 10 / 12 / 12 / 14 (Summe 66) | 9.5 | 12.3, 13.7 |

**Änderungen, die sich aus der Prüfung ergeben haben** (Fundstellen im Dokument sind bereits angepasst):

1. Der Schadensfaktor des Bosses beginnt bei 0,25 statt 0,4 (10.3), sonst überschreitet der Druck auf Solo-Helden ihren Puffer (13.6).
2. Der Gegnerschaden beträgt 1 + 0,35 × Lv statt 2 + 0,7 × Lv, dazu gilt die Regel der Angriffsplätze (9.4). Vorher übertraf die Belastung in normalen Begegnungen die der Bosse.
3. Regeneration zwischen Begegnungen und automatische Wiederbelebung am Ende einer Begegnung wurden ergänzt (9.2).
4. Die Boss-Schilde von Glaciara und Solaris wurden auf 2 % beziehungsweise 3 % gesenkt (10.6).
5. Boss-Timer und Kampfstufe gelten pro Held (1.4, 10.9).
6. Nur Bosswaffen tragen feste Effekte (8.3).
7. Die Dauern der Boss-Debuffs entsprechen 6.3 (10.6).
8. Die Prüfgrenzen der Kampfdauer in 13.9 decken alle möglichen Zusammensetzungen ab.
9. Die Boss-Stage hat eigene Checkpoints (9.9).

**Korrekturen der zweiten Prüfung** (Umsetzbarkeit mit Claude Code):

- Rangfolge und Umgang mit Lücken festgelegt (1.6, 17).
- Technik auf Phaser 4.1, Node 24 LTS, Fastify 5 und aktuelles Vite umgestellt (2.1).
- Tempo einheitlich in Prozentpunkten (4.4, 5.6). ELE wirkt auch mit physischen Waffen (5.1).
- Angreiferstufe für Bosse und Gefahren definiert, Minderung von Schaden über Zeit geregelt (5.6).
- Nach einem Wipe zahlt jede Begegnung ihre Belohnung je Run höchstens einmal aus (6.8).
- Freischaltung über `stage_progress` statt `max_stage`, Lücken durch die Nachzügler-Regel erlaubt (3.4, 15.1).
- Datenmodell ergänzt: `active_set`, `autocast`, `stash`, `locked`, Nachricht `party.invited`, Aktion `revive`, Feld `projs` entfernt (15.1 bis 15.3).
- Vollständige IDs, Effekt- und Handler-Vokabular, Auto-Cast-Regeln, Schemas aller Inhaltsdateien und Startwerte von `balance.json` (15.5).
- Werte der Boss-Adds festgelegt (10.4), automatischer Verkauf schont gesperrte, verzauberte und legendäre Gegenstände (8.9).
- Referenzmodell als Code (Anhang A) mit allen Annahmen (13.11), Übergabe an Claude Code (17).

### 16.8 Offene Punkte und Risiken

- **Messung statt Modell.** K, Krit-Bonus, Auto-Cast-Verhalten und Spielerfaktor sind Schätzungen. Nach M2 und M4 liefert die Messung die Wahrheit; abweichende Koeffizienten sind in Abschnitt 4 anzupassen (13.10).
- **Gruppen ohne Schadensklasse** brauchen bis zu 7 Minuten. Falls das im Playtest stört, gibt es zwei Stellschrauben: ein Bonus auf die Boss-Lebensformel bei Gruppen ohne Schadensklasse oder ein höherer Solo-Multiplikator für Krieger und Kleriker.
- **Vollausbau macht Bosse schnell** (13.8). Stellschraube: `kampfstufeProzent`.
- **Auto-Cast** darf die Spielenden nicht überfordern und nicht unterfordern. Die Vorgaben in 4.4 sind ein Startpunkt, im Playtest zu prüfen.
- **Grafik und Audio** sind der größte Aufwand außerhalb der Technik. Der Umfang kann durch das Platzhalter-Vorgehen (16.5) gesteuert werden.
- **Namen und Texte** (Bosse, Orte, Dialoge) sind Arbeitsstände. Ein Redaktionsdurchgang steht nach M11 an.
