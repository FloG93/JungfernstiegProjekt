## 11 Multiplayer, Lobby und Solo-Modus

Das Spiel kennt einen einzigen Ablauf für alle Gruppengrößen von 1 bis 6. Der Solo-Modus ist eine Party mit einem Spieler (2.3). Es gibt kein Matchmaking mit Fremden, nur Kollegen desselben Servers.

### 11.1 Anwesenheit und Online-Liste

- Nach dem Login sieht jeder Spieler im Lager die **Online-Liste** aller angemeldeten Spieler mit Heldenname, Klasse, Heldenstufe und Status (Im Lager, In Stage 3-2, Im Bosskampf, Abwesend).
- „Abwesend“ setzt der Server nach 10 Minuten ohne Eingabe im Lager. In einer laufenden Stage gibt es keinen Abwesend-Status (Auto-Cast hält den Helden im Kampf).
- Aus der Liste lässt sich ein Spieler direkt in die eigene Party **einladen**. Die Einladung erscheint beim Empfänger als Hinweis mit „Annehmen“ oder „Ablehnen“ und verfällt nach 60 Sekunden.

### 11.2 Party

- Eine Party hat 1 bis 6 Mitglieder. Jedes Mitglied bringt genau einen Helden mit. Gleiche Klassen dürfen mehrfach vorkommen.
- Beitritt per Einladung oder per **Party-Code** (6 Zeichen aus A bis Z ohne I und O sowie 2 bis 9, zum Beispiel K7M2XQ). Der Code lebt, solange die Party besteht.
- Der **Anführer** (Ersteller der Party) wählt die Stage, startet sie, schaltet den Autowalk um (9.2) und kann Mitglieder entfernen. Verlässt der Anführer die Party, wird das am längsten anwesende Mitglied Anführer.
- Die Party bleibt über Stages hinweg bestehen, bis sie aufgelöst wird oder alle Mitglieder gegangen sind.
- Ein Spieler ist immer in höchstens einer Party.
- **Stage-Wahl:** Der Anführer sieht alle Stages, die für mindestens ein Mitglied freigeschaltet sind. Ein Mitglied darf beitreten, wenn seine Heldenstufe mindestens der empfohlenen Stufe minus 3 entspricht (Nachzügler-Regel, 3.4). Andere Mitglieder sehen im Bereit-Bildschirm eine Warnung („Stage empfohlen ab Stufe 12“).

### 11.3 Bereit-Bildschirm und Start

1. Der Anführer wählt eine Stage. Die Party sieht Stage, Empfehlung, Kapitel-Element und für jedes Mitglied Heldenname, Klasse, Stufe, aktive Waffe und ihr Element.
2. Jedes Mitglied bestätigt „Bereit“. Waffe, Gems und Ausrüstung lassen sich bis zum Start ändern.
3. Startet der Anführer bei nicht bereiten Mitgliedern, erscheint eine Bestätigung. Nicht bereite Mitglieder nehmen trotzdem teil (mit Autopilot, 2.4), bis sie eingreifen.
4. Sind alle bereit, startet ein Countdown von 5 Sekunden.
5. Während der Stage tritt niemand neu ein (Ausnahme 11.5).

### 11.4 Verlauf einer Stage im Mehrspielermodus

- Der Anker (9.2) bewegt die Party gemeinsam. Alle Spieler sehen dieselbe Szene aus der Sicht des Ankers.
- Beute ist persönlich (Abschnitt 12). Jeder Spieler sieht nur seine eigenen Beutekugeln und Drops.
- Gold und XP erhält jeder Spieler vollständig für sich (Abschnitt 12).
- **Gruppenstärke n** ist die Zahl der verbundenen Spieler im Moment eines Spawns (9.6, 10.3).
- **Ping:** Mit der mittleren Maustaste setzt ein Spieler einen Ping (Hinweis, Achtung oder Hilfe, per Radialmenü). Der Ping erscheint 3 Sekunden bei allen.
- **Chat:** Die Party hat einen Textchat (höchstens 200 Zeichen, eine Nachricht pro Sekunde). Es gibt fünf Schnellnachrichten auf den Tasten 1 bis 5 mit gedrückter Alt-Taste (zum Beispiel „Achtung!“, „Danke!“).

### 11.5 Verbindungsverlust und Wiedereintritt

- Bei Verbindungsverlust gilt 2.4: 90 Sekunden Autopilot, dann Entfernung aus dem Run.
- Ein entfernter Spieler kann seiner Party nur an einem **Checkpoint** (9.1) oder am Bereit-Bildschirm eines Bosses wieder beitreten. Er startet mit vollem Leben an der Position der Party, n steigt entsprechend für neue Spawns.
- Verlassen ein Spieler die Party freiwillig, gilt dasselbe (Wiederbeitritt nur an Checkpoints).
- Beute, die vor der Entfernung gefallen ist, bleibt erhalten (2.5).

### 11.6 Solo-Modus

- „Solo starten“ öffnet dieselbe Stage-Wahl wie bei einer Party. Der Run enthält einen Spieler (n = 1).
- Der Einzelkämpfer-Multiplikator (4.4) gilt nur, wenn n = 1 ist. Tritt ein Mitspieler in die Party ein, bevor die Stage startet, entfällt er.
- Im Solo-Modus lässt sich der Run mit der Taste P **pausieren**. Der Server hält die Simulation an. Nach 10 Minuten Pause endet der Run. Im Mehrspielermodus gibt es keine Pause.
- Spielstand und Timer sind bei Solo und Koop gleich.

### 11.7 Synchronisation

Der Server ist die einzige Autorität (2.6). Der Client zeigt an und schickt Absichten.

- **Takt:** 20 Ticks pro Sekunde (2.3). Der Server sendet jeden zweiten Tick einen Delta-Snapshot (10 Hz), Ereignisse sofort.
- **Snapshot:** Tick-Nummer, geänderte Einheiten (Position als ganze Pixel, Leben, Ausrichtung, Aktionszustand, Effektliste), Projektile und Flächen, Abklingzeiten nur für den eigenen Helden. Alle 5 Sekunden und beim Beitritt kommt ein vollständiger Snapshot.
- **Größe:** Höchstens 8 KB je Snapshot. Ziel: unter 30 KB/s je Client bei 6 Helden und 40 Einheiten (komprimiert mit permessage-deflate).
- **Eingaben:** höchstens 20 pro Sekunde, mit fortlaufender Nummer: Bewegungsvektor, Fähigkeit, Ziel, Ausweichen, Waffenwechsel, Trank, Auto-Cast-Schalter, Fokusziel (2.3).
- **Eigener Held:** Der Client sagt seine Bewegung vorher und gleicht sie mit den Serverwerten ab (Abweichung über 24 px: Korrektur in 100 ms). Kampfaktionen werden nicht vorhergesagt, sondern nach der Serverbestätigung gezeigt. Die Animation startet sofort, die Wirkung folgt mit der Bestätigung.
- **Andere Einheiten:** Interpolation mit 100 ms Puffer (2.3). Fehlt ein Snapshot, wird bis zu 250 ms extrapoliert.
- **Latenz:** Ausgelegt für bis zu 150 ms Rundlaufzeit ohne Einschränkung, bis 400 ms spielbar (Fähigkeiten reagieren verzögert). Ab 800 ms zeigt der Client „Verbindung schlecht“.
- **Reihenfolge eines Ticks:** 1. Eingaben anwenden, 2. Gegner-KI und Bosse, 3. Bewegung, 4. Spawns, 5. Auto-Cast und Fähigkeiten, 6. Treffer und Schaden, 7. Effekte (Schaden und Heilung über Zeit, Ablauf), 8. Tod, Beute, Phase, 9. Snapshot.
- **Zufall:** `mulberry32` mit Seed pro Run (2.3). Der Seed ist im Ereignisprotokoll gespeichert, damit sich Kämpfe nachrechnen lassen.

### 11.8 Fairness bei ungleicher Stärke

- Die Gegnerstärke richtet sich nach n, nicht nach den Heldenstufen der Mitglieder. Ein schwächerer Held profitiert von der Gruppe, sein Beitrag ist kleiner.
- Die Nachzügler-Regel (3.4) lässt zu starke Stage-Sprünge zu, verlangt aber höchstens 3 Stufen Unterschied zur Empfehlung.
- Bosse skalieren nach n und der Kampfstufe (10.3, 10.9). Ein Helfer (Timer aktiv) zählt für n, erhält aber keine Beute (10.9).

### 11.9 Schutz vor Missbrauch

- Jede Nachricht wird gegen das Zod-Schema geprüft (2.1). Ungültige Nachrichten werden verworfen und geloggt.
- Rate-Limits: 30 Nachrichten pro Sekunde je Client (2.3), 1 Chat-Nachricht pro Sekunde, 1 Party-Code-Versuch pro Sekunde.
- Der Server prüft Besitz, Slot-Regeln, Abklingzeiten, Reichweiten und Ressourcen (2.6). Zeitangaben des Clients werden nie verwendet.
- Chat-Nachrichten werden als reiner Text angezeigt (kein HTML), Länge geprüft.
- Mehrere gleichzeitige Verbindungen eines Accounts sind nicht erlaubt: Die neue Verbindung ersetzt die alte, und der Held wird übernommen (Wiedereintritt in den Run innerhalb von 90 Sekunden).

### 11.10 Kapazität und Betrieb

- Mindestens 10 gleichzeitige Runs (2.7). Bei 30 Spielern insgesamt bleibt der Server unter 60 % eines Kerns.
- Sind mehr als 10 Runs aktiv, werden weitere Starts mit dem Hinweis „Server ausgelastet“ abgelehnt, laufende Runs sind nicht betroffen.
- Ein Run endet, wenn (a) die Stage abgeschlossen ist und die Party das Lager wählt, (b) alle Spieler gegangen sind (5 Minuten Karenz, 2.4), (c) die Solo-Pause 10 Minuten überschreitet oder (d) der Server neu startet (2.5).
