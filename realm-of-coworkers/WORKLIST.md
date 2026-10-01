# Worklist: Content-Dateien für realm-of-coworkers

Ziel: Alle Dateien aus Spezifikation 15.5 fertig erzeugen, damit Claude Code sie in Meilenstein M1 nur übernimmt.
Jede Phase endet mit `python3 tools/validate_content.py` ohne Fehler. Das Prüfskript wächst mit jeder Phase.
Entscheidungen und offene Fragen stehen in `docs/OPEN.md`.

| Phase | Status | Dateien | Quelle in der Spezifikation | Prüfungen |
| --- | --- | --- | --- | --- |
| 1 Klassen und Fähigkeiten | erledigt | `classes.json`, `skills.json` | 4, 5.4, 13.2, 15.5 | IDs, Slots, Freischaltstufen, Abklingzeiten, Effekt-Schema, Auto-Cast-Regeln, K je Klasse gegen 13.2 |
| 2 Statuseffekte und Elemente | erledigt | `status.json`, `elements.json` | 6.1, 6.3, 6.4 | jede StatusId genau einmal, Reinigungsreihenfolge, Bedeutung von `value` je Status, Gegenelemente paarweise |
| 3 Gegner und Level | erledigt | `enemies.json` (mit `elite`), `arenas.json`, `levels/palette.json`, `levels/stage-01.json` bis `stage-30.json` | 9, 10.2 | Paletten je Kapitel 100 %, Begegnungspunkte 66, Checkpoints, Elite-Verteilung, Gefahren je Kapitel |
| 4 Bosse | erledigt | `bosses.json` | 10 | Phasen und Elemente, Angriffe gegen 10.4, Boss-Leben gegen 10.3, Timer, Bosswaffen-Effekte |
| 5 Ausrüstung und Beute | erledigt | `items/names.json`, `loot/stage-loot.json`, `loot/boss-drops.json`, `gems.json`, `artifacts.json` | 7, 8, 10.8, 12.8 | Wahrscheinlichkeiten je 100 %, Gem-Werte gegen 7.2, Artefakt-Pfade (`modifyValue`) zeigen auf existierende Skills und Parameter |
| 6 Werte, Texte, Oberfläche | erledigt | `balance.json`, `story/kapitel1.json` bis `kapitel6.json`, `i18n/de.json` | 3, 14, 15.5 | balance.json gleich den Startwerten in 15.5, jede Stage hat einen Intro-Text, jeder Boss zwei Dialoge |
| 7 Abschluss | erledigt | alle | 13, 16 | Querverweise über alle Dateien, Abgleich mit dem Referenzmodell, Paket für das Repo, Spezifikation nachführen |

## Phase 1 im Detail

- 6 Klassen mit Rolle, Waffe, Material, Reichweite, Lebensfaktor, Bedrohung, Einzelkämpfer-Faktor, Formationsabstand und Anteilen (Summe 1).
- 36 Fähigkeiten (je Klasse Automatikangriff, drei Fähigkeiten, Ultimate, Passiv) nach dem Effekt-Schema aus 15.5.
- Sondermechaniken als Handler mit benannten Parametern. Die Parameternamen sind so gewählt, dass die Artefakte (Phase 5) sie per `modifyValue` ansprechen können, zum Beispiel `handler:waldlaeufer_fallensteller.lifetimeMs`.
- Prüfergebnis: K aus den Daten stimmt für fünf Klassen mit 13.2 überein (höchstens 0,01 Abweichung). Beim Schurken ergeben die Daten 1,42; die restlichen 0,20 aus Blutdurst, Meucheln-Bonus und Tarnung sind situativ und werden in M2 per Simulation gemessen (13.2, 13.10).

## Phase 2 im Detail

- 27 Statuseffekte: 16 Debuffs (12 reinigbar in der Reihenfolge aus 6.4, 4 nur auf Gegnern) und 11 Buffs. Jeder Status trägt Stapel, Dauer, Tick, Schwächungs-Kennzeichen, Boss-Immunität, Elite-Faktor und seine Zahlenwerte als Parameter.
- 7 Elemente mit Farbe (14.8), Symbol (14.6) und Gegenelement (6.1).
- Das Prüfskript kontrolliert zusätzlich: jede StatusId aus 15.5 genau einmal, Reinigungsreihenfolge, Schwächung, Boss-Immunität und Elite-Dauer laut 6.3 und 6.4, Kernwerte jedes Debuffs gegen 6.3, jedes `value` einer Fähigkeit trifft einen vorhandenen Parameter, Gegenelemente paarweise, Farben gegen 14.8.
- Nachgezogen aus Phase 1: Elementarnova wirkt um das Ziel (E-006).

## Phase 3 im Detail

- `enemies.json` enthält die 9 Gegnertypen aus 9.3 und das Objekt `elite` (9.7) mit Affix-Parametern und Großangriff. Sondermechaniken (Priester, Bomber, Wächter, Kultist) sind Handler mit benannten Parametern.
- `arenas.json` enthält 6 Arenen nach 10.2, eine je Kapitel.
- `levels/palette.json` enthält die Anteile je Kapitel aus 9.5.
- `levels/stage-01.json` bis `stage-30.json`: 24 normale Stages (12.000 px, 6 Begegnungen, Summe 66 Punkte, 2 Checkpoints, Gefahr in Begegnung 3 und 5) und 6 Boss-Stages (4.500 px, 2 Begegnungen, eigene Checkpoints).
- Das Prüfskript kontrolliert zusätzlich: Gegnerwerte gegen 9.3, Elite gegen 9.7, Paletten je Kapitel 100 % und kein Typ vor seinem Kapitel (9.9), jeder Typ mindestens einmal verwendet, Arenenmaße gegen 10.2, je Stage Länge, Begegnungen, Punktsumme 66, Checkpoints, Gruppenaufteilung und Verzögerungen, Elite-Verteilung und Gefahren.

## Phase 4 im Detail

- `bosses.json` enthält die 6 Bosse mit Grundleben, Phasen und Phasen-Elementen, den vier Angriffen aus 10.4, passivem Buff, Debuff, Signaturangriff, Bosswaffen-Effekt, Adds, Arena und Dialog-Schlüsseln.
- Passive Buffs und Signaturangriffe sind Handler mit benannten Parametern, zum Beispiel `sig_kettenblitz` mit `jumps`, `jumpRadiusPx` und `shockMs`.
- Das Prüfskript kontrolliert zusätzlich: Grundwerte gegen 10.3, 10.6 und 10.9, Phasenschwellen und Wechsel auf das Gegenelement (gegen `elements.json`), alle vier Angriffe gegen 10.4, Signaturangriff erst ab Phase 2, Anzeigedauer 1.500 ms, Adds gegen 10.4, vorhandene Arena, Dialog-Schlüssel und der Querverweis jeder Boss-Stage auf ihren Boss.
- Zusätzlich wird das Boss-Leben gegen die Herleitung aus 13.4 gerechnet: 150 s mal dem mittleren Schaden von Magier, Waldläufer und Schurke. Alle sechs Werte stimmen auf 100 genau.

## Phase 5 im Detail

- `items/names.json`: Präfixe je Seltenheit, 10 Suffixe, Typnamen für jede Klasse und jeden Slot (zum Beispiel Krieger/Helm = Plattenhelm) und die Genitive der Bosse für die Bosswaffen (8.5).
- `loot/stage-loot.json` und `loot/boss-drops.json`: Truheninhalt, Slot-Anteile, Seltenheiten je Kapitel, Waffenelemente (8.4) sowie Beute für ersten Sieg und Wiederholung samt Gold- und XP-Faktoren.
- `gems.json`: 7 Arten mit ihrem Wert, 5 Stufen mit Punkten und Namen, Kosten für Kombinieren und Tauschen, die 9 Freischaltstufen und die Beutetabelle je Kapitel.
- `artifacts.json`: 18 Artefakte. Jeder Effekt ist ein `modifyValue` mit einem Pfad auf eine Fähigkeit, einen Handler-Parameter oder einen erlaubten Wert aus `balance.json`.
- Das Prüfskript löst jeden Artefakt-Pfad auf und meldet einen Fehler, wenn die Fähigkeit, der Effekt-Index oder der Handler-Parameter nicht existiert oder das Artefakt eine fremde Klasse verändert. Dazu kommen: alle Beutetabellen auf 100 %, keine legendäre Beute aus Truhen, Gem-Werte und Freischaltstufen gegen Abschnitt 7 und die Gegenrechnung, dass 9 Smaragde der Stufe V die Obergrenze für Krit-Schaden nicht überschreiten (240 von 250).

## Phase 6 im Detail

- `balance.json` wurde unverändert aus den Startwerten in 15.5 übernommen, damit Dokument und Daten nicht auseinanderlaufen können.
- `story/kapitel1.json` bis `kapitel6.json`: 30 Einleitungstexte (einer je Stage), 12 Bossdialoge (vor und nach jedem Kampf) und der Epilog in Kapitel 6.
- `i18n/de.json`: 222 Oberflächentexte in 23 Gruppen, einschließlich aller Fehlercodes aus 15.2 und der Einstellungen zur Barrierefreiheit aus 14.6.
- Geprüft werden: rund 50 Konstanten gegen die Formeln der Abschnitte 5 bis 12, Slotgewichte in Summe 8,0, XP-Kurve ergibt 189.040, jeder `introId` einer Stage hat einen Text, jeder Dialog-Schlüssel eines Bosses existiert, Epilog nur in Kapitel 6, alle Klassen, Werte, Slots, Seltenheiten, Elemente und Fehlercodes haben einen Text.

## Phase 7 im Detail

- `tools/crosscheck_balance.py` rechnet die fertigen Daten gegen das Referenzmodell aus Anhang A: Formelkonstanten, Klassenanteile, RefLeben, Boss-Leben, Kampfdauer je Klasse und Kapitel, Spanne zwischen den Klassen, XP- und Gold-Kurve sowie die Obergrenzen für Gems und Artefakte.
- Ergebnis: RefLeben 407 bis 1.427 wie in 13.3, alle sechs Boss-Lebenswerte genau wie hergeleitet, Solo-Kampfdauer 144 bis 200 s (Grenze 130 bis 210 s), Spanne 1,39 (Grenze 1,45), 189.040 XP, 28.674 Gold, Krit-Schaden höchstens 240 %.
- `README.md` beschreibt, wie Claude Code das Paket übernimmt.
