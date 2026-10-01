## 3 Handlung und Spielwelt

Die Welt **Aethra** wurde vom Aeon-Kristall zusammengehalten. Vor 300 Jahren zerbarst er in sechs Splitter, je einer pro Element. Eine Verderbnis namens **Die Stille** nimmt seither Farbe, Klang und Leben aus dem Land und hat die sechs Splitterhüter verdorben. Die Spieler sind **Splitterträger**: Helden aus sechs Berufen, die sich im Lager *Zur letzten Laterne* treffen, um die Hüter zu besiegen und den Kristall neu zu fügen.

### 3.1 Die sechs Kapitel

| Kap. | Region | Element | Stages | Boss | Kurzhandlung |
| --- | --- | --- | --- | --- | --- |
| 1 | Die Aschenwälder | Feuer | 1–5 | Ignarch, der Glutkönig | Der Grenzwald brennt. Die Helden finden den ersten Splitter und erfahren, dass die Hüter einst selbst Splitterträger waren. |
| 2 | Die Frostmoore | Eis | 6–10 | Glaciara, die Frostwitwe | Ein Dorf ist in Eis erstarrt. Die Helden folgen den Spuren einer Frau, die den Schmerz ihres Verlusts einfrieren wollte. |
| 3 | Die Sturmklippen | Blitz | 11–15 | Voltrax, der Sturmtyrann | Ein Leuchtturmorden lädt die Klippen mit Energie auf. Voltrax will nie wieder überrascht werden. |
| 4 | Die Tiefenwurzeln | Erde | 16–20 | Gorthul, der Steinwächter | Unter den Bergen erwacht ein Wächter, der jede Veränderung für eine Bedrohung hält. |
| 5 | Die Sonnenruinen | Licht | 21–25 | Solaris, der gefallene Seraph | Ein Tempel aus Licht blendet alle, die ihn betreten. Solaris duldet keinen Zweifel. |
| 6 | Der Schattenthron | Schatten | 26–30 | Nyxhara, die Stille | Die Quelle der Stille. Nyxhara war die erste Splitterträgerin und wollte Trauer für immer beenden. |

Am Ende von Kapitel 6 setzen die Helden die sechs Splitter zusammen und der Kristall heilt das Land. Nach dem Abspann bleiben alle Bosse als Wiederholungskämpfe (Abschnitt 10) verfügbar.

### 3.2 Erzählweise

- Vor jeder Stage ein Text von 2 bis 3 Sätzen (überspringbar mit Leertaste).
- Vor und nach jedem Boss ein Dialog von 4 bis 6 Zeilen mit dem Boss.
- Alle Texte liegen als JSON in `content/story/kapitelN.json` mit Zeilen der Form `{ "speaker": "Nyxhara", "text": "..." }`.
- Tonfall: ernst mit trockenem Humor, keine Bezüge auf reale Personen oder Firmen.

Beispiel für den Bossdialog Kapitel 1:

> Ignarch: Ihr bringt Wasser in mein Reich? Wie rührend. Erzähler: Der Boden glüht, und der Splitter in seiner Brust pulsiert im Takt seines Zorns.

### 3.3 Das Lager als Hub

Das Lager ist ein Menü-Bildschirm mit fünf Stationen (kein Herumlaufen nötig):

| Station | Figur | Funktion |
| --- | --- | --- |
| Tavernentisch | Wirtin Marla | Party bilden, Einladungscode, Stage wählen, Heiltränke auffüllen |
| Schmiede | Torbek | Waffen: Waffenstufe, Elementwechsel, Verzaubern |
| Juwelier | Ysolde | Gems einsetzen, herausnehmen, kombinieren |
| Archiv | Nerith | Artefakte ausrüsten und aufwerten, Chronik der Geschichte |
| Bosstafel | – | Alle Bosse mit Status, Timer und Kampfstufe |

### 3.4 Freischalten und Fortschritt

- Fortschritt gilt pro Held. Eine Stage s ist frei, wenn s = 1 ist oder der Held Stage s − 1 abgeschlossen hat (Eintrag in stage\_progress, 15.1). Lücken sind erlaubt: Wer über die Nachzügler-Regel Stage 8 abschließt, hat Stage 9 frei, Stage 6 aber weiterhin erst nach eigenem Abschluss von Stage 5.
- **Nachzügler-Regel:** Ein Held darf im Koop jede Stage betreten, deren empfohlene Stufe höchstens 3 über seiner Heldenstufe liegt, wenn mindestens ein Party-Mitglied die Stage freigeschaltet hat. Der Abschluss zählt für jeden Teilnehmer als eigener Abschluss, dadurch wird auch die Folge-Stage frei.
- Alle Stages und Bosse sind wiederholbar (Bosse mit Timer, Abschnitt 10).
