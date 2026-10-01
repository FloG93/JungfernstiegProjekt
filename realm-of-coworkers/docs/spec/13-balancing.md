## 13 Balancing und Konsistenzprüfung

Dieser Abschnitt belegt mit Rechnungen, dass Klassen, Gruppengrößen, Bosse, Beute und Fortschritt zusammenpassen. Alle Zahlen stammen aus einem Balance-Modell (Python), das in `tools/balance` als `pnpm balance` nachgebaut wird (2.1). Die Ergebnisse unten sind die Sollwerte, gegen die dieses Werkzeug testet (13.9). Der vollständige Code des Modells steht in Anhang A, alle Modellannahmen in 13.11.

### 13.1 Methode

1. Ein **Referenzheld** definiert die Sollstärke: Heldenstufe 5 × Kapitel, alle 7 Slots mit Gegenständen der Seltenheit Selten und iLvl 5 × Kapitel, ohne Gems, Artefakte, Waffenstufe und Verzauberung.
2. Aus dem Referenzhelden folgen **Standard-DPS**, **Leben** und **RefLeben** jeder Klasse (13.2, 13.3).
3. Boss-Leben, Boss-Schaden und Gegnerwerte werden aus diesen Referenzwerten abgeleitet (13.4).
4. Danach werden Gruppengrößen, Zusammensetzungen und Spielerstärken durchgerechnet (13.5 bis 13.8).
5. Der Spielerfaktor (reale Spieler treffen und weichen schlechter aus als das Modell) und die Reserve aus Gems, Artefakten und Waffenstufe (7.8) werden getrennt ausgewiesen.

Annahmen des Modells: Boss-Mitigation 25 % (Faktor 0,75), neutrales Element, alle Fähigkeiten laufen dauerhaft im Auto-Cast, Krit-Bonus im Mittel 1 + 0,5 × Krit-Chance, Runenweber-Team-Bonus +12,8 % auf den Schaden der anderen (4.10).

### 13.2 Standard-DPS

```text
Standard-DPS = Kraft × K × (1 + Tempo/100) × (1 + min(Krit,75)/100 × 0,5) × 0,75
```

K ist die Summe aus Koeffizient ÷ Abklingzeit aller Schadensfähigkeiten einer Klasse (Abschnitt 4), einschließlich Automatikangriff und Ultimate:

| Klasse | K | Herleitung |
| --- | --- | --- |
| Krieger | 1,11 | 0,78 (Hieb) + 1,6/8 (Schildstoß) + 0,3/10 (Spott) + 1,2/12 (Wirbelhieb) |
| Magier | 1,64 | 0,75 + 2,4/6 + 2,6/9 + 12,0/60 |
| Waldläufer | 1,63 | (0,70 + 2,6/6 + 1,6/12 + 5 × 0,7/12) mal 1,05 (Adlerauge) |
| Schurke | 1,62 | 0,65 + 2,8/8 + 0,35 × 6/10 + 1,0/9 + 6 × 0,9/55, dazu Blutdurst, Meucheln-Bonus und Tarnung |
| Kleriker | 0,65 | 0,60 + 0,8/16 |
| Runenweber | 0,78 | 0,73 + 1,0/20 |

### 13.3 Referenzwerte je Kapitel

Standard-DPS des Referenzhelden (Boss-Mitigation eingerechnet):

| Klasse | Kap. 1 | Kap. 2 | Kap. 3 | Kap. 4 | Kap. 5 | Kap. 6 |
| --- | --- | --- | --- | --- | --- | --- |
| Krieger | 40 | 65 | 90 | 115 | 142 | 169 |
| Magier | 79 | 129 | 182 | 238 | 296 | 358 |
| Waldläufer | 76 | 124 | 175 | 229 | 285 | 344 |
| Schurke | 73 | 119 | 168 | 220 | 274 | 331 |
| Kleriker | 25 | 40 | 56 | 73 | 90 | 107 |
| Runenweber | 32 | 52 | 73 | 95 | 119 | 143 |

Max-Leben des Referenzhelden:

| Klasse | Kap. 1 | Kap. 2 | Kap. 3 | Kap. 4 | Kap. 5 | Kap. 6 |
| --- | --- | --- | --- | --- | --- | --- |
| Krieger | 556 | 836 | 1.116 | 1.396 | 1.677 | 1.957 |
| Magier | 304 | 455 | 605 | 756 | 907 | 1.057 |
| Waldläufer | 354 | 529 | 703 | 878 | 1.053 | 1.227 |
| Schurke | 369 | 553 | 738 | 922 | 1.107 | 1.292 |
| Kleriker | 465 | 701 | 936 | 1.172 | 1.408 | 1.643 |
| Runenweber | 392 | 590 | 788 | 986 | 1.185 | 1.383 |
| **RefLeben (Mittelwert)** | **407** | **611** | **815** | **1.019** | **1.223** | **1.427** |

Der Kleriker heilt im Standardmodell (Heilendes Licht, Segensaura, Läuterung) 27 (Kap. 1), 44, 61, 78, 97 und 115 (Kap. 6) Leben pro Sekunde.

### 13.4 Ableitung der Bosswerte

- **Boss-Leben** B(Kapitel) = 150 s mal Mittelwert der Standard-DPS von Magier, Waldläufer und Schurke: 11.400, 18.600, 26.300, 34.300, 42.700, 51.600 (10.3). Ein Solo-Held einer Schadensklasse besiegt den Boss also in 150 s.
- **Gruppenfaktoren** F(n) und M(n) (10.3), C(n) und H(n) für normale Begegnungen (9.6).
- **Boss-Schaden:** 11 % (Standard), 8 % (Puls), 30 % (Telegraph), 20 % (Signatur) von RefLeben, mal M(n) (10.4).
- **Gegnerwerte:** Leben 60 + 38 × Lv, Schaden 1 + 0,35 × Lv (9.4).

### 13.5 Kampfdauer der Bosse

Dauer bis zum Sieg bei Referenzstärke, neutralem Element und voller Schadensausnutzung:

**Solo (mit Einzelkämpfer-Multiplikator, 4.4):**

| Klasse | Kap. 1 | Kap. 3 | Kap. 6 |
| --- | --- | --- | --- |
| Krieger | 177 s | 183 s | 191 s |
| Magier | 144 s | 145 s | 144 s |
| Waldläufer | 149 s | 150 s | 150 s |
| Schurke | 156 s | 156 s | 156 s |
| Kleriker | 191 s | 196 s | 200 s |
| Runenweber | 180 s | 181 s | 180 s |

Die Spanne zwischen schnellster und langsamster Klasse beträgt 1,39. Die Kapitel unterscheiden sich um höchstens 8 %, die Skalierung bleibt also über die Kapitel stabil.

**Gruppen** (Kapitel 3 / Kapitel 6):

| Zusammensetzung | n | Kap. 3 | Kap. 6 |
| --- | --- | --- | --- |
| Alle 6 Klassen | 6 | 151 s | 151 s |
| Krieger, Magier, Waldläufer, Schurke, Runenweber | 5 | 137 s | 138 s |
| Krieger, Kleriker, Magier, Schurke | 4 | 172 s | 174 s |
| Magier, Waldläufer, Schurke | 3 | 125 s | 125 s |
| Magier, Waldläufer | 2 | 129 s | 129 s |
| 6 mal Magier | 6 | 114 s | 114 s |
| Krieger, Kleriker | 2 | 316 s | 327 s |
| 4 Kleriker, 2 Krieger | 6 | 310 s | 319 s |
| 3 Kleriker | 3 | 391 s | 400 s |

Zufällig zusammengesetzte Gruppen (Kapitel 3, Mittelwert, 10. bis 90. Perzentil):

| Spieler n | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- |
| Mittelwert | 168 s | 201 s | 183 s | 173 s | 166 s | 163 s |
| P10 bis P90 | 145 bis 196 | 131 bis 316 | 127 bis 267 | 129 bis 223 | 132 bis 211 | 130 bis 206 |

Die Kampfdauer ist damit fast unabhängig von der Gruppengröße (Mittelwerte 163 bis 201 s). Von allen möglichen Zusammensetzungen mit mindestens einer Schadensklasse (Magier, Waldläufer, Schurke) liegen 85 % bei höchstens 200 s und 99 % bei höchstens 250 s, der Höchstwert ist 282 s (ein Schurke mit fünf Klerikern). Eine Gruppe ganz ohne Schadensklasse ist bewusst langsamer, typisch 5 Minuten (Krieger und Kleriker), im Extremfall 7 Minuten (zwei Kleriker). Der Enrage bei 480 s (10.1) lässt dafür eine Reserve von 14 bis 50 %.

**Realistische Dauer.** Reale Spieler erreichen nur einen Teil des Modell-DPS (Spielerfaktor 0,70 schlecht, 0,75 typisch, 0,85 gut) und nutzen Elemente unterschiedlich gut (Faktor 0,7 falsch, 1,25 gemischt, 1,45 überwiegend richtig, 10.7). Dazu kommt die erwartete Stärke aus Gems, Artefakten und Waffenstufe (13.8: Faktor 1,22 in Kapitel 3, 1,42 in Kapitel 6):

| Gruppe | Kap. | Referenz | schlecht | typisch | gut |
| --- | --- | --- | --- | --- | --- |
| Solo Magier | 3 | 145 s | 242 s | 126 s | 96 s |
| Solo Magier | 6 | 144 s | 207 s | 108 s | 82 s |
| Solo Krieger | 3 | 183 s | 307 s | 160 s | 122 s |
| Solo Krieger | 6 | 191 s | 275 s | 144 s | 109 s |
| Solo Kleriker | 3 | 196 s | 327 s | 171 s | 130 s |
| Solo Kleriker | 6 | 200 s | 288 s | 150 s | 114 s |
| Krieger, Kleriker, Magier, Schurke | 3 | 172 s | 288 s | 151 s | 115 s |
| Krieger, Kleriker, Magier, Schurke | 6 | 174 s | 250 s | 131 s | 99 s |
| Alle 6 Klassen | 3 | 151 s | 252 s | 132 s | 100 s |
| Alle 6 Klassen | 6 | 151 s | 217 s | 114 s | 86 s |
| Krieger, Kleriker | 3 | 316 s | 529 s | 276 s | 210 s |
| Krieger, Kleriker | 6 | 327 s | 470 s | 246 s | 187 s |

Typische Kämpfe von Gruppen mit Schadensklasse liegen bei 1,5 bis 3 Minuten (Ziel aus 1.2: 2 bis 4 Minuten), schlechte Spieler brauchen bis zu 5,5 Minuten. Die Gruppe Krieger und Kleriker braucht typisch 4 bis 4,6 Minuten. Nur sie überschreitet bei schlechtem Spiel in Kapitel 3 den Enrage (529 s). Der Enrage verlängert den Kampf dann, macht ihn aber nicht unlösbar.

### 13.6 Überleben in Bosskämpfen

**Tank und Heiler.** Angenommen wird ein Krieger als Ziel der Standardangriffe (Rüstung +15 % durch Standhaft) und ein Kleriker als Heiler. Verhältnis des Tank-Schadens zur Heilung des Klerikers, bei voller Schadensstärke n = 6 (M = 1):

| Kapitel | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- |
| Tank-Schaden pro Sekunde | 13,9 | 20,9 | 27,9 | 34,9 | 41,9 | 48,8 |
| Heilung des Klerikers pro Sekunde | 27,2 | 43,8 | 60,8 | 78,4 | 96,5 | 115,1 |
| Verhältnis (Standard, Puls, Telegraph-Anteil) | 0,51 | 0,48 | 0,46 | 0,44 | 0,43 | 0,42 |
| Davon nur Standardangriff | 0,38 | 0,36 | 0,34 | 0,33 | 0,33 | 0,32 |
| Verhältnis bei n = 3 (M = 0,55) | 0,28 | 0,26 | 0,25 | 0,24 | 0,24 | 0,23 |

Der Kleriker muss bei n = 6 also rund 42 bis 51 % seiner Heilung auf den Tank verwenden. Die Pulse auf die anderen fünf Helden benötigen noch rund 30 % (Kapitel 3: 5 × 4 = 20 Leben pro Sekunde). Zusammen sind es 72 bis 81 %. Das Verhältnis ist bewusst knapp, denn der Heiler soll gebraucht werden, aber er ist nicht überfordert.

**Solo ohne Heiler.** Erlittener Schaden über die Dauer des Solo-Kampfes in Prozent des Max-Lebens (Standard, Puls und einen Anteil der ausweichbaren Angriffe, M = 0,25):

| Klasse | Kap. 1 | Kap. 3 | Kap. 6 |
| --- | --- | --- | --- |
| Krieger | 114 % | 118 % | 123 % |
| Magier | 205 % | 208 % | 208 % |
| Waldläufer | 180 % | 183 % | 183 % |
| Schurke | 178 % | 179 % | 179 % |
| Kleriker | 162 % | 165 % | 168 % |
| Runenweber | 190 % | 190 % | 189 % |

Effektiver Puffer: 100 % Leben, 140 % aus 4 Heiltränken (4.4) und 50 % aus zwei Phasenheilungen (10.5), zusammen 290 %. Der höchste Druck (208 %, Magier) liegt um den Faktor 1,4 darunter. Zusätzlich hat der Magier die Arkane Barriere (bis zu 190 % Schild bei ständigem Einsatz), der Krieger Bollwerk und Spott, der Kleriker seine eigene Heilung.

**Gruppen ohne Heiler.** Tank-Druck über die Kampfdauer, mit Wutwechsel, Spott und Bollwerk eingerechnet:

| Gruppe | Kapitel 3 | Kapitel 6 |
| --- | --- | --- |
| 5 Klassen (Krieger, Magier, Waldläufer, Schurke, Runenweber), M = 0,85 | 197 % | 197 % |
| 4 Klassen (Krieger, Magier, Waldläufer, Schurke), M = 0,70 | 164 % | 165 % |
| 2 Helden (Krieger, Waldläufer), M = 0,40 | 117 % | 119 % |

Der Puffer von 290 % wird nie überschritten. Ein Magier in der 5er-Gruppe ohne Heiler erleidet durch Pulse 113 bis 116 % seines Lebens.

### 13.7 Reguläre Begegnungen und Stage-Dauer

**Tank und Heiler in normalen Begegnungen.** Vier Nahkämpfer greifen gleichzeitig den Krieger an (Angriffsplätze, 9.4):

| Stage | 4 | 9 | 14 | 19 | 24 | 29 |
| --- | --- | --- | --- | --- | --- | --- |
| Tank-Schaden pro Sekunde | 5,6 | 9,7 | 13,8 | 17,9 | 22,0 | 26,1 |
| Tank-Leben | 500 | 780 | 1.060 | 1.340 | 1.621 | 1.901 |
| Heilung des Klerikers pro Sekunde | 24,0 | 40,4 | 57,4 | 74,8 | 92,8 | 111,3 |
| Verhältnis | 0,23 | 0,24 | 0,24 | 0,24 | 0,24 | 0,23 |

Normale Begegnungen belasten Tank und Heiler also mit rund einem Viertel der Heilung. Das ist bewusst weniger als bei Bossen (0,42 bis 0,51).

**Solo, Schaden pro Begegnung** (im Mittel 3 gleichzeitige Angreifer) in Prozent des Max-Lebens:

| Klasse | Stage 9 | Stage 19 | Stage 29 |
| --- | --- | --- | --- |
| Krieger | 35 % | 39 % | 40 % |
| Magier | 41 % | 45 % | 45 % |
| Waldläufer | 49 % | 54 % | 54 % |
| Schurke | 62 % | 68 % | 68 % |
| Kleriker | 54 % | 61 % | 62 % |
| Runenweber | 67 % | 73 % | 73 % |

Zwischen den Begegnungen regenerieren Helden 4 % Max-Leben pro Sekunde (9.2). Kein Wert erreicht 100 %, sodass Tränke nur als Reserve dienen.

**Kampfzeit pro Stage** (66 Punkte, Mitigation 15 %):

| Gruppe | Stage 10 | Stage 30 |
| --- | --- | --- |
| Solo Krieger | 225 s | 235 s |
| Solo Magier | 110 s | 108 s |
| Solo Waldläufer | 159 s | 156 s |
| Solo Schurke | 215 s | 211 s |
| Solo Kleriker | 253 s | 258 s |
| Solo Runenweber | 248 s | 244 s |
| 6 Klassen, n = 6 | 161 s | 160 s |

Mit dem Laufen (rund 130 s) und den Spawn-Pausen ergibt das 5,5 bis 7,5 Minuten pro Stage (Ziel aus 1.2: 5 bis 8 Minuten).

### 13.8 Fortschritt und Ausrüstung

**Erwartete Heldenstärke.** Ausrüstung laut 12.9, dazu Waffenstufe (3, 6, 8, 10, 10, 10 am Kapitelende, Abschnitt 8.4 mit 50 % der XP), Gems und Artefakte laut 7.8. Verzauberung wird ab Kapitel 4 mit +5 %, +10 % und +15 % Schaden angesetzt (ein Teil der 16.500 Gold pro Waffe). Angegeben ist das Verhältnis der Schadenskennzahl zum Referenzhelden:

| Kapitelende | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- |
| Gesamtpunkte im Vergleich zum Referenzhelden | 0,95 | 1,15 | 1,31 | 1,38 | 1,48 | 1,49 |
| DPS Krieger, ohne Verzauberung | 0,97 | 1,09 | 1,20 | 1,25 | 1,33 | 1,35 |
| DPS Magier, ohne Verzauberung | 0,97 | 1,11 | 1,25 | 1,32 | 1,44 | 1,46 |
| DPS Kleriker, ohne Verzauberung | 0,97 | 1,10 | 1,21 | 1,27 | 1,36 | 1,38 |
| DPS Krieger / Magier / Kleriker, mit Verzauberung |  |  |  | 1,32 / 1,39 / 1,34 | 1,47 / 1,58 / 1,50 | 1,55 / 1,68 / 1,59 |

Die Stärke wächst also von 0,97 auf 1,35 bis 1,68 gegenüber dem Referenzhelden. In Kapitel 1 liegt sie knapp unter 1,0 (schwache Ausrüstung, 12.9), aber die Einführungsfaktoren (4.3) und die niedrige Anforderung der ersten Stages gleichen das aus. Die drei gerechneten Vertreter (Tank, Schaden, Heiler) liegen im selben Kapitel höchstens 13 Prozentpunkte auseinander. Das Leben wächst im gleichen Maß (Faktor 0,97 bis 1,33).

**Ausbau im Endspiel** (DPS-Faktor gegenüber dem Referenzhelden von Kapitel 6, inklusive Verzauberung +19 %):

| Ausbau | Magier | Krieger |
| --- | --- | --- |
| iLvl 30 Episch, legendäre Bosswaffe, Waffenstufe 10, 9 Gems der Stufe V, 3 Artefakte Rang 5 (Gems gleichmäßig) | 2,05 | 1,83 |
| iLvl 34, alles Legendär, ELE +5 % | 2,61 | 2,25 |
| wie zuvor, alle Gems in Kraft | 2,89 | 2,79 |

Der Vollausbau ist also rund 2,3- bis 2,9-mal so stark wie der Referenzheld. Bosse mit Kampfstufe 4 (+20 % Leben und Schaden) besiegen solche Helden in rund 70 bis 90 Sekunden. Das ist der Lohn für Wiederholungen. Die Kampfstufe ist daten-gesteuert (`kampfstufeProzent`, Standard 5) und lässt sich nach dem Playtest erhöhen.

**XP und Gold.** Die Kampagne liefert 224.654 XP. Heldenstufe s zu Beginn der Stage s, Stufe 30 nach Stage 29 (12.2, 12.4). Das Gold der Kampagne beträgt rund 28.700 (12.5).

### 13.9 Akzeptanzgrenzen für `pnpm balance`

Das Werkzeug rechnet die Modelle dieses Abschnitts aus den JSON-Dateien nach und bricht ab, wenn eine Grenze verletzt wird:

| Prüfung | Grenze |
| --- | --- |
| Solo-Kampfdauer je Klasse und Kapitel (Referenz, neutral) | 130 bis 210 s |
| Spanne schnellste zu langsamste Solo-Klasse | höchstens 1,45 |
| Kampfdauer Gruppen mit mindestens einer Schadensklasse | 110 bis 290 s |
| Kampfdauer Gruppen ohne Schadensklasse | höchstens 430 s |
| Verhältnis Tank-Schaden zu Heilung (Standardangriff, n = 6) | höchstens 0,45 |
| Verhältnis Tank-Schaden zu Heilung (gesamt, n = 6) | höchstens 0,55 |
| Solo-Druck durch Boss | höchstens 230 % Max-Leben |
| Tank-Druck ohne Heiler | höchstens 250 % Max-Leben |
| Verhältnis Tank-Schaden zu Heilung, normale Begegnung | höchstens 0,35 |
| Schaden pro Begegnung solo | höchstens 80 % Max-Leben |
| Kampfzeit pro Stage, solo | 90 bis 300 s, n = 6 höchstens 200 s |
| Heldenstufe zu Beginn der Stage s | s, mit einer Abweichung von 1 |
| Ausrüstung gegenüber Referenz (12.9) | Mittelwert 0,7 bis 1,1 |
| Gesamtstärke am Kapitelende (13.8, ohne Vollausbau) | 0,9 bis 1,7 |
| Vollausbau | höchstens 3,0 |
| Gold der Kampagne | 25.000 bis 32.000 |

### 13.10 Bekannte Grenzen

- **Modell statt Messung.** K und der mittlere Krit-Bonus sind Näherungen. `pnpm balance` enthält deshalb eine deterministische, kopflose Simulation je Klasse (Abschnitt 16), die K und die Kampfdauer aus den echten Fähigkeitsdaten misst. Weicht der Wert um mehr als 10 % vom Modell ab, sind die Koeffizienten in Abschnitt 4 anzupassen.
- **Gruppen ohne Schadensklasse** sind langsam (bis 7 Minuten in der Referenz).
- **Zusatzeffekte.** Bosswaffen (höchstens 4 %), Artefakte (höchstens 2 %), Boss-Schilde (Glaciara 8 %, Solaris 9 %) und Adds (8 % Kampfdauer) liegen im Toleranzbereich von 10 %. Die Statische Ladung von Voltrax (+25 % Schaden für 8 von 30 s, im Mittel +7 %) ist im Überlebensmodell nicht enthalten; der Puffer (Faktor 1,4, 13.6) deckt sie ab.
- **Vollausbau** macht Bosse schnell (70 bis 90 s). Wer mehr Herausforderung will, erhöht `kampfstufeProzent`.
- **Spielerfaktor und Elementwahl** sind Schätzungen aus dem Modell. Sie sind im Playtest zu prüfen (Abschnitt 16).

### 13.11 Referenzmodell und Annahmen

Alle Tabellen dieses Abschnitts sowie 12.1, 12.2, 12.5 und 12.9 erzeugt das Skript in Anhang A (`python3 ref_model.py`, nur Standardbibliothek). Neben den Spielregeln verwendet es diese Modellannahmen. Sie gelten nur für die Prüfung und gehören nicht in die Spieldaten:

| Annahme | Wert | Verwendet in |
| --- | --- | --- |
| Mitigation des Bosses (neutrales Element) | 25 % | 13.2 bis 13.6 |
| Mittlere Mitigation normaler Gegner | 15 % | 13.7 |
| Krit-Bonus | 1 + 0,5 × Krit-Chance (KSD 150 %) | 13.2 |
| Runenweber-Team-Bonus | +12,8 % auf den Schaden der anderen, in Begegnungen ×0,9 | 13.5, 13.7 |
| Flächenfaktor in Begegnungen | Krieger 1,10, Magier 1,8, Waldläufer 1,3, Schurke 1,0, Kleriker 1,05, Runenweber 1,0 | 13.7 |
| Heilung des Klerikers pro Sekunde | (2,0 × Kraft ÷ 6 + 0,25 × Kraft × 8 ÷ 14 + 1,2 × Kraft ÷ 16) × (1 + TMP ÷ 100), Segensaura nur auf 1 Ziel | 13.3, 13.6, 13.7 |
| Stufe des Bosses in der Mitigationsformel | 5 × Kapitel (5.6) | 13.6 |
| Getroffene Telegraphen | solo und Tank mit Heiler 30 %, Tank ohne Heiler 25 %, andere Helden in Gruppen 15 % | 13.6 |
| Signaturangriff aktiv | 2/3 der Kampfdauer (ab Phase 2) | 13.6 |
| Standardangriffe auf dem Tank trotz Wutwechsel | 73 % | 13.6 |
| Schutz durch Spott und Bollwerk | Faktor 0,84 | 13.6 |
| Gleichzeitige Angreifer | Tank: 4 Nahkämpfer, solo im Mittel 3 | 13.7 |
| Spielerfaktor und Elementfaktor | 0,70 / 0,75 / 0,85 und 0,7 / 1,25 / 1,45 | 13.5 |
| Stärke aus Gems, Artefakten und Waffenstufe | Kapitel 3: 1,22, Kapitel 6: 1,42 | 13.5 |
| Zufallsgruppen | 6.000 Stichproben je n, Seed 3 | 13.5 |
| Beute-Simulation | 3.000 Durchläufe, Seed 1, Elite-Zusatzgegenstand in Stage 3 mit 25 %, in Stage 4 mit 50 % | 12.9 |

`tools/balance` portiert das Skript nach TypeScript. Der Port gilt als korrekt, wenn er alle deterministischen Ausgaben auf die angezeigte Stelle genau trifft. Die Zufallsteile (13.5 Zufallsgruppen, 12.9) verwenden in TypeScript einen anderen Generator; dort gelten Mittelwerte mit ±2 s beziehungsweise ±0,01. Zusätzlich misst die kopflose Simulation dieselben Größen aus den echten Daten (13.10).
