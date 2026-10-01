## 5 Werte und Formeln

Jeder Held hat 7 Kampfwerte. Sie entstehen aus Heldenstufe, Ausrüstung, Gems, Artefakten, Verzauberungen und Buffs. Alle Ausrüstung folgt einem festen Punktebudget, damit Klassen und Spielstufen vergleichbar bleiben.

### 5.1 Die 7 Kampfwerte

| Wert | Kürzel | Wirkung | Grundwert | Obergrenze |
| --- | --- | --- | --- | --- |
| Leben | LEB | Maximale Lebenspunkte | Formel 5.2 | keine |
| Kraft | KRA | Skaliert Schaden, Heilung und Schilde über die Koeffizienten der Fähigkeiten | Formel 5.2 | keine |
| Rüstung | RÜS | Senkt erlittenen physischen Schaden | Formel 5.2 | keine (abnehmender Ertrag durch Formel 5.6) |
| Resistenz | RES | Senkt erlittenen elementaren Schaden | Formel 5.2 | keine (abnehmender Ertrag) |
| Tempo | TMP | Automatikangriff und Fähigkeiten laufen um diesen Prozentsatz schneller | 0 % | 40 % |
| Krit-Chance | KRT | Wahrscheinlichkeit auf kritischen Treffer | 5 % | 60 % (75 % mit Buffs) |
| Krit-Schaden | KSD | Schadensfaktor bei kritischem Treffer | 150 % | 250 % |

Zusätzlich gibt es **Elementarschaden ELE** in Prozent (aus Verzauberungen und Legendär-Ausrüstung). ELE erhöht allen Schaden aus Automatikangriff, Fähigkeiten und eigenem Schaden über Zeit, gleich ob die Waffe physisch ist oder ein Element trägt. Heilung und Schilde erhöht ELE nicht. ELE zählt nicht zum Punktebudget.

### 5.2 Basiswerte durch die Heldenstufe L (1 bis 30)

| Wert | Formel |
| --- | --- |
| Leben | (120 + 14 × (L − 1)) × Leben-Faktor der Klasse (Abschnitt 4.2) |
| Kraft | 10 + 2,2 × (L − 1) |
| Rüstung | 10 + 2,4 × (L − 1) |
| Resistenz | 8 + 2,0 × (L − 1) |
| Tempo, Krit-Chance, Krit-Schaden | 0 %, 5 %, 150 % |

Beispiel Stufe 30: Kraft 73,8, Rüstung 79,6, Resistenz 66,0, Leben 526 mal Klassenfaktor.

### 5.3 Punktebudget einer Ausrüstung

Budget eines Items = Slotgewicht × (8 + 2,2 × Item-Stufe) × Seltenheitsfaktor. Die Item-Stufe (iLvl) liegt zwischen 1 und 34 (Abschnitt 8.2).

| Slot | Slotgewicht |
| --- | --- |
| Waffe | 2,0 |
| Rüstung | 1,4 |
| Nebenhand | 1,2 |
| Helm | 1,0 |
| Handschuhe | 0,8 |
| Umhang | 0,8 |
| Stiefel | 0,8 |

Die Summe der Slotgewichte beträgt 8,0.

| Seltenheit | Gewöhnlich | Ungewöhnlich | Selten | Episch | Legendär |
| --- | --- | --- | --- | --- | --- |
| Faktor | 1,00 | 1,12 | 1,28 | 1,48 | 1,75 |

Beispiel: Waffe, iLvl 30, Episch = 2,0 × (8 + 66) × 1,48 = 219,0 Punkte.

### 5.4 Verteilung der Punkte auf die Werte

Jedes Item trägt alle 6 Werte (LEB, KRA, RÜS, RES, TMP, KRT). Die Verteilung hängt von der Klasse ab, für die es gedroppt ist:

| Klasse | LEB | KRA | RÜS | RES | TMP | KRT |
| --- | --- | --- | --- | --- | --- | --- |
| Krieger | 28 % | 28 % | 22 % | 8 % | 6 % | 8 % |
| Magier | 14 % | 42 % | 6 % | 10 % | 14 % | 14 % |
| Waldläufer | 16 % | 40 % | 8 % | 8 % | 14 % | 14 % |
| Schurke | 18 % | 38 % | 10 % | 6 % | 14 % | 14 % |
| Kleriker | 24 % | 30 % | 14 % | 14 % | 10 % | 8 % |
| Runenweber | 20 % | 32 % | 10 % | 12 % | 16 % | 10 % |

Umrechnung von Punkten in Werte:

| Wert | pro Punkt |
| --- | --- |
| LEB | 6 Lebenspunkte |
| KRA | 0,5 Kraft |
| RÜS | 1,0 Rüstung |
| RES | 1,0 Resistenz |
| TMP | 0,15 Prozentpunkte |
| KRT | 0,10 Prozentpunkte |
| KSD | 0,4 Prozentpunkte (nur Gems, Artefakte, Verzauberung) |

Beim Erzeugen eines Items wird jede Zeile mit einem Zufallsfaktor zwischen 0,92 und 1,08 gewürfelt und die Summe danach auf das Budget zurückgeführt. So sehen Items unterschiedlich aus, das Gesamtbudget bleibt exakt.

Beispiel: Magier-Waffe (219 Punkte) ergibt 46 Kraft, 184 Leben, 13 Rüstung, 22 Resistenz, 4,6 % Tempo und 3,1 % Krit-Chance.

### 5.5 Gesamtwerte eines Helden

Wert = Basiswert (5.2) + Summe der Items + Summe der Gems + Summe der Artefakte. Danach wirken prozentuale Verzauberungen und Klassenpassive, dann Buffs und Debuffs. Zuletzt greifen die Obergrenzen aus 5.1. Klassenpassive: Krieger +15 % Rüstung, Schurke +10 Prozentpunkte Krit-Chance.

### 5.6 Kampfformeln

```latex
\text{Schaden} = k \cdot \text{Kraft}_{\text{eff}} \cdot (1+\text{ELE}) \cdot f_{\text{Element}} \cdot f_{\text{Krit}} \cdot (1-m_{\text{Ziel}}) \cdot \prod (1+\text{Modifikatoren})
```

- **k** ist der Koeffizient der Fähigkeit (Abschnitt 4).
- **Kraft\_eff** = Kraft × (1 + Summe der Kraft-Buffs) × Einzelkämpfer-Multiplikator (nur Solo).
- **f\_Element** = 1,5 bei Schwäche des Ziels, 0,5 bei Resistenz, sonst 1,0. Physischer Schaden (Waffe ohne Element) hat immer 1,0.
- **f\_Krit** = KSD ÷ 100 bei Krit (Zufall unter KRT), sonst 1,0.
- **m\_Ziel** = Rüstungs-Mitigation des Gegners bei physischem Schaden, Resistenz-Mitigation bei elementarem Schaden (Tabelle der Gegnertypen, Abschnitt 9.3).
- **Modifikatoren** sind multiplikative Buffs und Debuffs wie „Ziel erleidet +10 %“ oder „Held verursacht −20 %“.

Erlittener Schaden eines Helden:

```latex
m_{\text{Held}} = \frac{W}{W + 40 + 12 \cdot L_{\text{Angreifer}}}
```

W ist die Rüstung bei physischem und die Resistenz bei elementarem Angriff. L\_Angreifer ist bei normalen Gegnern und Umgebungsgefahren die Stage-Nummer (9.4), bei Bossen und ihren Adds 5 × Kapitel. Schaden über Zeit aus Gegnerquellen wird wie elementarer Schaden gemindert, Blutung wie physischer. Der Schaden wird mit (1 − m) multipliziert. Beispiel: Krieger mit 246 Rüstung gegen Stufe-30-Gegner ergibt 246 ÷ (246 + 40 + 360) = 38 % Mitigation.

- **Heilung** = Koeffizient × Kraft\_eff × (1 + Heilungsmodifikatoren). Heilung kann nicht kritisch treffen.
- **Tempo:** Intervall und Abklingzeit werden durch (1 + TMP ÷ 100) geteilt.
- **Mindestschaden:** 1. Schaden und Heilung werden erst bei der Anwendung gerundet.
- **Schilde** absorbieren vor Leben und laufen nach ihrer Dauer ab. Mehrere Schilde werden nacheinander verbraucht, das jüngste zuerst.
