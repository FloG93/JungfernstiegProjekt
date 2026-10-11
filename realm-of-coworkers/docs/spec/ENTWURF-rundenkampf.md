# Entwurf: Rundenbasierter Kampf

**Status: Entwurf, noch nicht beschlossen.** Dieser Text ersetzt nach Zustimmung die Echtzeit-Teile der
Spezifikation: Abschnitt 6 (Kampf), 9.1 bis 9.5 (Ablauf einer Stage), Teile von 10 (Bosse), 11.4 bis 11.8
(Koop im Run), 13 (Balancing) und 14.3 bis 14.7 (Oberfläche im Run). Unberührt bleiben: Welt und Fortschritt (3),
Klassen (4), Werte und Formeln (5), Gems und Artefakte (7), Ausrüstung (8), Beute und Progression (12),
Datenmodell (15) außer den Positionsfeldern.

Entschieden sind (Rückfrage vom 11.10.): Der Echtzeitkampf wird **ersetzt**, im Koop **planen alle gleichzeitig**,
die Grafik nutzt die **vorhandenen Figuren** in neuer Anordnung.

## 1. Grundform

Ein Kampf läuft in **Runden**. In jeder Runde handelt jede lebende Figur genau einmal, in der Reihenfolge ihrer
Initiative. Es gibt keine Bewegung in Pixeln, keine Flächen am Boden und kein Ausweichen in Echtzeit.

**Eine Runde entspricht 3 Sekunden Spielzeit.** Diese Zahl ist nur der Umrechnungsschlüssel für die vorhandenen
Daten (Abklingzeiten, Statusdauern, Boss-Timer); im Spiel kommt sie nicht vor.

### 1.1 Reihen

Jede Seite hat eine **vordere** und eine **hintere Reihe** mit je bis zu 4 Plätzen.

- Helden werden beim Start nach Klasse verteilt: Krieger und Kleriker vorn, Magier, Waldläufer und Runenweber
  hinten, Schurke vorn. Der Spieler kann die Reihe wechseln (eine Aktion).
- Gegner werden von der Begegnung verteilt: Nahkämpfer vorn, Fernkämpfer und Unterstützer hinten.
- **Nahkampf trifft nur die vordere Reihe**, solange dort jemand lebt. Fernkampf und Zauber treffen frei.
- Ist eine vordere Reihe leer, rückt die hintere nach und gilt ab der nächsten Runde als vorn.

### 1.2 Initiative

Initiative = **TMP** (Tempo, 5.2) der Figur, absteigend. Bei Gleichstand entscheidet die Einheiten-Nummer, damit
der Ablauf bei gleichem Seed immer gleich ist. Die Reihenfolge wird zu Rundenbeginn einmal bestimmt und gilt für
die ganze Runde; Tempo-Änderungen wirken ab der nächsten Runde.

### 1.3 Aktionen

Jede Figur wählt genau **eine** Aktion:

| Aktion | Wirkung |
| --- | --- |
| Angriff | Basisfähigkeit der Klasse (Slot `auto`), keine Abklingzeit |
| Fähigkeit | Slot `s1`, `s2` oder `s3`, wenn die Abklingzeit abgelaufen ist |
| Ultimate | Slot `ult`, wenn die Energie voll ist (1.5) |
| Trank | heilt wie bisher (8.7), begrenzte Anzahl je Run |
| Verteidigen | erlittener Schaden bis zur eigenen nächsten Runde halbiert, +30 % Bedrohung |
| Reihe wechseln | vorn ↔ hinten, wirkt sofort |

### 1.4 Ablauf einer Runde

1. **Planen:** Alle Spieler wählen gleichzeitig ihre Aktion und ihr Ziel. Das Fenster dauert **20 Sekunden**
   (Einstellung, 10 bis 60). Wer nichts wählt, handelt nach den Auto-Cast-Regeln (4.6).
2. **Ansage:** Bosse geben an, was sie in der nächsten Runde tun (3.2).
3. **Abhandeln:** Alle Figuren handeln in Initiative-Reihenfolge. Gestorbene Figuren handeln nicht mehr.
4. **Rundenende:** Statuszeiten laufen um 1 Runde ab, Schaden über Zeit wirkt, Abklingzeiten sinken um 1,
   Energie wird gutgeschrieben.

Der Server rechnet die ganze Runde in einem Zug und schickt ein **Rundenprotokoll** (Liste von Ereignissen) an
alle. Der Client spielt dieses Protokoll als Animation ab. Es gibt keine Schnappschüsse mit 10 Hz mehr.

### 1.5 Energie und Ultimate

Die Ultimates haben in den Daten 55 bis 90 Sekunden Abklingzeit, das wären 19 bis 30 Runden und damit länger als
jeder Kampf. Stattdessen:

- Jede Figur hat **Energie von 0 bis 100**, zu Kampfbeginn 0 (gegen Bosse 30).
- **+12** je eigener Aktion, **+8** je erlittenem Treffer, **+15**, wenn ein Verbündeter fällt.
- Bei 100 ist die Ultimate wählbar und setzt die Energie auf 0.

Damit liegt die erste Ultimate etwa in Runde 6 bis 8, in Bosskämpfen zweimal.

## 2. Umrechnung der vorhandenen Daten

Die Inhaltsdateien in `packages/content/` bleiben die Quelle. Umgerechnet wird beim Laden, nach festen Regeln.

### 2.1 Zeiten

| Feld | Regel | Beispiele |
| --- | --- | --- |
| `cooldownS` | Runden = max(1, round(s / 3)) | 6 s → 2 · 8 s → 3 · 10 s → 3 · 12 s → 4 · 16 s → 5 · 20 s → 7 |
| `cooldownS` der Ultimate | entfällt, ersetzt durch Energie (1.5) | 55 bis 90 s → Energie 100 |
| Status- und Buff-`ms` | Runden = max(1, round(ms / 3000)) | 1500 → 1 · 4000 → 1 · 6000 → 2 · 8000 → 3 |
| Boss-Timer (Enrage) | Runden = round(s / 3) | 300 s → 100 Runden |

Abklingzeiten zählen in **eigenen Runden**: Eine Fähigkeit mit 3 Runden ist nach der dritten eigenen Handlung
wieder bereit.

### 2.2 Flächen und Ziele

`radiusPx` entfällt ersatzlos. Jede Fähigkeit bekommt ein **Zielbild**:

| Bisher | Künftig |
| --- | --- |
| `target: nearest` | ein Gegner, vom Spieler gewählt (Nahkampf: nur vordere Reihe) |
| `target: focus` | ein Gegner, vom Spieler gewählt |
| `target: lowestAlly` | der Verbündete mit dem geringsten Lebensanteil |
| `target: self` | die eigene Figur |
| `target: ground` | eine **gegnerische Reihe**, vom Spieler gewählt |
| `to: enemiesAroundSelf`, r = 300 | alle Gegner |
| `to: enemiesAroundSelf`, r = 120 | die vordere Gegnerreihe |
| `to: enemiesAroundTarget`, r = 220 | das Ziel und die übrigen Figuren seiner Reihe |
| `to: allies` / `lowestAllies` / `self` | unverändert |

Vollständige Liste der 24 betroffenen Fähigkeiten:

| Fähigkeit | Ziel künftig |
| --- | --- |
| krieger_spott | alle Gegner, Spott 1 Runde |
| krieger_schildstoss | ein Gegner (vordere Reihe) |
| krieger_wirbelhieb | vordere Gegnerreihe |
| krieger_bollwerk (ult) | ganze Party |
| magier_elementarkugel | ein Gegner |
| magier_elementarnova | ein Gegner und seine Reihe |
| magier_arkane_barriere | selbst |
| magier_kataklysmus (ult) | eine Gegnerreihe, wirkt am **Ende der nächsten Runde** (bisher `groundDelayed`) |
| waldlaeufer_gezielter_schuss | ein Gegner, trifft zusätzlich den dahinter stehenden (bisher `pierce`) |
| waldlaeufer_fallensteller | eine Gegnerreihe; die Falle löst aus, sobald dort jemand handelt |
| waldlaeufer_pfeilhagel | eine Gegnerreihe |
| waldlaeufer_adlerauge (ult) | selbst |
| schurke_meucheln | ein Gegner, Bonus gegen volle oder getroffene Ziele wie bisher |
| schurke_giftklinge | ein Gegner |
| schurke_schattenschritt | ein Gegner **der hinteren Reihe**; der Schurke wechselt dabei in die vordere Reihe der Gegner, das heißt er gilt bis zur nächsten eigenen Runde als ungeschützt |
| schurke_klingentanz (ult) | alle Gegner, über 2 Runden (bisher `channelSpin`) |
| kleriker_heilendes_licht | schwächster Verbündeter |
| kleriker_segensaura | schwächste Verbündete |
| kleriker_laeuterung | ganze Party, reinigt; Schaden an allen Gegnern |
| kleriker_wunder (ult) | ganze Party, belebt Gefallene |
| runenweber_rune_der_kraft | ganze Party |
| runenweber_runenbruch | ein Gegner |
| runenweber_rune_des_schutzes | ganze Party |
| runenweber_runensturm (ult) | ganze Party |

Die 6 Basisangriffe (`auto`) treffen ein Ziel, die 6 Passiven wirken wie bisher dauerhaft.

### 2.3 Was ersatzlos entfällt

Bewegung, Autowalk, Formationsanker, Leine, Angriffsplätze, Rollen und Ausweichen (E-023), Telegraphen als
Flächen am Boden, Gefahren mit Tickschaden am Boden, alle Felder in Pixeln.

## 3. Gegner und Bosse

### 3.1 Gegner

- Zielwahl wie bisher über **Bedrohung** (6.6): höchste Bedrohung, Wechsel erst über 110 %. Spott zwingt.
- Nahkämpfer greifen nur die vordere Heldenreihe an, Fernkämpfer und Bomber wählen frei, Unterstützer heilen.
- Die Begegnungs-Zusammenstellung (9.5 bis 9.7) bleibt: dasselbe Punktebudget, dieselben Typen, dieselben Elite-Regeln.
  Statt zeitlich gestaffelter Wellen erscheinen die Gegner einer Begegnung **auf einmal**, höchstens 8 (4 vorn, 4 hinten);
  überzählige rücken nach, sobald vorn ein Platz frei wird.

### 3.2 Bosse

Aus Telegraphen werden **Ansagen**:

- Der Boss kündigt am Ende einer Runde seinen nächsten großen Angriff an („Voltrax sammelt Blitzladung").
- In der folgenden Runde führt er ihn aus. Die Party hat genau eine Runde Zeit zu reagieren: verteidigen,
  schilden, heilen oder den Boss betäuben, sofern er nicht immun ist.
- Signaturangriffe, Phasen nach Lebensschwellen, Elementwechsel, Wutwechsel und Adds bleiben wie in 10 beschrieben.
- Enrage greift nach der umgerechneten Rundenzahl (2.1).

## 4. Koop

- **Gleichzeitiges Planen:** Alle Spieler wählen im selben Fenster. Niemand wartet auf einen anderen.
- Wer nicht wählt (Handy weggelegt, Meeting), handelt nach den Auto-Cast-Regeln. Das ist dieselbe Regel wie
  der bisherige Autopilot und hält das Versprechen „läuft auch nebenbei" (E-022).
- **Auto-Kampf** ist ein Schalter: Ist er an, wird die Aktion vorgewählt und die Runde startet sofort, sobald
  alle bereit sind. Ein Antippen übersteuert die Vorauswahl bis zum Rundenende.
- Alle sehen dasselbe Rundenprotokoll in derselben Reihenfolge. Wiedereinstieg, Helfer-Regel, Kampfstufe und
  Beuteverteilung (11.5, 11.6, 12.3) bleiben unverändert.
- Der Server bleibt autoritativ: Er prüft jede Wahl (Fähigkeit bereit? Ziel erlaubt?) und verwirft ungültige.

## 5. Oberfläche

Anordnung wie in der Vorlage, aber für das Handy gedacht:

- **Oben:** Initiativleiste mit den nächsten 8 Figuren, die aktive hervorgehoben.
- **Mitte:** Kampfbild. Party links, Gegner rechts, je zwei Reihen leicht versetzt. Antippen einer Figur wählt
  das Ziel, langes Drücken zeigt ihre Werte und Statuseffekte.
- **Unten:** Aktionsleiste mit Angriff, drei Fähigkeiten, Ultimate, Trank, Verteidigen, Reihe wechseln.
  Nicht wählbare Aktionen sind abgeblendet und nennen den Grund („noch 2 Runden").
- **Rechts oben:** Kampfprotokoll, einklappbar.
- **Dauerhaft:** Restzeit des Planungsfensters als Balken.
- Hoch- und Querformat wie bisher; im Hochformat liegt das Kampfbild oben, die Aktionsleiste darunter.

## 6. Balancing

Das Referenzmodell (13, Anhang A) rechnet künftig **je Runde** statt je Sekunde:

- Schaden pro Runde = Schaden einer Aktion. Die Klassenwirksamkeit K (13.10) wird zu „Schaden je Runde geteilt
  durch Referenzschaden".
- Zielwerte: normale Begegnung **4 bis 6 Runden**, Elite-Begegnung 6 bis 9, Boss **12 bis 18 Runden**.
  Eine Stage mit 6 Begegnungen dauert damit etwa 30 bis 40 Runden.
- Die Prüfungen aus 13.9 bleiben inhaltlich gleich, nur die Einheit wechselt.
- `pnpm balance` muss vollständig neu geschrieben werden; das Python-Referenzmodell `ref_model.py` gilt dann
  nicht mehr als Vergleich, weil es Echtzeit rechnet.

## 7. Offene Punkte für dich

Hier habe ich entschieden, ohne dich zu fragen. Sag Bescheid, wenn etwas anders soll:

1. **Runde = 3 Sekunden.** Damit werden aus 6-Sekunden-Fähigkeiten 2 Runden und aus 20-Sekunden-Fähigkeiten 7.
   Bei 2 Sekunden je Runde wären Fähigkeiten seltener, bei 4 Sekunden häufiger.
2. **Ultimate über Energie** statt Abklingzeit, Richtwert erste Ultimate in Runde 6 bis 8.
3. **Zwei Reihen** statt freier Aufstellung. Alternative wäre gar keine Position (jeder trifft jeden), dann
   verliert der Krieger aber seine Aufgabe.
4. **Planungsfenster 20 Sekunden.** Ohne Zeitlimit könnte ein Kollege den Kampf blockieren.
5. **Verteidigen** als eigene Aktion (halber Schaden). In der Vorlage gibt es das nicht, es macht aber die
   Boss-Ansagen erst interessant.
6. **Höchstens 8 Gegner gleichzeitig.** Auf dem Handy sind mehr nicht lesbar.

## 8. Was das Umbauen kostet

| Bereich | Umfang |
| --- | --- |
| Simulation (`packages/shared/src/sim`, 6 200 Zeilen) | wird ersetzt, geschätzt 2 500 bis 3 500 Zeilen neu |
| Server-Run (`apps/server/src/ws/run.ts`, 800 Zeilen) | Rundenprotokoll statt Schnappschüsse, etwa zur Hälfte neu |
| Client-Run (`apps/client/src/ui/run.tsx` und `game/`, 2 300 Zeilen) | wird ersetzt |
| Protokoll (`protocol.ts`, `snapshot.ts`) | Schnappschüsse entfallen, Rundenprotokoll kommt |
| `pnpm balance` und das Referenzmodell | neu |
| Tests | rund 40 der 66 Testdateien betreffen den Kampf und werden neu geschrieben |
| Inhaltsdateien | bleiben, bekommen die Umrechnung beim Laden |
| Konten, Party, Chat, Beute, Stufen, Lager, Server, Betrieb, Figuren | unverändert |

Reihenfolge der Umsetzung, je ein Schritt mit eigenen Tests:

1. Rundenkern ohne Oberfläche: Initiative, Aktionen, Reihen, Bedrohung, Status (ersetzt M2)
2. Gegner, Begegnungen, Stages (ersetzt M3)
3. Bosse mit Ansagen (ersetzt M4)
4. Server: Rundenprotokoll, gleichzeitiges Planen, Auto-Kampf (ersetzt Teile von M9)
5. Kampfbildschirm (ersetzt M7)
6. Balance neu, Abnahme im Browser
