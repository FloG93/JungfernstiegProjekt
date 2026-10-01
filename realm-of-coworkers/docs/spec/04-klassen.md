## 4 Charaktere und Klassen

Es gibt 6 Klassen mit je einem Automatikangriff, 3 Fähigkeiten, einem Ultimate und einem Passiv. Alle Werte hier sind Sollwerte und fließen in das Balance-Modell (Abschnitt 13) ein.

### 4.1 Heldenerstellung und Auswahl

- Auswahlbildschirm nach dem Login: bis zu 6 Karten (eine je Klasse), leere Slots zeigen „Neuen Helden erstellen“.
- Erstellung: **Name** (3 bis 16 Zeichen, Buchstaben, Ziffern, Leerzeichen, pro Account eindeutig), **Klasse**, **Aussehen** (4 Körperformen, 8 Porträts, 6 Farbpaletten für Haut, Haar und Akzentfarbe als Sprite-Färbung) mit Live-Vorschau.
- Pro Account ein Held je Klasse. Löschen verlangt die Eingabe des Heldennamens. Ausrüstung und Fortschritt des Helden gehen dabei verloren.
- Klasse und Name sind nachträglich nicht änderbar, Aussehen schon (im Lager, kostenlos).

### 4.2 Klassenübersicht

| Klasse | Rolle | Waffe | Nebenhand | Reichweite (px) | Leben-Faktor | Bedrohung |
| --- | --- | --- | --- | --- | --- | --- |
| Krieger | Tank, Nahkampf | Langschwert | Schild | 90 | 1,30 | 3,0 |
| Magier | Flächenschaden, Fernkampf | Zauberstab | Grimoire | 500 | 0,80 | 1,0 |
| Waldläufer | Einzelziel-Schaden, Fernkampf | Bogen | Köcher | 560 | 0,95 | 1,0 |
| Schurke | Nahkampf-Burst, Debuff-Nutzer | Dolche | Parierdolch | 90 | 0,90 | 1,0 |
| Kleriker | Heiler | Streitkolben | Heiliges Symbol | 320 | 1,05 | 0,6 |
| Runenweber | Unterstützer, Buffs | Runenstab | Runenbuch | 480 | 0,90 | 0,8 |

Bedrohung ist der Multiplikator auf verursachten Schaden, wenn Gegner ihr Ziel wählen (Abschnitt 6.6).

### 4.3 Freischaltung der Fähigkeiten

| Element | Frei ab Heldenstufe |
| --- | --- |
| Automatikangriff, Fähigkeit 1, Passiv | 1 |
| Fähigkeit 2 | 2 |
| Fähigkeit 3 | 3 |
| Ultimate | 5 |
| Ausweichrolle (alle Klassen) | 1 |

Das volle Kit steht ab Stufe 5. Das Balance-Modell gilt daher ab dem ersten Boss. In den Stages 1-1 bis 1-4 gilt ein Einführungsfaktor von 0,8 auf Gegner-Leben und Gegner-Schaden (Feintuning im Playtest).

### 4.4 Gemeinsame Regeln

- **Automatikangriff:** Intervall 1,0 Sekunde geteilt durch (1 + TMP ÷ 100). Trifft das nächste Ziel in Reichweite oder das Fokusziel.
- **Abklingzeit:** Angegebene Abklingzeit geteilt durch (1 + TMP ÷ 100). TMP steht überall in Prozentpunkten: TMP 20 ergibt den Faktor 1,2.
- **Auto-Cast:** Jede Fähigkeit hat einen Schalter. Standard: an für Fähigkeiten 1 bis 3, aus für Ultimate. Die Auslösebedingung jeder Fähigkeit ist eine feste Regel aus 15.5 (AutoCastRule), zum Beispiel Heilung, sobald ein Verbündeter unter 90 % Leben liegt.
- **Element:** Aller Schaden von Automatikangriff und Fähigkeiten hat das Element der ausgerüsteten Waffe. Heilung und Schilde sind elementlos.
- **Ausweichrolle:** Taste Leertaste, 160 px, 0,5 s unverwundbar, Abklingzeit 8 s (Waldläufer 7 s).
- **Wiederbeleben:** Ein Held bei 0 Leben ist *gefallen*. Jeder Verbündete kann ihn in 3 Sekunden Kanalisierung mit 30 % Leben wiederbeleben.
- **Heiltrank:** 4 Ladungen, je 35 % Max-Leben, Abklingzeit 15 s je Held. Die Ladungen füllen sich an jedem Checkpoint und vor jedem Boss auf.
- **Einzelkämpfer (nur Solo):** Kraft-Multiplikator Krieger 1,6, Kleriker 2,4, Runenweber 2,0, alle anderen 1,0. Er gleicht fehlende Gruppenrollen aus.

### 4.5 Krieger (Tank)

Passiv **Standhaft:** +15 % Rüstung, Bedrohung ×3,0.

| Fähigkeit | Stufe | Abklingzeit | Wirkung |
| --- | --- | --- | --- |
| Schwerthieb (Auto) | 1 | 1,0 s | 0,78 × Kraft |
| Spott | 1 | 10 s | Gegner im Radius 300 px greifen 4 s den Krieger an, 0,30 × Kraft Schaden, 30 % weniger erlittener Schaden für 4 s. Bosse: Bedrohung springt auf Maximum plus 10 % für 4 s |
| Schildstoß | 2 | 8 s | 1,60 × Kraft, Betäubung 1,5 s (Elite 0,75 s). Boss: immun, stattdessen −20 % Angriffstempo für 3 s |
| Wirbelhieb | 3 | 12 s | 1,20 × Kraft auf alle Gegner im Radius 120 px |
| Bollwerk (Ultimate) | 5 | 60 s | 6 s lang: alle Verbündeten erhalten ein Schild in Höhe von 15 % des Krieger-Max-Lebens, der Krieger erleidet 40 % weniger Schaden |

### 4.6 Magier (Flächenschaden)

Passiv **Elementarfluss:** Ein Waffenwechsel (Abschnitt 8.6) setzt die Abklingzeit von Elementarkugel zurück, höchstens alle 20 s.

| Fähigkeit | Stufe | Abklingzeit | Wirkung |
| --- | --- | --- | --- |
| Arkanblitz (Auto) | 1 | 1,0 s | 0,75 × Kraft |
| Elementarkugel | 1 | 6 s | 2,40 × Kraft auf das Ziel, 60 % davon auf Gegner im Radius 100 px |
| Elementarnova | 2 | 9 s | 2,60 × Kraft auf das Ziel und alle Gegner im Radius 220 px um das Ziel |
| Arkane Barriere | 3 | 15 s | Schild in Höhe von 20 % des eigenen Max-Lebens für 6 s, kein Schaden |
| Kataklysmus (Ultimate) | 5 | 60 s | Zielgebiet Radius 300 px wird markiert, nach 1,0 s 12,0 × Kraft Schaden auf alle Gegner darin |

### 4.7 Waldläufer (Einzelziel-Schaden)

Passiv **Fährtenleser:** +10 % Bewegungstempo, Abklingzeit der Ausweichrolle 7 s.

| Fähigkeit | Stufe | Abklingzeit | Wirkung |
| --- | --- | --- | --- |
| Pfeilschuss (Auto) | 1 | 1,0 s | 0,70 × Kraft |
| Gezielter Schuss | 1 | 6 s | 2,60 × Kraft, durchbohrt: trifft den ersten Gegner in gerader Linie dahinter mit 50 % |
| Fallensteller | 2 | 12 s | Falle (Radius 80 px, hält 15 s, höchstens 2 aktiv). Auslösung: 1,60 × Kraft und Wurzel 2 s (Elite 1 s, Boss: −30 % Bewegung 3 s) |
| Pfeilhagel | 3 | 12 s | 5 Pfeile à 0,70 × Kraft in 1,5 s in einen Zielkreis Radius 150 px. Ein Gegner kann alle 5 Pfeile abbekommen |
| Adlerauge (Ultimate) | 5 | 60 s | 10 s lang +30 % verursachter Schaden und +100 px Reichweite |

### 4.8 Schurke (Nahkampf-Burst)

Passiv **Blutdurst:** +10 Prozentpunkte Krit-Chance. Dieser Bonus ist im Balance-Modell als Schaden gezählt.

| Fähigkeit | Stufe | Abklingzeit | Wirkung |
| --- | --- | --- | --- |
| Doppelstich (Auto) | 1 | 1,0 s | 0,65 × Kraft |
| Meucheln | 1 | 8 s | 2,80 × Kraft, ×1,5 gegen Ziele mit Gift, Blutung, Verbrennung oder Schwächung |
| Giftklinge | 2 | 10 s | Gift 6 s: 0,35 × Kraft pro Sekunde, bis 3 Stapel. Ziel wird 30 % weniger geheilt |
| Schattenschritt | 3 | 9 s | Teleport hinter das Ziel, 1,00 × Kraft, 2 s Tarnung: nächster Angriff +25 % Schaden |
| Klingentanz (Ultimate) | 5 | 55 s | 1,5 s Wirbel, 6 Treffer à 0,90 × Kraft auf Ziel und Gegner im Radius 90 px, dabei unverwundbar |

### 4.9 Kleriker (Heiler)

Passiv **Gnade:** Überheilung wird zu einem Schild (höchstens 10 % Max-Leben des Ziels, 6 s).

| Fähigkeit | Stufe | Abklingzeit | Wirkung |
| --- | --- | --- | --- |
| Heiliger Schlag (Auto) | 1 | 1,0 s | 0,60 × Kraft |
| Heilendes Licht | 1 | 6 s | Heilt den Verbündeten mit dem niedrigsten Lebensanteil um 2,00 × Kraft |
| Segensaura | 2 | 14 s | 8 s lang Regeneration für die 3 Verbündeten mit dem niedrigsten Lebensanteil: 0,25 × Kraft pro Sekunde |
| Läuterung | 3 | 16 s | Entfernt von jedem Verbündeten 1 Debuff, heilt alle um 1,20 × Kraft, Gegner im Radius 300 px erleiden 0,80 × Kraft |
| Wunder (Ultimate) | 5 | 90 s | Heilt alle Verbündeten um 60 % Max-Leben und belebt Gefallene mit 30 % Leben wieder |

Heilung erzeugt bei allen Gegnern in Reichweite Bedrohung in Höhe von 0,5 × geheilte Menge.

### 4.10 Runenweber (Unterstützer)

Passiv **Resonanz:** Verbündete unter einem deiner Buffs erleiden 5 % weniger Schaden.

| Fähigkeit | Stufe | Abklingzeit | Wirkung |
| --- | --- | --- | --- |
| Runenstrahl (Auto) | 1 | 1,0 s | 0,73 × Kraft |
| Rune der Kraft | 1 | 16 s | 8 s lang alle Verbündeten (auch der Runenweber) +15 % Kraft |
| Runenbruch | 2 | 20 s | 8 s lang ignoriert das Ziel seine Elementarresistenz (Faktor 0,5 wird 1,0) und erleidet +10 % Schaden aus allen Quellen, dazu 1,00 × Kraft Schaden |
| Rune des Schutzes | 3 | 18 s | 8 s lang alle Verbündeten +20 % Rüstung und Resistenz |
| Runensturm (Ultimate) | 5 | 75 s | 12 s lang alle Verbündeten +25 % Tempo und +20 Prozentpunkte Krit-Chance |

Mehrere Runenweber in einer Party stapeln ihre Buffs nicht. Der stärkere Wert gilt, die Dauer wird erneuert.

Das Balance-Modell setzt die Gruppenwirkung von Rune der Kraft und Runensturm mit zusammen +12,8 % Team-Schaden an (Runenbruch nicht mitgezählt).
