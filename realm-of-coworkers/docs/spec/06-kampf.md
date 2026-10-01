## 6 Elemente, Statuseffekte und Kampfsystem

Kämpfe laufen in Echtzeit. Elemente, Buffs und Debuffs machen Waffenwahl und Zusammenspiel entscheidend. Alle Regeln hier gelten für Gegner und Bosse gleichermaßen.

### 6.1 Elemente

Es gibt 6 Elemente und **Physisch** (Waffe ohne Element). Die Elemente stehen in drei Gegenpaaren:

| Element | Farbe | Gegenelement (Schwäche) |
| --- | --- | --- |
| Feuer | Rotorange | Eis |
| Eis | Hellblau | Feuer |
| Blitz | Gelb | Erde |
| Erde | Braun | Blitz |
| Licht | Weißgold | Schatten |
| Schatten | Violett | Licht |

Regel: Ein Ziel mit Element X erleidet ×1,5 von seinem Gegenelement und ×0,5 von X selbst. Alle anderen Elemente und Physisch machen ×1,0. Ziele ohne Element sind neutral. Bosse wechseln ihr Element pro Phase (Abschnitt 10).

### 6.2 Rüstung und Resistenz der Gegner

Jeder Gegnertyp hat eine Rüstungs-Mitigation (gegen Physisch) und eine Resistenz-Mitigation (gegen Elementar), siehe Abschnitt 9.3. Physisch-Waffen sind also gegen Gegner mit schwacher Rüstung stark, Element-Waffen gegen Gegner mit schwacher Resistenz.

### 6.3 Statuseffekte

**Debuffs**

| Effekt | Wirkung | Dauer | Max. Stapel |
| --- | --- | --- | --- |
| Verbrennung | Feuerschaden über Zeit, Tick 1 s. Quelle Held: 0,25 × Kraft pro Sekunde. Quelle Gegner: 1,0 % RefLeben pro Sekunde | 5 s | 3 |
| Frost | −20 % Angriffstempo, −30 % Bewegung. Bei 3 Stapeln: eingefroren 1,5 s (Boss: stattdessen −40 % Tempo 3 s) | 5 s | 3 |
| Schock | Abklingzeiten laufen 25 % langsamer | 6 s | 1 |
| Rüstungsbruch | −15 % Rüstung und Resistenz je Stapel | 6 s | 3 |
| Blendung | Verursachter Schaden −20 % | 5 s | 1 |
| Verderbnis | Erlittener Schaden +10 % je Stapel | 6 s | 3 |
| Gift | Schaden über Zeit. Quelle Held: 0,35 × Kraft pro Sekunde. Quelle Gegner: 0,8 % RefLeben pro Sekunde. Erhaltene Heilung −30 % | 6 s | 3 |
| Blutung | Physischer Schaden über Zeit. Quelle Held: 0,30 × Kraft pro Sekunde. Quelle Gegner: 0,8 % RefLeben pro Sekunde | 5 s | 3 |
| Betäubung | Keine Aktionen | 1,5 s | 1 |
| Wurzel | Keine Bewegung | 2 s | 1 |
| Furcht | Fähigkeiten gesperrt (nur Bosse setzen sie) | 2 s | 1 |

**Buffs**

| Effekt | Wirkung |
| --- | --- |
| Schild | Absorbiert Schaden, läuft ab (Dauer je Quelle) |
| Regeneration | Heilung über Zeit, Tick 1 s |
| Raserei | +25 % verursachter Schaden (Boss-Phase, Enrage) |
| Kraftrune, Schutzrune, Runenrausch, Adlerauge, Tarnung, Bollwerk | Siehe Fähigkeiten (Abschnitt 4) |
| Unverwundbar | Kein Schaden (Ausweichrolle 0,5 s, Klingentanz, Phasenübergang) |

**Schwächung** ist ein Sammelbegriff für Frost, Schock, Rüstungsbruch, Blendung, Verderbnis und Runenbruch. Der Schurke prüft ihn bei „Meucheln“.

### 6.4 Regeln für Stapel, Dauer und Reinigung

- Wirkt derselbe Effekt erneut, steigt die Stapelzahl (bis zum Maximum) und die Dauer wird auf den längeren Wert erneuert.
- Buffs derselben Art stapeln nicht. Der stärkere Wert gilt, die Dauer wird erneuert.
- Schaden über Zeit hat kein Element (Faktor 1,0): Verbrennung und Gift werden durch Resistenz gemindert, Blutung durch Rüstung. Eingefroren wird wie Betäubung behandelt: Reinigung direkt nach Betäubung, halbe Dauer bei Elite-Gegnern, Bosse sind immun. Ein Ziel trägt höchstens 8 verschiedene Effekte. Bei Überlauf wird der älteste Debuff ersetzt.
- **Läuterung** und andere Reinigungen entfernen Effekte in dieser Reihenfolge: Betäubung, Wurzel, Furcht, Verderbnis, Rüstungsbruch, Blendung, Frost, Schock, Gift, Blutung, Verbrennung.
- **Immunitäten:** Bosse sind immun gegen Betäubung, Wurzel, Furcht und Einfrieren und werden von Verlangsamungen höchstens um 40 % gebremst. Elite-Gegner erleiden die halbe Dauer von Betäubung und Wurzel.

### 6.5 Bewegung und Formation

- Bewegungstempo Held: 220 px/s manuell, 90 px/s im Autowalk. Gegner: Standard 100 px/s, schnell 160 px/s.
- Das Spielfeld ist ein Tiefenband von 240 px Höhe. Figuren dürfen sich überlappen, werden aber leicht auseinandergeschoben.
- **Formation:** Ohne Eingabe halten Helden ihre Position relativ zur Vorhut: Krieger 0 px, Schurke −40, Kleriker −120, Runenweber −220, Magier −280, Waldläufer −300 (mehrere Helden derselben Klasse versetzt um 40 px in der Tiefe). Nach 3 Sekunden ohne Eingabe kehrt ein manuell bewegter Held in die Formation zurück.
- Steuerung manuell mit W, A, S, D oder Pfeiltasten und per Klick auf den Boden.

### 6.6 Bedrohung und Zielwahl

- Jeder Gegner führt für jeden Helden eine **Bedrohung**: verursachter Schaden × Bedrohungsfaktor der Klasse (Abschnitt 4.2) plus 0,5 × geheilte Menge für Heiler-Aktionen. Sie steigt nur, sinkt nie und wird bei Kampfende zurückgesetzt.
- Ein Gegner greift den Helden mit der höchsten Bedrohung in Reichweite an. Er wechselt nur, wenn ein anderer Held mehr als 110 % dieses Werts erreicht.
- **Spott** überschreibt die Zielwahl für die angegebene Dauer.
- **Wutwechsel (nur Bosse):** Alle 15 Sekunden greift der Boss 4 Sekunden lang einen zufälligen lebenden Helden an, außer ein aktiver Spott hält ihn fest.
- Fernkämpfer und Kultisten unter den Gegnern wählen ihr Ziel zufällig unter den Helden in Reichweite.

### 6.7 Telegraphen

Große Gegnerangriffe werden 1,5 Sekunden vorher am Boden angezeigt (Kreis, Linie oder Kegel in Rot). Der Schaden entsteht am Ende der Anzeige. Wer die Fläche verlassen hat oder mit der Ausweichrolle unverwundbar ist, erleidet ihn nicht. Zusätzlich gibt es ein kurzes Warngeräusch. Auf Wunsch ersetzt eine Umrandung die Farbe (Barrierefreiheit, Abschnitt 14).

### 6.8 Tod, Wiederbeleben, Scheitern

- Gefallene Helden bleiben liegen und können wiederbelebt werden (Abschnitt 4.4). Der Kleriker-Ultimate belebt alle.
- **Gruppenwipe** (alle gefallen) oder Solo-Tod: Neustart ab dem letzten Checkpoint, Tränke voll. Bosskämpfe starten mit vollen Boss-Lebenspunkten neu. Begegnungen vor dem Checkpoint bleiben besiegt, alle dahinter starten mit neu gewürfelten Gegnern. Jede Begegnung zahlt je Run höchstens ihren vollen Topf aus (12.3): Nach einem Wipe gibt es beim erneuten Besiegen nur noch die Differenz. Elite-Beute gibt es je Begegnung und Run höchstens einmal.
- Es gibt keinen Verlust von Items, Gold oder XP durch Scheitern.
- **Phasenübergang** bei Bossen: 5 Sekunden Unverwundbarkeit des Bosses, alle Helden werden um 25 % Max-Leben geheilt und Gefallene mit 50 % Leben wiederbelebt.
