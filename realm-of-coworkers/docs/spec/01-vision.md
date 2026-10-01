## 1 Vision und Spielprinzip

**Aethra – Die Splitterchroniken** (Arbeitstitel; Repo-Name `realm-of-coworkers`) ist ein browserbasiertes 2D-Koop-Action-RPG für 1 bis 6 Kollegen. Die Party wandert per Autowalk als Sidescroller durch 30 lineare Level, besiegt Gegnerwellen und 6 Bosse, sammelt Ausrüstung und lässt sich nebenbei zwischen Arbeitsaufgaben spielen. Formeln, Regeln und Datenwerte sind verbindlich. Die Ergebnistabellen in Abschnitt 13 sind Erwartungswerte des Referenzmodells mit den Toleranzen aus 13.9 (Rangfolge in 1.6).

### 1.1 Kernschleife

1. Im **Lager** (Hub) Held wählen, ausrüsten, Party bilden.
2. Ein **Level** (Stage) wählen: Solo oder Koop.
3. Die Party läuft automatisch nach rechts, Gegnerwellen lösen Kämpfe aus, Fähigkeiten können automatisch oder manuell ausgelöst werden.
4. Am Levelende Loot, XP, Gold. Am Kapitelende ein Bosskampf mit Spezialwaffe.
5. Bosse lassen sich nach einem Timer erneut bekämpfen (neue Beutechance). Nach dem Levelcap wird die Waffe verzaubert.

### 1.2 Designprinzipien

- **Nebenbei spielbar:** Ein normales Level dauert 5 bis 8 Minuten und läuft mit Auto-Cast weitgehend selbstständig. Nur Bosskämpfe (2 bis 4 Minuten) verlangen volle Aufmerksamkeit (Ausweichen, Waffenwechsel).
- **Fair für jede Klasse und jede Gruppengröße:** Jede der 6 Klassen ist solo abschließbar. Gegner und Bosse skalieren mit der Gruppenstärke, nicht nur mit der Kopfzahl.
- **Zusammenspiel lohnt sich:** Rollen (Tank, Heilung, Unterstützung, Schaden) machen Kämpfe sicherer, sind aber nie Pflicht.
- **Ausrüstung und Element entscheiden Bosskämpfe:** Jeder Boss hat Schwächen, Resistenzen, Buffs und Debuffs, die Waffen- und Elementwahl belohnen.
- **Datengetrieben:** Klassen, Fähigkeiten, Items, Gegner, Bosse und Level liegen als JSON-Dateien vor. Balancing ändert nur Daten, keinen Code.

### 1.3 Nicht-Ziele

Kein Idle-/Clicker-Spiel, kein Tower Defense, kein PvP, keine Bezahlinhalte, keine Pflicht zu Voice- oder Text-Chat.

### 1.4 Getroffene Annahmen

Diese Punkte waren in der Anforderung offen und sind hier festgelegt. Bitte prüfen.

| Thema | Festlegung |
| --- | --- |
| Levelcap | Zwei Caps: Heldenstufe 30 und Waffenstufe 10. Verzaubern wird bei Waffenstufe 10 freigeschaltet. |
| Perspektive | Sidescroller mit flachem Tiefenband (2,5D wie ein Beat 'em up), kein Springen. |
| Helden | Ein Held pro Klasse und Account, maximal 6 Helden pro Account. |
| Loot | Persönlich: Jeder Spieler erhält eigene Drops passend zu seiner Klasse. |
| Boss-Timer | Pro Held und Boss, nicht pro Party. |
| Hosting | Benötigt einen Node-Server (Multiplayer, Speicherstand). Statisches Hosting allein reicht nicht. |
| Sprache | Oberfläche Deutsch, Texte in einer i18n-Datei ausgelagert. |
| Geräte | Desktop-Browser (aktuelles Chrome, Edge, Firefox). Tablet ist optional. |

### 1.5 Begriffe

**Stage** = ein Level. **Kapitel** = 5 Stages, die letzte ist ein Boss. **Party** = 1 bis 6 Spieler in einer Stage. **Held** = der spielbare Charakter eines Spielers. **RefLeben** = Referenz-Lebenspunkte pro Kapitel (Abschnitt 13), Grundlage für Bossschaden. **Standard-DPS** = Schaden pro Sekunde eines Helden mit Standardausrüstung (Abschnitt 13), Grundlage für Boss-Lebenspunkte.

### 1.6 Verbindlichkeit und Rangfolge

1. **Formeln und Datenwerte** (Abschnitte 4 bis 12 und 15.5) sind verbindlich und werden unverändert in `packages/content` übernommen.
2. **Regeln im Fließtext** gelten ebenso, solange sie keiner Formel widersprechen. Bei einem Widerspruch gilt bis zur Klärung die Formel.
3. **Tabellen in Abschnitt 13** sind Ergebnisse des Referenzmodells (Anhang A). Die Simulation muss sie innerhalb der Toleranzen aus 13.9 treffen. Weicht sie ab, werden Koeffizienten in den Daten angepasst, nicht die Formeln.
4. **IDs und Feldnamen** stehen ausschließlich in Abschnitt 15.
5. **Lücken und Widersprüche** werden nicht eigenmächtig aufgelöst, sondern in `docs/OPEN.md` eingetragen (Abschnitt 17).
