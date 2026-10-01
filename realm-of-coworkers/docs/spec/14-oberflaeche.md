## 14 Oberfläche, Grafik, Audio und Bedienung

Das Spiel läuft im Desktop-Browser bei mindestens 1280 × 720 Pixel. Die Spielszene rendert Phaser im Canvas, alle Menüs, Leisten und Tooltips sind HTML mit Preact darüber (2.1). Tablet ist optional, Touch-Steuerung gehört nicht zum Umfang.

### 14.1 Bildschirme und Ablauf

| Bildschirm | Inhalt | Wechsel zu |
| --- | --- | --- |
| Anmeldung | Benutzername, Passwort, Einladungscode (nur Registrierung) | Heldenauswahl |
| Heldenauswahl | bis zu 6 Karten, Erstellung (4.1) | Lager |
| Lager | 5 Stationen (3.3), Online-Liste (11.1), Party-Leiste, Chat | Station, Stage-Wahl |
| Stage-Wahl | Kapitelkarte mit 30 Stages, Empfehlung, Bereit-Bildschirm (11.3) | Stage |
| Stage | Spielszene mit HUD (14.3) | Beute-Bildschirm |
| Bosskampf | Arena mit Boss-HUD (14.4) | Beute-Bildschirm |
| Beute-Bildschirm | Truhe, Vergleich, XP-Leiste, Weiter oder Lager | Stage, Lager |
| Ausrüstung | Puppe mit 7 Slots, Inventar (80), Gems, Artefakte, Werte | Lager |
| Einstellungen | Ton, Grafik, Steuerung, Barrierefreiheit | zurück |

Alle Stationen des Lagers sind Overlay-Fenster. Die Hintergrundszene (Laterne, Lagerfeuer) bleibt sichtbar. Escape schließt das oberste Fenster.

### 14.2 Stationen im Detail

- **Schmiede (Torbek):** Reiter Waffensätze A und B, Element wechseln (8.4), Waffenstufe übertragen (8.4), Verzaubern (8.7) mit den 3 Zeilen, Kosten und Vorschau vor der Bestätigung.
- **Juwelier (Ysolde):** links die 9 Gem-Slots (gesperrte mit Freischaltstufe), rechts der Gem-Beutel mit Filter nach Art und Stufe. Schaltflächen Kombinieren (zeigt Gold) und Tauschen (7.4). Ziehen und Ablegen oder Doppelklick.
- **Archiv (Nerith):** 3 Artefakt-Slots mit Rang, Effekttext, Splitter-Anzeige und Aufwerten. Darunter die Chronik mit allen gelesenen Story-Texten.
- **Bosstafel:** 6 Zeilen mit Boss, Status (offen, besiegt), Timer (10.9), Kampfstufe, Schwächen der Phasen und der Schaltfläche „Kämpfen“ (nur für den Anführer).
- **Tavernentisch (Marla):** Party bilden, Code anzeigen, Einladungen, Stage-Wahl, Tränke auffüllen.

### 14.3 Stage-HUD

- **Oben links:** Party-Leiste mit einem Rahmen je Held (Name, Klasse-Icon, Lebensbalken mit Schildabschnitt, Effekt-Icons bis 8). Der eigene Held steht oben. Gefallene sind grau mit Wiederbelebungs-Kreis.
- **Oben Mitte:** Stage-Leiste mit den 6 Begegnungen und 2 Checkpoints als Markierungen und dem Anker als Pfeil. Daneben die Stage-Nummer und die Zeit.
- **Unten Mitte:** Fähigkeitsleiste mit Automatikangriff, Fähigkeit 1 bis 3, Ultimate, Trank (Ladungen), Ausweichrolle, Waffensatz A und B (aktiver hervorgehoben, Sperrzeit als Kreisbogen). Jedes Symbol zeigt Taste, Abklingzeit und einen kleinen Schalter für Auto-Cast (Rechtsklick).
- **Unten links:** Chat (einklappbar) und Schnellnachrichten.
- **Unten rechts:** eigene Werte in Kurzform (Leben, Kraft, Tempo) und Goldzähler.
- **In der Szene:** schwebende Zahlen (Weiß Physisch, Elementfarbe Elementarschaden, Grün Heilung, größer und gelb bei Krit), Namensschilder, Telegraphen (14.6), Bedrohungsanzeige (Kronen-Symbol am Gegner mit der höchsten Bedrohung des eigenen Helden).
- **Ping-Menü:** mittlere Maustaste, Radialmenü mit Hinweis, Achtung, Hilfe (11.4).

### 14.4 Boss-HUD

- **Boss-Leiste** oben Mitte, breit. Sie zeigt Name, Lebensbalken mit **Phasenmarken bei 66 % und 33 %**, das Schild (heller Abschnitt) und den Timer bis zum Enrage bei 480 s.
- **Phasen-Element (10.5):** links neben dem Namen ein großes Element-Symbol in der Farbe der Phase. Der Rahmen der Leiste und ein Leuchtsaum um den Boss haben dieselbe Farbe. Rechts daneben das Symbol der aktuellen **Schwäche** mit einem Pfeil nach unten und der Beschriftung „Schwach gegen“.
- **Phasenübergang:** Die Anzeige blendet 5 Sekunden lang ein Fenster „Phase 2: Eis“ ein. Das Symbol der nächsten Schwäche pulsiert. Ist die eigene aktive Waffe nicht die passende Element-Waffe, blinkt das Waffenwechsel-Symbol.
- **Bosstexte:** Große Angriffe zeigen ihren Namen über dem Boss („Flammenwelle“).
- **Buffs und Debuffs** des Bosses (Glutmantel, Eispanzer und so weiter) erscheinen als Symbole unter der Leiste mit Tooltip (10.6).
- **Wutwechsel:** Wird ein Held zum Ziel, erscheint über ihm ein roter Pfeil und sein Rahmen in der Party-Leiste blinkt.

### 14.5 Ausrüstung, Tooltips und Vergleich

**Gegenstands-Tooltip** (Hover auf Inventar, Beute, Ausrüstung):

1. Name in der Farbe der Seltenheit, darunter Slot, Klasse, Item-Stufe und Anforderung. Nicht erfüllte Anforderungen in Rot.
2. Budget in Punkten und die sechs Werte mit Zahlen. ELE und (bei Waffen) Element-Symbol, Waffenstufe mit XP-Balken und Bonus, Verzauberungen mit Rang, fester Effekt bei Bosswaffen.
3. Verkaufspreis.

**Vergleich (8.9):** Beim Hover auf einen Gegenstand erscheint der angelegte Gegenstand des Slots daneben. Unter jedem Wert steht die **Differenz** (grüner Pfeil nach oben, roter nach unten, Zahl und Prozent). Ganz unten steht die **Differenz der Budgetpunkte** und ein Vermerk „Empfohlen“, wenn das Budget um mindestens 5 % höher ist. Bei Waffen wird zusätzlich das Element gegenüber dem aktuellen Boss oder Kapitel bewertet (Hinweis „Schwach gegen dieses Kapitel-Element“). Die Umschalttaste zeigt den Vergleich mit dem Nebenslot der Waffe (Satz B).

**Gem-Tooltip:** Art, Stufe, Wert, Hinweis „3 kombinieren ergibt Stufe …“ mit Kosten. **Artefakt-Tooltip:** Name, Rang, Punkte, Effekttext, Splitter für den nächsten Rang.

**Beute-Bildschirm:** Die Truhe öffnet sich mit einer Animation. Neue Gegenstände liegen als Karten nebeneinander mit der Vergleichs-Differenz. Ein Klick legt an, Rechtsklick verkauft. Zusätzlich gibt es „Alles empfohlene anlegen“.

### 14.6 Telegraphen und Barrierefreiheit

Telegraphen (6.7) sind Flächen am Boden mit 1,5 Sekunden Anzeige.

| Modus | Darstellung |
| --- | --- |
| Standard | rote Füllung (35 % Deckkraft), roter Rand 3 px, füllt sich innen mit dem Zeitverlauf |
| Kontur (Barrierefreiheit) | keine Füllung, breiter Rand (5 px) in Schwarz und Weiß gestrichelt, dazu ein Warnsymbol in der Mitte und ein Kreisbogen für den Zeitverlauf |
| Blau | blaue statt rote Füllung |

Weitere Maßnahmen:

- **Farbsehschwäche-Paletten** (Protanopie/Deuteranopie und Tritanopie) tauschen Rot, Grün und Blau der Oberfläche gegen kontrastreiche Töne. Elemente werden zusätzlich immer durch ein **Symbol** unterschieden (Flamme, Kristall, Blitz, Fels, Sonne, Mond), nie nur durch Farbe. Ebenso werden Seltenheiten durch einen Rahmenstil markiert (Gewöhnlich schlicht, Ungewöhnlich Punkt, Selten Doppellinie, Episch Ecken, Legendär Glanz).
- **Warnton:** Jede große Anzeige spielt einen kurzen Ton. Auf Wunsch zusätzlich eine Bildschirmrand-Anzeige.
- **Schriftgröße** einstellbar (100, 125, 150 %), HUD-Größe 80 bis 130 %.
- **Weniger Bewegung:** schaltet Bildschirmwackeln, Blitzen und Partikeldichte ab.
- **Auto-Cast** und Autowalk erlauben das Spielen mit wenigen Eingaben (1.2).
- **Tastenbelegung** ist frei änderbar.
- Alle Schalter sind auch mit der Tastatur bedienbar. Bilder tragen Texte für Bildschirmleser, wo es sinnvoll ist (Menüs).

### 14.7 Steuerung

| Aktion | Standardtaste |
| --- | --- |
| Bewegen | W, A, S, D oder Pfeiltasten, Klick auf den Boden |
| Ausweichrolle | Leertaste |
| Fähigkeit 1, 2, 3 | 1, 2, 3 |
| Ultimate | R |
| Heiltrank | F |
| Waffensatz wechseln | Q |
| Nächstes Ziel fokussieren | Tab |
| Ziel per Klick fokussieren | Linksklick auf Gegner |
| Auto-Cast einer Fähigkeit umschalten | Rechtsklick auf das Symbol |
| Autowalk ein und aus (Anführer) | T |
| Pause (nur Solo) | P |
| Ping | mittlere Maustaste |
| Chat öffnen | Eingabetaste |
| Schnellnachricht 1 bis 5 | Alt + 1 bis 5 |
| Ausrüstung, Bosstafel | I, B |
| Menü | Escape |

### 14.8 Grafik

- **Stil:** 2D, Pixel-Art mit 64 × 64 Pixel Figuren, 3/4-Ansicht von der Seite, Hintergrund in 3 Parallax-Ebenen je Kapitel. Kamera fest, Höhe 540 logische Pixel, Skalierung ganzzahlig.
- **Helden:** 4 Körperformen, Farbpaletten per Sprite-Einfärbung (4.1), pro Klasse Waffen-Overlay. Animationen: Stehen 4 Bilder, Laufen 6, Angriff 4, Fähigkeit 6, Ausweichen 4, Treffer 2, Fallen 4.
- **Gegner:** 9 Typen (9.3) als Farbvarianten je Kapitel, Elite mit Rahmen und Affix-Symbol, 6 Bosse mit eigenem Sprite (128 × 128 bis 192 × 192).
- **Effekte:** Partikel für Treffer, Zauber und Telegraphen, höchstens 300 gleichzeitig. Objekt-Pools für Zahlen und Projektile.
- **Farben der Elemente:** Feuer #E8552B, Eis #6EC6F0, Blitz #F2D030, Erde #8B5E34, Licht #F7E39B, Schatten #7B4FBF. Seltenheiten: Grau #9AA0A6, Grün #4CAF50, Blau #3F8CFF, Violett #A55CE6, Orange #FF9F1A.
- **Atlanten:** PNG-Atlanten mit JSON-Beschreibung (Phaser), zusammen höchstens 2 MB. Bis zur Fertigstellung der Grafik dienen einfarbige Platzhalter-Figuren mit Klassen-Symbol (Abschnitt 16).
- **Ladezeit:** Erstes Laden unter 3 MB ohne Audio (2.7). Kapitel-Hintergründe werden erst beim Betreten geladen.

### 14.9 Audio

- **Musik:** je 1 Schleife pro Lager, Kapitel und Boss (8 Stücke), Ogg Vorbis, 90 bis 120 Sekunden, Streaming. Boss-Musik wechselt bei Phase 3 in eine dichtere Variante (Ebene per Überblendung).
- **Effekte:** Ogg oder WAV kurz. Mindestens: Treffer je Schadensart, Krit, Heilung, Telegraph-Warnton, Ausweichrolle, Wiederbelebung, Trank, Levelaufstieg, Beute, Legendär, Bossphase, Sieg, UI-Klicks.
- Audio startet nach der ersten Eingabe (Browser-Regel). Regler für Musik, Effekte und Oberfläche (0 bis 100), Stumm-Schalter.
- Höchstens 24 gleichzeitige Effekte, gleiche Töne werden gedrosselt (höchstens 4 pro Sekunde).
- Gesamtgröße der Audiodateien höchstens 25 MB.

### 14.10 Texte, Fehler und Testbarkeit

- Alle sichtbaren Texte liegen in `content/i18n/de.json` (1.4). Zahlenformat deutsch (Punkt als Tausendertrenner, Komma für Dezimalstellen).
- **Verbindung:** Bei Ausfall zeigt der Client ein Fenster „Verbindung verloren, Wiederverbinden in x s“, mit dem Countdown der 90 Sekunden aus 2.4.
- **Fehlermeldungen** nennen Ursache und nächsten Schritt („Server ausgelastet, bitte später erneut versuchen“, 11.10).
- Wichtige Bedienelemente tragen `data-testid` für Playwright (Anmelden, Held wählen, Party erstellen, Bereit, Stage starten, Beute-Bildschirm).
