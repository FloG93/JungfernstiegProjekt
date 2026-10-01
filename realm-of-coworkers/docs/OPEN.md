# Offene Punkte und Entscheidungen

Stand: Phase 7 (abgeschlossen). Einträge mit „Entscheidung“ sind in den Daten umgesetzt und in der Spezifikation nachgetragen. Einträge mit „Offen“ brauchen eine Antwort von Florian.

## Entscheidungen

- **E-001 Dateiformat.** Dateien mit mehreren Definitionen (`classes.json`, `skills.json`, später `enemies.json` usw.) sind JSON-Arrays dieser Definitionen, ohne Hülle. Einzelobjekte sind `balance.json`, `palette.json` und die Beute-Dateien.
- **E-002 Anzeige von Buffs.** Der Effekt `buff` hat das optionale Feld `display` (StatusId). Es bestimmt nur das Symbol in der Oberfläche, zum Beispiel `kraftrune` für Rune der Kraft.
- **E-003 Zielgruppen.** `allies` umfasst immer auch den Wirker (4.10: „auch der Runenweber“). Bei `target: nearest` hat ein gesetztes Fokusziel in Reichweite Vorrang (4.4).
- **E-004 Bollwerk solo.** Die Auto-Cast-Regel „zwei Verbündete unter 60 %“ greift solo nie. Ergänzt um „eigenes Leben unter 40 %“. Auto-Cast des Ultimates bleibt standardmäßig aus.
- **E-005 Ziel von Runenbruch.** `target: focus` bedeutet: Fokusziel, sonst Boss, dann Elite, dann der nächste Gegner in Reichweite.
- **E-006 Elementarnova um das Ziel** (war OPEN-001, von Florian entschieden). Die Nova trifft das Ziel und alle Gegner im Radius 220 px um das Ziel, Auto-Cast bei Gegner in Reichweite. K des Magiers bleibt 1,64, das Balancing bleibt unverändert.
- **E-007 Schaden über Zeit ohne Element.** Verbrennung, Gift und Blutung haben den Elementfaktor 1,0. Verbrennung und Gift werden durch Resistenz gemindert, Blutung durch Rüstung. ELE wirkt auf Schaden über Zeit der Helden (5.1).
- **E-008 Eingefroren wie Betäubung.** Reinigung direkt nach Betäubung, halbe Dauer bei Elite-Gegnern, Bosse immun. Die Reinigungsreihenfolge aus 6.4 bleibt sonst unverändert.
- **E-009 Bedeutung von `value`.** Der Wert `value` im Status-Effekt einer Fähigkeit überschreibt genau einen Parameter aus `status.json`: gift, blutung, verbrennung und regeneration `heroCoefPerS`; angriffstempo_malus `attackSpeedMalusPct`; bewegung_malus `moveSpeedMalusPct`; runenbruch `dmgTakenPct`. Mali sind als positive Prozentzahlen gespeichert.

- **E-010 Aufbau von `enemies.json`.** Die Datei ist ein Objekt mit `enemies` (Array der 9 Typen) und `elite` (9.7), weil Elite-Gegner kein eigener Typ sind, sondern eine Aufwertung. Ausnahme zu E-001.
- **E-011 Arenen und Hintergründe.** Eine Arena je Kapitel, ID `arena_<region>` (zum Beispiel `arena_aschenwaelder`), Hintergrund `bg_<region>_arena`. Stage-Hintergründe heißen entsprechend `bg_<region>`.
- **E-012 Elite-Basistypen nach Kapitel.** `basesFromChapter` legt fest, ab welchem Kapitel ein Basistyp als Elite auftreten kann (Scherge ab 1, Brecher ab 2, Wächter ab 5). In Kapitel 3 und 4 wird daher gleichverteilt aus Scherge und Brecher gezogen, ab Kapitel 5 aus allen dreien.
- **E-013 Adds als Wellen.** `adds.groupsPerWave` ist 1 und meint eine Gruppe aus 4 Schwarmlingen je Welle (10.4). Die Multiplikation mit C(n) macht die Simulation, sie steht nicht in den Daten.
- **E-014 Anzeigedauer der Signaturangriffe.** Alle Signaturangriffe verwenden die Standard-Anzeigedauer von 1.500 ms aus 6.7. Abweichungen (zum Beispiel die 3 s bis zum Auslösen von Stille) stehen als Handler-Parameter, hier `delayMs`.
- **E-015 Pfad `self.buffDurationMs`.** Das Runenweber-Amulett „Runenherz“ verlängert alle eigenen Buffs um 1 s. Dafür gibt es die Pfadform `self.buffDurationMs`, weil sich der Effekt nicht auf ein einzelnes Feld bezieht. In 15.5 nachgetragen.
- **E-016 Artefakte nur für die eigene Klasse.** Ein `modifyValue` darf nur Fähigkeiten und Handler der eigenen Klasse ändern. Über `balance.` sind fünf Werte erlaubt (Trank, Ausweichrolle, Wiederbeleben). Das Prüfskript setzt das durch.
- **E-017 Effekt-Pfade mit Index.** Felder eines Effekts werden über `skill:<id>.effects.<i>.<feld>` angesprochen, zum Beispiel `skill:schurke_giftklinge.effects.0.ms`. Die Reihenfolge der Effekte in `skills.json` ist damit verbindlich.
- **E-018 Story-Texte als Arbeitsstand.** Die 30 Einleitungstexte und 12 Dialoge sind geschrieben und inhaltlich stimmig (jeder Boss hat ein Motiv: verhinderter Schmerz). Sie sind laut 16.8 ein Arbeitsstand und dürfen frei überschrieben werden; das Prüfskript verlangt nur Vorhandensein und Mindestlänge.
- **E-019 Umfang von `i18n/de.json`.** Enthalten sind alle Texte, die sich aus den Abschnitten 14 und 15.2 ableiten lassen (222 Schlüssel). Texte für Bildschirme, die erst beim Bauen entstehen, kommen in den Meilensteinen M7 und M8 dazu.
- **E-020 Boss-Timer pro Held** (von Florian entschieden). Timer und Kampfstufe gelten pro Held, nicht pro Account. Wer mehrere Klassen spielt, kann jeden Boss je Held einmal pro Zeitfenster um Beute bekämpfen. Das ist gewollt und belohnt Vielspieler. `boss_state` behält `hero_id` als Schlüssel (15.1).
- **E-021 Kein Auto-Cast-Feinschliff bei Ultimates** (war OPEN-002, von Florian entschieden). Ultimates bleiben standardmäßig ohne Auto-Cast, deshalb wird keine zusätzliche Regel `enemiesNearTarget` eingeführt. Kataklysmus behält die Regel „4 Gegner im Radius 300", die nur greift, wenn ein Spieler Auto-Cast für sein Ultimate selbst einschaltet. Dann zündet der Zauber gelegentlich später als optimal; das ist hingenommen.

## Offen

- **OPEN-004 Gefahr in der Boss-Stage.** Die Boss-Stage hat nach 9.8 keine Umgebungsgefahr, weil Gefahren nur in den Begegnungen 3 und 5 auftreten und die Boss-Stage nur 2 Begegnungen hat. Das ist in den Daten so umgesetzt (`hazard: null`). Falls die zwei Begegnungen vor dem Boss die Gefahr des Kapitels zeigen sollen, wäre eine Zeile in 9.9 zu ergänzen.
- **OPEN-003 Läuterung und Formation im Bosskampf.** Der Schadensanteil von Läuterung (Radius 300 um den Kleriker) trifft den Boss nur, wenn der Kleriker nah genug steht. Offen ist, ob die Formation (6.5) auch in der Arena gilt. Einfluss auf K des Klerikers: höchstens 0,05 (8 %).
