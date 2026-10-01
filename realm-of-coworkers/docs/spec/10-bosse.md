## 10 Bosskämpfe

Jedes Kapitel endet mit einem Boss. Bosse lassen sich solo oder mit bis zu 5 weiteren Spielern bekämpfen, skalieren mit der Spielerzahl, wechseln ihr Element von Phase zu Phase und tragen Buffs und Debuffs, die Waffen- und Elementwahl entscheidend machen.

### 10.1 Ablauf

1. Nach den beiden Begegnungen der Boss-Stage (9.9) erreicht die Party das Arena-Tor.
2. **Bereit-Bildschirm:** zeigt Boss, Phasen-Elemente, Kampfstufe (10.3) und für jedes Party-Mitglied den Status seines Timers (10.9). Jeder Spieler bestätigt mit „Bereit“. Danach läuft ein Countdown von 10 Sekunden, in dem die Waffe gewechselt werden darf.
3. Zu Kampfbeginn sind alle Helden bei vollem Leben, alle Tränke aufgefüllt und alle Abklingzeiten zurückgesetzt. Danach folgt der Dialog (3.2).
4. Der Kampf läuft in einer festen Arena (10.2). Es gibt keinen Autowalk und kein Verlassen der Arena.
5. **Sieg:** Der Boss stirbt in Phase 3. Es folgt der Dialog, dann der Beute-Bildschirm (10.8).
6. **Wipe:** Sind alle Helden gefallen, kehrt die Party zum Bereit-Bildschirm zurück. Der Boss startet mit vollem Leben und ohne Phasenfortschritt, Tränke werden aufgefüllt (6.8). Es gibt keine Strafe.
7. **Zeitlimit (Enrage):** Nach 480 Sekunden erhält der Boss dauerhaft Raserei (+25 % Schaden), danach alle 30 Sekunden zusätzlich +10 Prozentpunkte.

### 10.2 Arena

- Feste Kamera, Breite 1.600 px, Tiefenband 240 px. Die Helden beginnen bei x = 200 bis 700, der Boss steht bei x = 1.100.
- Der Boss bewegt sich mit 80 px/s auf das Ziel mit der höchsten Bedrohung zu, wenn kein Held in seiner Reichweite von 130 px ist. Ist er in Reichweite, bleibt er stehen.
- Der Boss ist immun gegen Betäubung, Wurzel, Furcht und Einfrieren. Verlangsamungen wirken höchstens mit 40 % (6.4).
- Boss-Angriffe werden durch die Ausweichrolle (0,5 s unverwundbar) und durch das Verlassen der Anzeigefläche vermieden (6.7).
- Bedrohung und Wutwechsel gelten wie in 6.6: Der Boss greift den Helden mit der höchsten Bedrohung an. Alle 15 Sekunden wechselt er 4 Sekunden lang auf einen zufälligen lebenden Helden, außer ein Spott hält ihn fest.

### 10.3 Skalierung mit der Spielerzahl

Es gibt drei Faktoren. Sie legen fest, dass Bosse mit mehr Spielern mehr aushalten, aber nicht im gleichen Maß mehr Schaden pro Held verursachen. So wird ein Team mit vielen Helden nicht überfordert und ein Solo-Held nicht überrannt.

- **Lebensfaktor** F(n) = 1 + 0,75 × (n − 1)
- **Schadensfaktor** M(n) = 0,25 + 0,15 × (n − 1)
- **Kampfstufe** K (0 bis 4) aus 10.9: Boss-Leben und Boss-Schaden ×(1 + 0,05 × K).

| Spieler n | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- |
| F(n) | 1,00 | 1,75 | 2,50 | 3,25 | 4,00 | 4,75 |
| M(n) | 0,25 | 0,40 | 0,55 | 0,70 | 0,85 | 1,00 |

**Boss-Leben** = B(Kapitel) × F(n) × (1 + 0,05 × K). B ist das Boss-Leben für einen Spieler ohne Kampfstufe:

| Kapitel | B (n = 1) | n = 2 | n = 3 | n = 4 | n = 5 | n = 6 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 Ignarch | 11.400 | 20.000 | 28.500 | 37.000 | 45.600 | 54.200 |
| 2 Glaciara | 18.600 | 32.600 | 46.500 | 60.400 | 74.400 | 88.400 |
| 3 Voltrax | 26.300 | 46.000 | 65.800 | 85.500 | 105.200 | 124.900 |
| 4 Gorthul | 34.300 | 60.000 | 85.800 | 111.500 | 137.200 | 162.900 |
| 5 Solaris | 42.700 | 74.700 | 106.800 | 138.800 | 170.800 | 202.800 |
| 6 Nyxhara | 51.600 | 90.300 | 129.000 | 167.700 | 206.400 | 245.100 |

Die Tabelle ist auf 100 gerundet, maßgeblich ist die Formel.

B(Kapitel) ist 150 Sekunden mal der Standard-DPS des Mittelwerts aus Magier, Waldläufer und Schurke im jeweiligen Kapitel (Abschnitt 13). Ein Solo-Schadensklasse-Held besiegt den Boss also in rund 150 Sekunden.

### 10.4 Angriffe des Bosses

Alle Schadenswerte sind Anteile des **RefLeben** des Kapitels (Abschnitt 13) mal M(n) mal (1 + 0,05 × K). RefLeben: Kapitel 1: 407, 2: 611, 3: 815, 4: 1.019, 5: 1.223, 6: 1.427.

| Angriff | Intervall | Ziel | Schadensart | Anteil RefLeben | Hinweis |
| --- | --- | --- | --- | --- | --- |
| Standardangriff | 2,5 s | Ziel mit höchster Bedrohung | physisch (Rüstung) | 11 % | Reichweite 130 px, sonst Fernwurf mit gleichem Schaden |
| Puls | 12 s | alle lebenden Helden | elementar (Resistenz) | 8 % | Element der Phase, nicht ausweichbar |
| Telegraph | 20 s | ein zufälliger Held, Kreis Radius 110 px | elementar | 30 % | 1,5 s Anzeige, ausweichbar (6.7) |
| Signaturangriff | 30 s (ab Phase 2) | siehe 10.6 | elementar | 20 % | ausweichbar |
| Wutwechsel | 15 s | zufälliger Held, 4 s |  |  | 6.6 |

Beispiel Kapitel 3, sechs Spieler, K = 0: Standardangriff 90 Schaden, Puls 65, Telegraph 244, Signatur 163, jeweils vor Mitigation. Bei einem Spieler (M = 0,25): 22, 16, 61, 41.

**Adds:** Alle 30 Sekunden (erste Welle nach 15 s) erscheint eine Gruppe von 4 Schwarmlingen (1,2 Punkte) mal C(n) (9.6) am Rand der Arena. Sie tragen das Kapitel-Element und haben die Werte von Schwarmlingen der Gegnerstufe 5 × Kapitel mit dem Lebensfaktor H(n) (9.6). Das Balance-Modell rechnet dafür mit rund 8 % zusätzlicher Kampfdauer. Beim Phasenübergang sterben alle Adds.

### 10.5 Phasen und Elemente

Jeder Boss hat 3 Phasen mit den Schwellen 100 bis 66 %, 66 bis 33 % und 33 bis 0 % Leben.

- **Phasenübergang** (6.8): 5 Sekunden Unverwundbarkeit des Bosses, alle Helden werden um 25 % Max-Leben geheilt, Gefallene mit 50 % Leben belebt. Während dieser Zeit kann die Waffe gewechselt werden.
- **Elemente:** Phase 1 und 3 haben das Element des Bosses, Phase 2 das Gegenelement. Ein Boss hat in jeder Phase die Schwäche des Gegenelements seiner aktuellen Phase (6.1): ×1,5 vom Gegenelement, ×0,5 vom eigenen Phasen-Element, sonst ×1,0.
- **Gegenelement-Paare** (6.1): Feuer und Eis, Blitz und Erde, Licht und Schatten.
- Beispiel Ignarch: Phase 1 und 3 Feuer (schwach gegen Eis), Phase 2 Eis (schwach gegen Feuer). Mit zwei Waffen (Eis und Feuer) und dem Waffenwechsel (8.6) trifft man in jeder Phase mit ×1,5.
- Das Element der Phase wird über der Bosslebensleiste und als Farbe des Bosses angezeigt (Abschnitt 14). Der Puls hat immer das Phasen-Element.

### 10.6 Die sechs Bosse

| Boss | Elemente Phase 1 / 2 / 3 | Rüstung | Resistenz | Passiver Buff | Debuff auf Helden | Signaturangriff (ab Phase 2, alle 30 s) |
| --- | --- | --- | --- | --- | --- | --- |
| Ignarch, Glutkönig | Feuer / Eis / Feuer | 30 % | 20 % | **Glutmantel:** Nahkämpfer im Umkreis 120 px erhalten alle 3 s Verbrennung (1 Stapel) | Verbrennung | **Glutregen:** 8 Feuersäulen (Radius 90 px) an zufälligen Orten im Band, je 20 % RefLeben |
| Glaciara, Frostwitwe | Eis / Feuer / Eis | 35 % | 20 % | **Eispanzer:** Schild in Höhe von 2 % Boss-Leben, erneuert sich alle 45 s | Frost | **Frostnova:** Kreis Radius 260 px um den Boss, 20 % RefLeben, Frost 2 Stapel (Fernkämpfer sind sicher) |
| Voltrax, Sturmtyrann | Blitz / Erde / Blitz | 20 % | 30 % | **Statische Ladung:** alle 30 s für 8 s Raserei (+25 % Schaden) | Schock | **Kettenblitz:** springt 5-mal zwischen Helden (Sprungradius 300 px), je Sprung 15 % RefLeben, danach Schock (6 s) |
| Gorthul, Steinwächter | Erde / Blitz / Erde | 45 % | 15 % | **Steinhaut:** physischer Schaden −25 % (multiplikativ zur Rüstung) | Wurzel (2 s) | **Beben:** Kreis Radius 300 px um den Boss, 25 % RefLeben, Betäubung 1,5 s (die Ausweichrolle verhindert die Betäubung) |
| Solaris, Seraph | Licht / Schatten / Licht | 25 % | 25 % | **Sonnenschild:** Schild in Höhe von 3 % Boss-Leben zu Beginn jeder Phase | Blendung | **Strahlenbündel:** 3 rotierende Lichtlinien (Breite 50 px), je Treffer 20 % RefLeben |
| Nyxhara, die Stille | Schatten / Licht / Schatten | 25 % | 25 % | **Schattenhülle:** Elementarschaden −10 % (multiplikativ zur Resistenz) | Verderbnis | **Stille:** 3 Lichtkreise (Radius 120 px) erscheinen, nach 3 s erhalten alle Helden außerhalb Furcht 2 s und 15 % RefLeben |

Hinweise:

- Die Schilde von Glaciara und Solaris zählen zum Leben (sie sind zusätzliches Leben, das als Schaden abgetragen werden muss). Das Balance-Modell rechnet sie mit +8 % (Glaciara: 4 Schilde à 2 %) und +9 % (Solaris: 3 Schilde à 3 %).
- **Verbrennung, Frost, Schock, Blendung, Verderbnis, Wurzel** der Bosse wirken wie in 6.3. Boss-Quelle: Verbrennung 1,0 % RefLeben pro Sekunde.
- Ein Held mit Schwächungs-Fähigkeiten (Rüstungsbruch, Runenbruch, Verderbnis) verringert die Rüstungs- und Resistenzwerte des Bosses wie in 6.3 beschrieben.

### 10.7 Waffen- und Elementwahl

Der Faktor auf den Schaden gegen einen Boss ergibt sich aus dem Element (×1,5, ×1,0, ×0,5) und der Mitigation (1 − Rüstung bei Physisch, 1 − Resistenz bei Elementar). Beispiele für Phase 1 und 2:

| Boss | Physische Waffe | Passendes Element (×1,5) | Neutrales Element | Falsches Element (×0,5) |
| --- | --- | --- | --- | --- |
| Ignarch | 0,70 | 1,20 | 0,80 | 0,40 |
| Glaciara | 0,65 | 1,20 | 0,80 | 0,40 |
| Voltrax | 0,80 | 1,05 | 0,70 | 0,35 |
| Gorthul | 0,41 | 1,28 | 0,85 | 0,43 |
| Solaris | 0,75 | 1,13 | 0,75 | 0,38 |
| Nyxhara | 0,75 | 1,01 | 0,68 | 0,34 |

Die Zahlen sind der Schadensfaktor gegenüber dem Rohschaden. Wer die richtige Waffe trägt, macht rund das 1,3- bis 3,1-Fache des Schadens einer physischen Waffe, wer die falsche trägt, rund das 0,4- bis 1,05-Fache. Das Referenzmodell (Abschnitt 13) rechnet mit dem Faktor 0,75 (25 % Mitigation, neutrales Element). Die richtige Waffenwahl ist deshalb ein Bonus gegenüber dem Referenzwert, die falsche ein Malus. Bei Gorthul ist eine physische Waffe deutlich schwächer als eine Elementwaffe (0,41). Bei Voltrax und Solaris liegt sie am nächsten am Referenzwert.

Weiterer Zusammenhang: Die Bosswaffen (8.5) tragen das Element ihres Bosses, die Zweitwaffe (Gegenelement) ist per Elementwechsel (8.4) für Gold erhältlich.

### 10.8 Beute

Beute ist persönlich (Abschnitt 12): Jeder berechtigte Spieler würfelt für sich. Berechtigt ist, wer den Boss im ersten Sieg oder nach abgelaufenem Timer besiegt (10.9).

|  | Erster Sieg | Wiederholung |
| --- | --- | --- |
| Bosswaffe (legendär, eigene Klasse, Boss-Element) | 100 % | 20 % |
| Gegenstand (Roll B) | 1 Stück | 1 Stück |
| Gem (7.5) | 1 | 50 % Chance auf 1 |
| Artefaktsplitter (7.6) | 6 | 3 |
| Artefakt-Freischaltung | ja, in den Kapiteln 1, 3, 5 (7.6) | nein |
| Gold und XP | Abschnitt 12 | Abschnitt 12 |

**Roll B (Gegenstand):**

- Item-Stufe: 5 × Kapitel + Beutestufe K (8.2).
- Slot: Rüstung 20 %, Nebenhand 15 %, Helm 15 %, Handschuhe 15 %, Umhang 15 %, Stiefel 15 %, Waffe (ohne Bossbindung) 5 %.
- Seltenheit: beim ersten Sieg Episch 85 %, Legendär 15 %. Bei Wiederholungen Selten 30 %, Episch 60 %, Legendär 10 %.
- Legendäre Gegenstände tragen ELE +1 % (8.3). Nur Bosswaffen haben einen festen Effekt.

Alle Wahrscheinlichkeiten sind Sollwerte und liegen in `content/loot/boss-drops.json` (Abschnitt 15).

Beim ersten Sieg erhält der Spieler zusätzlich die Beutestufe 0 und den Eintrag „Besiegt“ in der Bosstafel.

### 10.9 Respawn-Timer, Kampfstufe und Helfer

- Nach dem Sieg über einen Boss läuft für jeden berechtigten Helden ein **Timer**. Er läuft in Echtzeit, auch wenn der Spieler offline ist, und wird in der Bosstafel angezeigt.
- Erst nach Ablauf kann der Boss für diesen Helden erneut beute-berechtigt bekämpft werden. Der Timer gilt pro Held und Boss, nicht pro Party und nicht pro Konto. Wer mehrere Helden spielt, kann denselben Boss je Held einmal pro Zeitfenster um Beute bekämpfen. Das ist gewollt. Ein Spieler mit mehreren Helden hat für jeden Helden einen eigenen Timer.

| Boss | Timer |
| --- | --- |
| Ignarch (Kapitel 1) | 15 Minuten |
| Glaciara (Kapitel 2) | 25 Minuten |
| Voltrax (Kapitel 3) | 40 Minuten |
| Gorthul (Kapitel 4) | 60 Minuten |
| Solaris (Kapitel 5) | 90 Minuten |
| Nyxhara (Kapitel 6) | 120 Minuten |

Die Timer werden mit `BOSS_TIMER_SCALE` (2.8) multipliziert.

- **Beutestufe / Kampfstufe K:** Jede erfolgreiche Wiederholung erhöht K des Helden für diesen Boss um 1, höchstens auf 4. Der erste Sieg setzt K auf 0. Die **Kampfstufe eines Kampfes** ist das höchste K unter den beute-berechtigten Spielern der Party. Sie erhöht Boss-Leben und Boss-Schaden um 5 % je Stufe (10.3). Die Beute jedes Spielers nutzt sein eigenes K (8.2).
- **Helfer-Modus:** Ein Spieler, dessen Timer noch läuft, darf trotzdem am Kampf teilnehmen. Er zählt für n (10.3), erhält aber keine Beute, keine Splitter und keine XP, und sein Timer wird nicht neu gestartet. Der Bereit-Bildschirm zeigt das an.
- **Erster Sieg im Koop:** Hat ein Party-Mitglied den Boss noch nie besiegt, gilt der Kampf für dieses Mitglied als erster Sieg. Die Nachzügler-Regel (3.4) gilt weiter.
- Vor dem ersten Sieg gibt es keinen Timer. Der Kampf ist beliebig oft wiederholbar (nach Wipes, 10.1).

### 10.10 Daten

Bosse liegen in `content/bosses.json` (Leben B, Phasenelemente, Rüstung, Resistenz, Buff, Debuff, Signaturangriff, Timer, Bosswaffen-Effekt) und die Arenen in `content/arenas.json`. Die Feldnamen stehen in Abschnitt 15. Alle Zufallswürfe laufen über den Run-Zufallszähler (2.3).
