## 9 Level-Aufbau, Autowalk und Gegner

Jedes Kapitel besteht aus 5 Stages: vier normale Stages und eine Boss-Stage. Die Stages sind von 1 bis 30 durchnummeriert (Schreibweise Kapitel-Stage: 1-1 bis 6-5). Eine normale Stage dauert 5 bis 8 Minuten.

### 9.1 Aufbau einer normalen Stage

- Die Welt ist ein horizontaler Streifen von **12.000 px** Länge und 240 px Tiefe (6.5). Die Kamera folgt der Vorhut der Party.
- Auf der Strecke liegen **6 Begegnungen** bei x = 1.800, 3.600, 5.400, 7.200, 9.000 und 10.800. Bei x = 12.000 steht die Zielflagge, dahinter die Truhe.
- **Checkpoints** liegen nach Begegnung 2 (x = 4.500) und Begegnung 4 (x = 8.100). Ein Checkpoint füllt die Heiltränke auf (4.4) und ist der Neustartpunkt nach einem Wipe (6.8).
- Ablauf: Party läuft → erreicht den Auslöser einer Begegnung → Autowalk stoppt → Gegner erscheinen → alle Gegner besiegt → Autowalk läuft weiter.
- Ende: Erreichen der Zielflagge nach der letzten Begegnung. Danach öffnet sich die Truhe für jeden Spieler einzeln (Beute laut Abschnitt 12), es gibt Stage-XP und Gold. Danach wählt die Party „Weiter“ (nächste Stage) oder „Zum Lager“.
- Erzählfluss: Vor der Stage erscheint der Story-Text (3.2).

Zeitplan bei Solo-Spiel auf Referenzstärke: Laufen rund 130 s, Kämpfe rund 110 s (Magier) bis 260 s (Kleriker, Runenweber), Wartezeiten der Spawns bis 90 s, zusammen rund 5,5 bis 7,5 Minuten. Mit 6 Spielern dauern die Kämpfe rund 160 s (Abschnitt 13).

### 9.2 Autowalk und Steuerung

- Der Autowalk bewegt einen **Formationsanker** mit 90 px/s. Die Helden halten ihre Formationsposition relativ zum Anker (6.5).
- Der Autowalk stoppt beim Auslöser einer Begegnung und startet erneut, wenn keine Gegner mehr leben. Er stoppt auch, solange ein Held der Party weiter als 700 px vom Anker entfernt ist, damit niemand zurückbleibt (Ausnahme: gefallene und getrennte Helden).
- Taste **T** schaltet den Autowalk für die ganze Party ein und aus (nur der Anführer der Party darf ihn umschalten, 11.2). Ohne Autowalk wandert der Anker nicht, die Helden laufen frei mit 220 px/s.
- Ein manuell bewegter Held verlässt seine Formation und kehrt nach 3 Sekunden ohne Eingabe zurück (6.5).
- Zwischen Begegnungen greift die Party nicht an, außer ein Gegner ist in Reichweite. Lebende Helden regenerieren zwischen den Begegnungen 4 % Max-Leben pro Sekunde. Am Ende jeder Begegnung werden alle Gefallenen mit 50 % Leben wiederbelebt.

### 9.3 Gegnertypen

Die Spalten Leben und Schaden sind Faktoren auf die Stage-Werte aus 9.4. Rüstung und Resistenz sind die Mitigation des Gegners (6.2, 5.6): Physischer Schaden wird um den Rüstungswert gesenkt, Elementarschaden um den Resistenzwert. Kapitel-Element bedeutet das Element des Kapitels (3.1). Diese Gegner nehmen ×1,5 vom Gegenelement und ×0,5 vom eigenen Element (6.1).

| Typ | Rolle | Leben | Schaden | Rüstung | Resistenz | Tempo (px/s) | Reichweite (px) | Angriffsintervall | Element | Gewicht |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Scherge | Nahkampf | 1,0 | 1,0 | 20 % | 10 % | 100 | 60 | 1,0 s | Physisch | 1,0 |
| Hetzer | Nahkampf, schnell | 0,6 | 0,9 | 5 % | 5 % | 160 | 60 | 0,8 s | Physisch | 0,6 |
| Schütze | Fernkampf | 0,7 | 1,1 | 10 % | 20 % | 100 | 420 | 1,2 s | Physisch | 0,7 |
| Schwarmling | Nahkampf, Schwarm (Gruppen à 4) | 0,3 | 0,5 | 0 % | 0 % | 130 | 50 | 1,0 s | Kapitel-Element | 0,3 |
| Brecher | Nahkampf, Panzer | 2,2 | 1,2 | 45 % | 15 % | 80 | 70 | 1,5 s | Physisch | 2,2 |
| Priester | Unterstützer | 0,8 | 0,4 | 5 % | 30 % | 90 | 380 | 1,5 s | Kapitel-Element | 0,8 |
| Kultist | Zauberer, Fernkampf | 0,8 | 1,2 | 5 % | 45 % | 90 | 380 | 1,5 s | Kapitel-Element | 0,8 |
| Bomber | Nahkampf, Explosion | 0,6 | 0,3 | 0 % | 0 % | 150 | 40 | 1,0 s | Kapitel-Element | 0,6 |
| Wächter | Elementarer Nahkämpfer | 2,5 | 1,3 | 25 % | 35 % | 90 | 80 | 1,5 s | Kapitel-Element | 2,5 |
| Elite (9.7) | Nahkampf oder Fernkampf | 4,0 | 1,5 | 30 % | 30 % | wie Basistyp | wie Basistyp | wie Basistyp | wie Basistyp | 6,0 |

Besondere Fähigkeiten:

- **Schaden pro Treffer** = Stage-Schaden (9.4) × Faktor × Angriffsintervall. Schaden des Typs Physisch, Schütze und Brecher trifft die Rüstung des Helden, Schaden mit Element trifft die Resistenz.
- **Priester:** Heilt alle 3 Sekunden den verwundetsten Verbündeten im Umkreis 400 px um 5 % von dessen Max-Leben. Die Wirkung braucht 1,0 s Zauberzeit mit sichtbarer Anzeige und wird durch Betäubung unterbrochen. Priester sind die bevorzugten Ziele der Spieler.
- **Bomber:** Läuft auf einen Helden zu und explodiert nach 1,0 s Anzeige oder bei Tod. Schaden: 8 % RefLeben im Radius 100 px. Wer der Explosion ausweicht (Ausweichrolle oder Verlassen des Kreises), erleidet keinen Schaden.
- **Schwarmling:** Erscheint immer in Gruppen à 4 und zählt als 1,2 Punkte je Gruppe (4 × 0,3).
- **Wächter:** Trägt einen Schild aus dem Kapitel-Element: Die ersten 10 % Leben werden durch einen Schild absorbiert, der erst nach 8 s ohne Schaden zurückkehrt.
- **Kultist:** Feuert Elementarkugeln mit 0,6 s Anzeige auf ein zufälliges Ziel (6.6).
- **Gewicht** ist der Punktewert im Spawn-Budget (9.5) und der XP-Anteil (Abschnitt 12).

### 9.4 Werte nach Stage

Für Gegner der Stage s (Nummer 1 bis 30) gilt die Gegnerstufe Lv = s.

```text
Leben(Lv)  = 60 + 38 × Lv
Schaden/s  = 1 + 0,35 × Lv
```

| Lv | 1 | 5 | 10 | 15 | 20 | 25 | 30 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Leben (Faktor 1,0) | 98 | 250 | 440 | 630 | 820 | 1.010 | 1.200 |
| Schaden/s (Faktor 1,0) | 1,4 | 2,8 | 4,5 | 6,3 | 8,0 | 9,8 | 11,5 |

Schaden/s ist die durchschnittliche Belastung vor Mitigation, wenn der Gegner dauerhaft trifft. Der Schaden wird durch die Formel aus 5.6 gesenkt (Angreiferstufe = Lv). Angriffsplätze: Ein Held wird von höchstens 4 Nahkämpfern gleichzeitig angegriffen. Weitere Nahkämpfer umkreisen ihn und rücken nach, sobald ein Platz frei wird. Fernkämpfer haben keine Grenze.

**Einführungsfaktor:** In den Stages 1-1 bis 1-4 gilt ×0,8 auf Gegner-Leben und Gegner-Schaden (4.3).

### 9.5 Spawn-Logik

Jede Begegnung hat ein Budget aus **Wellenpunkten**. Ein Punkt entspricht dem Leben eines Schergen (Gewicht 1,0).

| Begegnung | 1 | 2 | 3 | 4 | 5 | 6 | Summe |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Basispunkte (1 Spieler) | 8 | 10 | 10 | 12 | 12 | 14 | 66 |

Das Budget wird mit dem **Anzahlfaktor C(n)** multipliziert (9.6) und beim Auslösen so verteilt:

1. Die Begegnung hat 2 bis 3 **Spawn-Gruppen** (Begegnung 1 und 2: 2 Gruppen, sonst 3). Die Gruppen erscheinen nach 0 s, 8 s und 16 s. Das Budget wird zu je 1/2 und 1/2 bzw. 40/30/30 % aufgeteilt.
2. Jede Gruppe wird aus Typen der Palette des Kapitels gezogen (Tabelle unten). Es wird so lange ein Typ nach dem Anteil gezogen, bis das Gruppenbudget aufgebraucht ist. Ein Typ, der nicht mehr passt, wird übersprungen. Ein Rest unter 0,3 Punkten verfällt.
3. Jede Gruppe hat mindestens 3 Gegner (außer Elite-Gruppen).
4. **Erscheinungsorte:** 70 % der Gruppen erscheinen außerhalb der Kamera rechts (Kamera-Rand + 100 px), 30 % links. Die Tiefe (Bandposition) wird gleichverteilt gewürfelt. Fernkämpfer bleiben auf der Seite ihres Erscheinens.
5. **Gleichzeitig lebende Gegner:** höchstens 30. Weitere Gegner warten und erscheinen, sobald weniger als 24 leben.
6. **Sicherung:** Lebt 45 s nach dem letzten Spawn noch ein Gegner und ist niemand in seinem Kampf, laufen die Gegner mit 160 px/s auf die Party zu.
7. Alle Würfe laufen über den Zufallszähler des Runs (2.3).

Palette: Anteil der Punkte je Typ und Kapitel (in %):

| Typ | Kap. 1 | Kap. 2 | Kap. 3 | Kap. 4 | Kap. 5 | Kap. 6 |
| --- | --- | --- | --- | --- | --- | --- |
| Scherge | 40 | 30 | 25 | 20 | 20 | 15 |
| Hetzer | 20 | 15 | 15 | 15 | 15 | 15 |
| Schütze | 20 | 15 | 15 | 15 | 15 | 15 |
| Schwarmling | 20 | 15 | 10 | 10 | 10 | 10 |
| Brecher | – | 15 | 15 | 15 | 15 | 15 |
| Priester | – | 10 | 5 | 5 | 5 | 5 |
| Kultist | – | – | 15 | 10 | 10 | 10 |
| Bomber | – | – | – | 10 | 5 | 5 |
| Wächter | – | – | – | – | 5 | 10 |

Jede Spalte ergibt 100 %. Elite-Gegner kommen zusätzlich in 9.7.

### 9.6 Skalierung mit der Spielerzahl

Für n Spieler (1 bis 6) gelten folgende Faktoren auf normale Begegnungen:

- **Anzahlfaktor** C(n) = 1 + 0,5 × (n − 1). Das Budget einer Begegnung wächst um diesen Faktor.
- **Lebensfaktor** H(n) = F(n) ÷ C(n) mit F(n) = 1 + 0,75 × (n − 1). Das Leben jedes Gegners wächst um diesen Faktor.
- **Schadensfaktor** 1,0. Der Schaden eines einzelnen Gegners bleibt gleich.

| Spieler n | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- |
| F(n) Gesamtleben aller Gegner | 1,00 | 1,75 | 2,50 | 3,25 | 4,00 | 4,75 |
| C(n) Anzahl | 1,00 | 1,50 | 2,00 | 2,50 | 3,00 | 3,50 |
| H(n) Leben je Gegner | 1,00 | 1,17 | 1,25 | 1,30 | 1,33 | 1,36 |

Das Gesamtleben aller Gegner einer Begegnung wächst also wie F(n) und entspricht dem Bossleben-Faktor F(n) aus Abschnitt 10. So dauern Begegnungen für jede Gruppengröße ungefähr gleich lang. Der Gesamtschaden auf die Gruppe wächst dagegen nur mit C(n) und verteilt sich auf n Helden, sodass die Belastung je Held mit der Gruppengröße sinkt (n = 1: 1,00; n = 6: 0,58). Das gleicht die Rollenverteilung (Tank, Heiler) in Gruppen aus, während Solo-Helden ihren Einzelkämpfer-Multiplikator (4.4) haben.

Bei einem Verbindungsverlust nach dem Ablauf der 90 Sekunden (2.4) gilt n neu für neue Spawns. Bereits lebende Gegner behalten ihre Werte.

### 9.7 Elite-Gegner

- Elite-Gegner ersetzen 4 Punkte des Begegnungsbudgets (Gewicht 6,0 für XP). Sie erscheinen in folgenden Begegnungen:

| Stage im Kapitel | Elite-Begegnungen | Elite-Zahl (1 Spieler) |
| --- | --- | --- |
| 1 und 2 | keine | 0 |
| 3 | Begegnung 6 | 1 |
| 4 | Begegnung 4 und 6 | 2 |
| 5 (Boss-Stage) | keine | 0 |

- Die Zahl der Elite-Gegner wächst mit C(n), aufgerundet.
- Basistyp: gleichverteilt aus den für das Kapitel erlaubten Typen. Scherge ab Kapitel 1, Brecher ab Kapitel 2, Wächter ab Kapitel 5 (Feld \`basesFromChapter\`). Werte laut 9.3.
- **Affix:** Jede Elite trägt genau eines von vier Affixen (gleichverteilt): *Schild* (Schild in Höhe von 20 % ihres Lebens, erneuert alle 15 s), *Rasend* (+30 % Angriffs- und Bewegungstempo unter 50 % Leben), *Blutsauger* (heilt sich um 30 % des verursachten Schadens), *Regenerierend* (1 % Max-Leben pro Sekunde, nicht während Betäubung).
- Jede Elite führt alle 12 Sekunden einen Großangriff mit 1,5 s Telegraph (6.7) aus: Bodenschlag im Kreis mit Radius 120 px, Schaden = 15 % RefLeben (Abschnitt 13).
- Elite-Beute: 25 % Chance auf einen Gegenstand (12.8), XP- und Gold-Anteil nach Gewicht 6,0 (12.3).

### 9.8 Umgebungsgefahren

Jedes Kapitel hat eine Gefahr, die in den Begegnungen 3 und 5 jeder normalen Stage auftritt. Jede Gefahr wird 1,5 Sekunden vorher angezeigt (6.7) und macht **4 % RefLeben** Schaden (Element des Kapitels, reduziert durch Resistenz). Es erscheint höchstens eine Gefahr alle 6 Sekunden pro Party, an einer zufälligen Position im Band.

| Kapitel | Gefahr |
| --- | --- |
| 1 Aschenwälder | Feuersäulen (Kreis, Radius 90 px) |
| 2 Frostmoore | Eisbrocken, die aus der Höhe fallen (Kreis, Radius 80 px), hinterlassen 4 s Eisfläche mit −30 % Bewegung |
| 3 Sturmklippen | Blitzeinschläge (Kreis, Radius 70 px), Schock für 3 s |
| 4 Tiefenwurzeln | Wurzelausbrüche (Linie, 60 px breit, 300 px lang), Wurzel für 1 s |
| 5 Sonnenruinen | Lichtstrahlen (Linie, 50 px breit), Blendung für 3 s |
| 6 Schattenthron | Schattenzonen (Kreis, Radius 100 px, bleibt 5 s), Verderbnis 1 Stapel je Sekunde in der Zone |

Gefahren schaden nicht Gegnern. Sie skalieren nicht mit der Spielerzahl. Boss-Stages haben keine Umgebungsgefahr, weil sie nur zwei Begegnungen haben.

### 9.9 Kapitelübersicht der Gegner

| Kapitel | Element | Neue Typen | Stage 5 |
| --- | --- | --- | --- |
| 1 | Feuer | Scherge, Hetzer, Schütze, Schwarmling | Boss Ignarch |
| 2 | Eis | Brecher, Priester | Boss Glaciara |
| 3 | Blitz | Kultist, erste Elite | Boss Voltrax |
| 4 | Erde | Bomber | Boss Gorthul |
| 5 | Licht | Wächter | Boss Solaris |
| 6 | Schatten | (keine neuen) | Boss Nyxhara |

Die Boss-Stage (5) hat 2 Begegnungen: bei x = 1.800 mit 8 Punkten, bei x = 3.600 mit 10 Punkten (jeweils mal C(n)). Die Boss-Stage hat Checkpoints bei x = 2.700 und am Arena-Tor (x = 4.500). Danach folgt die Boss-Arena (Abschnitt 10). Die Boss-Stage ist damit rund 4.500 px lang und dauert vor dem Boss etwa 2 Minuten.

### 9.10 Daten

Jede Stage ist eine Datei `content/levels/stage-NN.json` (NN = 01 bis 30). Sie enthält Stage-Nummer, Kapitel, Länge, die Positionen und Basispunkte der Begegnungen, die Checkpoints, die Elite-Begegnungen, die Gefahr sowie Verweise auf Story-Text und Beute-Tabellen. Die Palette steht in `content/levels/palette.json`, die Gegnertypen in `content/enemies.json`. Die Feldnamen stehen in Abschnitt 15.
