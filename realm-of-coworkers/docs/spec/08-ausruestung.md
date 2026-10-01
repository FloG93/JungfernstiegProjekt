## 8 Waffen, Ausrüstung, Verzauberung und Levelcaps

Jeder Held trägt 7 Ausrüstungsteile. Waffen sind klassenspezifisch, steigen im Einsatz auf und lassen sich nach ihrer Höchststufe verzaubern. Alle Zahlen folgen dem Punktebudget aus Abschnitt 5.

### 8.1 Ausrüstungsslots

| Slot | Slotgewicht | Inhalt |
| --- | --- | --- |
| Waffe | 2,0 | Klassenwaffe laut 4.2, trägt ein Element (8.4). Es gibt zwei Waffensätze (8.6) |
| Rüstung | 1,4 | Körperpanzer |
| Nebenhand | 1,2 | Schild, Grimoire, Köcher, Parierdolch, Heiliges Symbol oder Runenbuch laut 4.2. Ohne Element |
| Helm | 1,0 | Kopfschutz |
| Handschuhe | 0,8 |  |
| Umhang | 0,8 |  |
| Stiefel | 0,8 |  |

Die Materialgruppe ist nur Optik und Name, die Werte richten sich nach der Klasse (5.4):

| Klasse | Material |
| --- | --- |
| Krieger | Platte |
| Kleriker | Kette |
| Waldläufer, Schurke | Leder |
| Magier, Runenweber | Stoff |

Alle Gegenstände sind an die Klasse gebunden, für die sie gefallen sind, und an den Helden. Sie sind nicht handelbar. Einen Gegenstand der Klasse X kann daher nur ein Held der Klasse X erhalten.

### 8.2 Item-Stufe und Anforderung

- **Item-Stufe (iLvl)** bestimmt das Budget (5.3). Sie liegt zwischen 1 und 34.
- Beute aus Stage-Truhen und Gegnern hat die iLvl der Stage: Die Stages sind von 1 bis 30 durchnummeriert (Kapitel 1: Stage 1 bis 5, Kapitel 2: Stage 6 bis 10 usw.). Die empfohlene Heldenstufe einer Stage ist ihre Nummer.
- Boss-Beute hat die iLvl 5 × Kapitel (Kapitel 1: 5, Kapitel 6: 30).
- **Beutestufe:** Jede erfolgreiche Boss-Wiederholung eines Spielers erhöht die iLvl der Boss-Beute dieses Bosses für ihn um 1, höchstens um 4. Der erste Sieg zählt nicht. Ein Kapitel-6-Boss liefert so bis zu iLvl 34.
- **Anforderung:** Heldenstufe mindestens iLvl − 4, mindestens 1. Gegenstände der Stufe 34 setzen also Heldenstufe 30 voraus.

### 8.3 Seltenheiten

| Seltenheit | Farbe | Faktor | Besonderheit |
| --- | --- | --- | --- |
| Gewöhnlich | Grau | 1,00 | keine |
| Ungewöhnlich | Grün | 1,12 | keine |
| Selten | Blau | 1,28 | keine |
| Episch | Violett | 1,48 | keine |
| Legendär | Orange | 1,75 | ELE +1 % je Stück, Bosswaffen tragen zusätzlich einen festen Effekt (8.5) |

- Herkunft: Stage-Truhen und Gegner liefern Gewöhnlich bis Episch. Legendäre Gegenstände stammen ausschließlich von Bossen. Die Wahrscheinlichkeiten stehen in Abschnitt 12.
- Eine Seltenheit ändert nur das Budget und ELE, nicht die Zahl der Werte: Jeder Gegenstand trägt alle 6 Werte (5.4).
- **Namen:** Name = Präfix + Typ + Suffix aus den Listen in `content/items/names.json` (Beispiel: „Zerschlissener Lederhelm der Wachsamkeit“). Die Namen der Legendären sind fest.
- **ELE-Obergrenze:** Die Summe aller ELE-Quellen (Legendär-Ausrüstung, Verzauberung) ist auf 15 % begrenzt.

### 8.4 Waffen

**Element.** Jede Waffe ist Physisch oder trägt eines der 6 Elemente. Gewürfelt wird bei Stage- und Gegnerbeute: Physisch 40 %, jedes Element 10 %. Bosswaffen haben ein festes Element (8.5).

**Waffenstufe.** Jede Waffe hat eine eigene Waffenstufe von 1 bis 10 und sammelt Waffen-XP, solange sie im aktiven Waffensatz ist.

| Waffenstufe | XP bis zur nächsten Stufe | XP kumuliert | Waffenbonus danach |
| --- | --- | --- | --- |
| 1 | 300 | 300 | +3 % |
| 2 | 790 | 1.090 | +6 % |
| 3 | 1.400 | 2.490 | +9 % |
| 4 | 2.090 | 4.580 | +12 % |
| 5 | 2.860 | 7.440 | +15 % |
| 6 | 3.690 | 11.130 | +18 % |
| 7 | 4.570 | 15.700 | +21 % |
| 8 | 5.510 | 21.210 | +24 % |
| 9 | 6.500 | 27.710 | +27 % |
| 10 | Höchststufe |  | +27 % |

Formel der Stufenkosten: XP(i) = auf 10 gerundet von 300 × i hoch 1,4.

- **Waffenbonus:** Das Budget der Waffe steigt um 3 % je Stufe über 1, bei Stufe 10 also um 27 %. Das zusätzliche Budget wird nach den Klassenanteilen (5.4) auf die Werte verteilt.
- **Waffen-XP:** Eine Waffe erhält 50 % der XP, die der Held bekommt (Stage- und Boss-XP, Abschnitt 12). Hat der Held Stufe 30, erhält die Waffe 100 %.
- **Übertragen (Schmiede, Torbek):** Eine neue Waffe der eigenen Klasse kann die Waffenstufe einer älteren übernehmen, wenn die ältere geopfert wird. Kosten: 300 Gold × übertragene Stufe. Verzauberungen gehen dabei nicht über.
- **Elementwechsel (Schmiede):** Ändert das Element einer Waffe der Seltenheit Gewöhnlich bis Episch auf ein beliebiges anderes Element oder Physisch. Kosten: 20 Gold × iLvl. Waffenstufe und Verzauberung bleiben erhalten. Legendäre Waffen sind davon ausgenommen.

### 8.5 Bosswaffen

Jeder der 6 Bosse lässt beim ersten Sieg garantiert eine legendäre Waffe der eigenen Klasse des Spielers fallen. Die Waffe hat das Element des Bosses, den festen Effekt der Tabelle und den Namen „\<Klassenwaffe> des \<Boss>“ (Beispiel: Langschwert des Glutkönigs).

| Boss | Element | Fester Effekt (5 % Chance pro Treffer, nicht pro Tick) |
| --- | --- | --- |
| Ignarch | Feuer | Verbrennung, 1 Stapel |
| Glaciara | Eis | Frost, 1 Stapel |
| Voltrax | Blitz | Schock |
| Gorthul | Erde | Rüstungsbruch, 1 Stapel |
| Solaris | Licht | Blendung |
| Nyxhara | Schatten | Verderbnis, 1 Stapel |

Die Wirkung der Effekte richtet sich nach 6.3. Der Beitrag zum Schaden ist im Balance-Modell mit höchstens 4 % angesetzt (Abschnitt 13).

**Die Elemente sind bewusst so verteilt, dass das Wissen über die Gegenelemente belohnt wird:**

- Das Feuer-Schwert aus Kapitel 1 schlägt den Eis-Boss von Kapitel 2 mit ×1,5.
- Das Blitz-Schwert aus Kapitel 3 schlägt den Erde-Boss von Kapitel 4, das Licht-Schwert aus Kapitel 5 schlägt den Schatten-Boss von Kapitel 6.
- Die zweite Waffe jedes Paares (Eis, Erde, Schatten) schlägt jeweils den ersten Boss des Paares in einer Wiederholung.

Bei Wiederholungen können Bosswaffen erneut fallen (Abschnitt 10). Ein Duplikat ist eine neue Waffe mit eigener Waffenstufe, die per Übertragen (8.4) nutzbar bleibt.

### 8.6 Waffenwechsel

- Jeder Held hat **zwei Waffensätze (A und B)**. Beide sind Klassenwaffen und werden im Lager (Schmiede) belegt.
- Wechsel mit der Taste Q (oder Klick auf das Waffensymbol). Der Wechsel dauert 0,5 Sekunden, in denen der Held nicht angreift, danach gilt eine Sperre von 4 Sekunden.
- Es zählt immer nur die aktive Waffe: Ihr Element gilt für Automatikangriff und Fähigkeiten, ihr Budget zählt zu den Werten. Die Werte werden beim Wechsel neu berechnet. Der Lebensanteil bleibt erhalten.
- Abklingzeiten laufen beim Wechsel weiter. Ausnahme ist der Magier-Passiv Elementarfluss (4.6).
- Waffen-XP erhält nur die aktive Waffe.
- Der Client zeigt beim Zielen das Element und die Schwäche des Ziels an. Bosse zeigen die Schwäche der aktuellen Phase (Abschnitt 10).

### 8.7 Verzauberung

Eine Waffe kann verzaubert werden, sobald sie **Waffenstufe 10** hat (Schmiede, Torbek).

- Eine Waffe hat **3 Verzauberungszeilen**. Jede Zeile wählt eine Art aus der Tabelle. Jede Art darf nur einmal vorkommen.
- Jede Zeile hat 5 Ränge. Der Rang r kostet **100 × r² Gold** (Rang 1: 100, Rang 2: 400, Rang 3: 900, Rang 4: 1.600, Rang 5: 2.500). Eine Zeile bis Rang 5 kostet 5.500 Gold, alle drei kosten 16.500 Gold.
- Die Art einer Zeile lässt sich für 500 Gold ändern. Die Ränge der Zeile gehen dabei verloren.
- Verzauberungen bleiben an der Waffe. Ein Elementwechsel behält sie.

| Art | Wirkung je Rang | Höchstwert (Rang 5) |
| --- | --- | --- |
| Waffenschaden | ELE +2 % | +10 % |
| Kraft | +1 % Gesamtkraft | +5 % |
| Krit-Schaden | +2 Prozentpunkte KSD | +10 Prozentpunkte |
| Tempo | +1 Prozentpunkt TMP | +5 Prozentpunkte |
| Vitalität | +2 % Max-Leben | +10 % |
| Panzerung | +2 % Rüstung und Resistenz | +10 % |

Die Kombination Waffenschaden, Kraft und Krit-Schaden gibt einem Schadensklasse-Helden bei 40 % Krit-Chance rund +19 % Schaden. Das entspricht der Annahme von +20 % im Balance-Modell (Abschnitt 13). Tanks und Heiler wählen bevorzugt Vitalität und Panzerung.

### 8.8 Alle Obergrenzen im Überblick

| Größe | Höchstwert |
| --- | --- |
| Heldenstufe | 30 |
| Waffenstufe | 10 |
| Item-Stufe | 34 |
| Gem-Slots | 9 (Stufe V je Gem) |
| Artefakte | 3, Rang 5 |
| Verzauberungszeilen | 3, Rang 5 |
| Tempo | 40 % |
| Krit-Chance | 60 % (75 % mit Buffs) |
| Krit-Schaden | 250 % |
| ELE | 15 % |

Nach Heldenstufe 30 fließt XP nur noch in die Waffe (8.4).

### 8.9 Inventar und Verkauf

- Das Inventar fasst 80 Gegenstände, dazu kommt eine Überlauftruhe für 40 Gegenstände im Lager. Ist beides voll, wird der Gegenstand mit dem niedrigsten Budget verkauft, ausgenommen gesperrte (locked), verzauberte und legendäre Gegenstände. Gibt es keinen verkaufbaren, wird der neue Gegenstand verkauft. Gegenstände lassen sich sperren.
- **Verkaufspreis** = Budget des Gegenstands ÷ 4, gerundet. Beispiel: episches Schwert iLvl 30 mit 219 Punkten ergibt 55 Gold.
- Ausgerüstete Gegenstände und Waffen mit Verzauberung lassen sich nur nach einer Bestätigung verkaufen.
- Der Vergleichs-Tooltip zeigt den Unterschied jedes Werts gegenüber dem angelegten Gegenstand und den Unterschied der Budgetpunkte (Abschnitt 14).
