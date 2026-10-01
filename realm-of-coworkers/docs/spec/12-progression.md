## 12 Progression, Beute und Wirtschaft

Dieser Abschnitt legt fest, wie schnell Helden wachsen, was wo fällt und was Gold kostet. Er schließt an das Balance-Modell an: Ein Held soll zu Beginn der Stage s etwa die Heldenstufe s haben und im Kapitel c mit ungefähr der Ausrüstung des Referenzhelden (Abschnitt 13) den Boss erreichen.

### 12.1 XP-Kurve

XP bis zur nächsten Stufe: **xp(L) = auf 10 gerundet von 100 × L hoch 1,5** (L = aktuelle Heldenstufe, 1 bis 29).

| Stufe L | 1 | 5 | 10 | 15 | 20 | 25 | 29 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| XP bis L + 1 | 100 | 1.120 | 3.160 | 5.810 | 8.940 | 12.500 | 15.620 |

Summe aller XP von Stufe 1 bis Stufe 30: **189.040**. Bei Stufenaufstieg heilt der Held einmalig um 30 % seines Max-Lebens. Die Werte steigen nach 5.2.

### 12.2 XP-Quellen

XP werden pro Spieler vergeben. Sie hängen nicht von der Gruppengröße ab: Jeder Spieler erhält für dieselbe Stage dieselbe Gesamtmenge (Topf-Regel in 12.3).

| Quelle | XP je Spieler (Stage s) |
| --- | --- |
| Normale Stage (s nicht durch 5 teilbar) | xp(s) |
| Boss-Stage, Begegnungen | 0,4 × xp(s) |
| Boss, erster Sieg | 1,0 × xp(s) |
| Boss, Wiederholung | 0,5 × xp(s) |
| Wiederholung einer normalen Stage | 0,4 × xp(s) |
| Helfer-Modus (10.9) | 0 |

Die Kampagne liefert damit insgesamt 224.654 XP, mehr als die 189.040 bis Stufe 30. Ab Stufe 30 verfallen die Held-XP, die Waffen-XP laufen weiter (8.4).

### 12.3 Topf-Regel für XP und Gold

- Jede Begegnung hat einen **Topf**: Stage-Topf (XP xp(s), Gold G(s) laut 12.5) mal Basispunkte der Begegnung geteilt durch 66. Bei der Boss-Stage gilt der Anteil an 18 Punkten und der Topf 0,4 × xp(s).
- Der Topf wird bei jedem Kill nach **Gewicht** (9.3) an alle Spieler verteilt: Anteil = Gewicht des Gegners geteilt durch die Summe der Gewichte aller Gegner der Begegnung. Jeder Spieler erhält den vollen Anteil.
- Gegner, die nicht besiegt werden, geben nichts. Ein Gegner, der aus dem Spiel entfernt wird, gibt seinen Anteil beim Ende der Begegnung an alle Spieler.
- Adds von Bossen geben keinen Anteil.

### 12.4 Kampagnentempo

| Nach Kapitel | Heldenstufe (bei Erwartung) | Kumulierte XP |
| --- | --- | --- |
| 1 | 6 | 3.268 |
| 2 | 11 | 15.972 |
| 3 | 16 | 41.846 |
| 4 | 21 | 83.692 |
| 5 | 26 | 143.922 |
| 6 | 30 (Stufe 30 nach Stage 29) | 224.654 |

Im Boss-Kampf von Kapitel c hat der Held die Stufe 5 × c. Der Start der Stage s liegt bei Stufe s. Dieses Verhältnis ist die Grundlage der Referenzwerte in Abschnitt 13.

### 12.5 Gold

- **Stage-Topf** G(s) = 66 × (2 + 0,6 × s). Er wird nach 12.3 verteilt.
- Beispielwerte: G(1) = 172, G(5) = 330, G(10) = 528, G(20) = 924, G(30) = 1.320.
- **Boss:** erster Sieg 2,0 × G(s), Wiederholung 1,0 × G(s), Helfer 0. Boss-Stage-Begegnungen: 18/66 des Stage-Topfs.
- **Wiederholung einer normalen Stage:** voller Topf (100 %).
- Die Kampagne bringt beim ersten Durchlauf rund **28.700 Gold**. Eine Wiederholung von Stage 30 bringt 1.320 Gold in rund 6,5 Minuten, also gut 12.000 Gold pro Stunde.

### 12.6 Gold-Senken

| Vorgang | Kosten | Ort |
| --- | --- | --- |
| Gems kombinieren | 60 × n² (n = Stufe der Quelle) | Juwelier (7.4) |
| Gem-Art tauschen | 40 × n | Juwelier (7.4) |
| Elementwechsel einer Waffe | 20 × iLvl | Schmiede (8.4) |
| Waffenstufe übertragen | 300 × übertragene Stufe | Schmiede (8.4) |
| Verzaubern | 100 × Rang² je Rang | Schmiede (8.7) |
| Verzauberungsart ändern | 500 | Schmiede (8.7) |
| Heiltränke, Aussehen, Gems einsetzen, Artefakte aufwerten | kostenlos |  |

Richtwerte für den Vollausbau: 9 Gems der Stufe V rein durch Kombinieren kosten rund 57.000 Gold (Stufe V allein 6.360). Höhere Stufen fallen aber auch direkt (7.5), sodass der Bedarf deutlich kleiner ist. Eine Waffe komplett zu verzaubern kostet 16.500 Gold. Im Endspiel ist Gold der Engpass. Das ist gewollt: Es verlängert die Wiederholung von Stages und Bossen.

### 12.7 Verkauf

Verkaufspreis = Budget ÷ 4 (8.9). Ein episches Schwert der Stufe 30 bringt 55 Gold. Verkaufen ist daher keine Hauptquelle.

### 12.8 Beutetabelle für Stage-Truhen

Die Truhe am Ende jeder normalen Stage gehört jedem Spieler einzeln. Sie enthält:

- 2 Gegenstände der Item-Stufe s
- 1 Gem mit 50 % Wahrscheinlichkeit (Tabelle in 7.5)
- 2 Artefaktsplitter (7.6)
- Gold und XP über die Töpfe (12.3, sie fallen an den Begegnungen, nicht in der Truhe)

Zusätzlich lassen Elite-Gegner mit 25 % Wahrscheinlichkeit einen weiteren Gegenstand der Item-Stufe s fallen.

Slot des Gegenstands (gewürfelt): Waffe 16 %, Rüstung 14 %, Nebenhand 14 %, Helm 14 %, Handschuhe 14 %, Umhang 14 %, Stiefel 14 %. Ein Gegenstand gehört immer zur Klasse des Spielers (8.1). Waffen würfeln ihr Element nach 8.4.

Seltenheit nach Kapitel (in %):

| Kapitel | Gewöhnlich | Ungewöhnlich | Selten | Episch |
| --- | --- | --- | --- | --- |
| 1 | 60 | 30 | 10 | – |
| 2 | 40 | 35 | 20 | 5 |
| 3 | 25 | 35 | 30 | 10 |
| 4 | 15 | 30 | 35 | 20 |
| 5 | 10 | 25 | 40 | 25 |
| 6 | 5 | 20 | 40 | 35 |

Legendäre Gegenstände fallen nur von Bossen (10.8). Der Beute-Bildschirm zeigt jeden Gegenstand mit Vergleichswerten (Abschnitt 14).

### 12.9 Modellprüfung der Ausrüstung

Eine Simulation mit dieser Beutetabelle (beste Ausrüstung je Slot, Bosswaffe und ein Bossgegenstand pro Kapitel, keine Wiederholung) ergibt im Mittel folgende Gesamtbudget-Werte im Vergleich zum Referenzhelden (Selten, iLvl 5 × Kapitel, alle 7 Slots):

| Kapitelende | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- |
| Ausrüstung im Vergleich zum Referenzhelden | 0,77 | 0,89 | 0,96 | 1,01 | 1,05 | 1,07 |

In den frühen Kapiteln liegt die Ausrüstung unter dem Referenzhelden. Gems (7.8), Artefakte (7.8) und Waffenstufen (8.4) gleichen das aus (Abschnitt 13). Wiederholungen und höhere Beutestufen (8.2) heben die Werte über den Referenzhelden.

### 12.10 Wiederholungen

- Alle Stages und Bosse sind unbegrenzt wiederholbar. Normale Stages haben keinen Timer, Bosse haben Timer (10.9).
- Wiederholungen einer normalen Stage geben 40 % XP, vollen Topf Gold, volle Truhe und Splitter. Sie sind der Weg, um Ausrüstung, Gems und Gold zu sammeln.
- Bosse bringen Beute nur nach abgelaufenem Timer (10.8).
- Es gibt keine Tagesgrenzen und keine Erschöpfung.
