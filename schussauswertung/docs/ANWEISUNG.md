# Anweisung für Claude Code: „Schussauswertung Live" (PWA für 25 m Pistole)

> Diese Datei ist die vollständige Arbeitsanweisung. Lies sie **komplett und in Ruhe**, bevor du irgendetwas tust. Lege danach im Projektwurzelverzeichnis eine `CLAUDE.md` an, die die Abschnitte 1, 2, 3, 15 und 16 knapp zusammenfasst, damit der Kontext in jeder späteren Sitzung verfügbar ist.

---

## 0. Wie du arbeiten sollst (bitte zuerst lesen)

1. **Starte im Plan-Modus.** Schreibe zuerst einen konkreten Umsetzungsplan (Dateistruktur, Bibliotheken, Reihenfolge), lege ihn dem Nutzer vor und beginne erst nach seiner Freigabe mit dem Code.
2. **Arbeite meilensteinweise** (Abschnitt 13). Schließe jeden Meilenstein vollständig ab (Code, Tests, Doku), bevor du den nächsten beginnst. Berichte nach jedem Meilenstein kurz: was funktioniert, was nachweislich getestet wurde, was *nicht* getestet werden konnte.
3. **Nichts raten, nichts behaupten ohne Nachweis.** Sage niemals „funktioniert", wenn du es nicht ausgeführt hast. Trenne in deinen Berichten strikt: *durch automatische Tests belegt* / *nur durch Code-Lesen geprüft* / *nur am echten Schießstand mit echter Optik prüfbar*.
4. **Bei echter Unklarheit frag den Nutzer**, statt still eine Annahme zu treffen. Bei kleinen Details entscheide selbst, dokumentiere die Entscheidung aber in `docs/ENTSCHEIDUNGEN.md` (eine Zeile pro Entscheidung: Datum, Entscheidung, Grund).
5. **Keine Platzhalter, keine Attrappen.** Keine `TODO`-Funktionen, die so tun, als wären sie fertig. Was nicht gebaut wird, steht ausdrücklich in `docs/OFFEN.md`.
6. **Sprache:** Bezeichner, Kommentare und Commit-Nachrichten auf Englisch. Alles, was der Nutzer sieht oder hört (Oberfläche, Sprachausgabe, Dokumentation für den Nutzer), auf **Deutsch**.
7. **Kleine, nachvollziehbare Commits** (git initialisieren, falls noch nicht geschehen). Nach jedem Meilenstein ein Tag (`m1`, `m2`, …).
8. **Der Nutzer ist kein reiner Entwickler, sondern Maker/Sportschütze.** Erkläre im Bericht in normalem Deutsch, ohne Fachjargon-Wände. Befehle, die er ausführen soll, stehen kopierfertig in Codeblöcken.

---

## 1. Ziel des Produkts

Eine **Web-App (PWA)**, die auf einem Android-Handy läuft, das **dauerhaft fest an einem Spektiv befestigt** ist und die Scheibe live filmt. Die App:

- erkennt automatisch die Zielscheibe und kalibriert Pixel → Millimeter,
- erkennt **jeden neuen Treffer live** aus dem Kamerastream,
- ermittelt Position, Abweichung vom Scheibenmittelpunkt (in mm und Richtung) und Ringzahl,
- analysiert bei mehreren Treffern die **Gruppe** (Gruppenmittelpunkt = systematischer Versatz, Streukreis, Trend/Drift),
- gibt alles zuerst als **Text** aus und zusätzlich per **Sprachausgabe (TTS)**, damit der Schütze nebenher nicht aufs Display schauen muss.

**Wichtigste Design-Prämisse:** Der Schütze soll sich aufs Schießen konzentrieren. Nach der einmaligen Einrichtung muss die App **ohne Bedienung** laufen.

## 2. Harte Rahmenbedingungen (nicht verhandelbar)

| Thema | Vorgabe |
|---|---|
| Plattform | **Web-App / PWA**, Ziel: aktueller Chrome auf Android. **Keine APK, kein Capacitor, keine native App.** |
| Rechner am Stand | **Gibt es nicht.** Alles läuft komplett auf dem Handy. Kein Server-Backend, keine Cloud-KI, keine Bild-Uploads. |
| Internet am Stand | **Nicht voraussetzen.** Nach dem ersten Laden muss die App vollständig offline funktionieren (Service Worker, alle Assets inkl. WASM lokal ausgeliefert). |
| Eingabe | **Ausschließlich der Live-Kamerastream.** Kein Foto-Upload, kein Foto-Modus in der Bedienoberfläche. |
| Disziplin (Prototyp) | **25 m Pistole**, generische Standard-Hauptscheibe (Präzision). Weitere Scheiben später als reiner Konfigurationsdatensatz. |
| Sprache der App | Deutsch. |
| Datenschutz | Alles bleibt lokal auf dem Gerät. Keine Telemetrie, keine Tracker, keine externen Requests nach dem Laden. |

**Klarstellung zum Testen:** „Kein Foto-Modus" gilt für die **Nutzeroberfläche**. Für Entwicklung und automatisierte Tests ist es ausdrücklich erlaubt und gewünscht, die Pipeline mit synthetischen Bildern, aufgezeichneten Videos und einer Fake-Kamera zu füttern (Abschnitt 12). Diese Werkzeuge sind nicht Teil der normalen Bedienung.

## 3. Bekannte offene Punkte (früh beim Nutzer erfragen, aber nicht blockieren)

Diese Angaben fehlen noch. Frage sie im Plan-Modus ab. Bis zur Antwort baue alles **konfigurierbar** mit den genannten Standardwerten:

1. **Handy-Modell** (Android bestätigt? Modell, Kamera-Fähigkeiten). Standard: Android, Chrome.
2. **Kaliber** (.22 lr = 5,6 mm, 9 mm Para = 9,0 mm, .45 = 11,5 mm …). Standard: **5,6 mm**, als Einstellung wählbar.
3. **Exakte Scheibe** (Präzision 25 m; Hersteller/Maße). Standard: Geometrie aus Abschnitt 5.2, **muss vom Nutzer gegen die reale Scheibe geprüft werden**.
4. **Ansageumfang:** kurz (nur Ringzahl) oder ausführlich (Ring + Abweichung + Richtung). Standard: ausführlich, umschaltbar.
5. **Serienlänge** (Standard 5 Schuss = eine Präzisionsserie), automatisch oder per Tippen beenden.
6. **Hosting:** Wo wird die App erreichbar gemacht (HTTPS ist für die Kamera zwingend)? Vorschlag: GitHub Pages oder Cloudflare Pages, Auslieferung per CI. Nutzer entscheiden lassen.
7. **Spektiv/Adapter:** Okularadapter-Modell, ungefähre Vergrößerung, Kameraposition zur Scheibe (Winkel).

## 4. Technik-Stack (Vorschlag, im Plan begründen oder begründet abweichen)

- **TypeScript** (strict), **Vite**, ohne schweres UI-Framework. Vanilla-TS mit kleinen Modulen oder Preact. Begründe die Wahl im Plan; die Oberfläche ist bewusst klein.
- **OpenCV.js** (WebAssembly) für Bildverarbeitung. Version **pinnen**, selbst hosten (nicht von einem CDN laden), Größe und Ladezeit dokumentieren. Prüfe zuerst (Spike, siehe M0), ob ein reduzierter OpenCV-Build oder eigene Implementierung einzelner Algorithmen sinnvoller ist. Verstecke die CV-Bibliothek hinter einer **eigenen schmalen Schnittstelle**, damit sie austauschbar bleibt.
- **Web Worker** für die gesamte Bildverarbeitung, damit Oberfläche und Sprachausgabe nie blockieren. Frames per `ImageBitmap`/`OffscreenCanvas` oder `VideoFrame` (falls verfügbar) an den Worker geben, mit Fallback.
- **Web Speech API** (`speechSynthesis`) für TTS, Sprache `de-DE`.
- **Screen Wake Lock API**, damit das Display anbleibt (mit Fallback-Hinweis, falls nicht verfügbar).
- **getUserMedia** mit `applyConstraints` und `getCapabilities()` zur Kamerasteuerung (Fokus, Belichtung, Weißabgleich, Zoom, wo unterstützt).
- **Speicherung:** Einstellungen und Sitzungen in `IndexedDB` oder `localStorage`. Alles lokal.
- **Tests:** Vitest (Unit), **Playwright mit Chromium** (Ende-zu-Ende, inklusive Fake-Kamera und Offline-Test). Linting: ESLint + Prettier. `tsc --noEmit` muss sauber sein.
- **PWA:** Web-App-Manifest, Icons, Service Worker (Precache aller Assets inkl. WASM), sinnvolle Update-Strategie (neue Version erst beim nächsten Start aktivieren, nie mitten in einer Serie).

**Hinweis für Entwicklung auf dem Handy:** `getUserMedia` benötigt HTTPS (außer `localhost`). Richte einen Weg ein, die App während der Entwicklung auf dem echten Handy zu testen (z. B. `@vitejs/plugin-basic-ssl` im Heimnetz oder eine automatisch deployte Preview-URL) und beschreibe ihn dem Nutzer Schritt für Schritt.

## 5. Zielscheibe und Geometrie

### 5.1 Grundprinzip
Die Scheibengeometrie ist **reine Konfiguration** (JSON), kein hartcodierter Wert. Der Code darf nirgends „25", „50" oder „100 mm" als Magic Number enthalten.

```jsonc
// Beispielhaftes Schema (Namen dürfen angepasst werden)
{
  "id": "pistol-25m-precision",
  "name": "Pistole 25 m Präzision (Standard)",
  "unit": "mm",
  "ringOuterRadiiMm": { "10": 25, "9": 50, "8": 75, "7": 100, "6": 125, "5": 150, "4": 175, "3": 200, "2": 225, "1": 250 },
  "innerTenRadiusMm": 12.5,
  "blackBullRadiusMm": 100,          // Spiegel (schwarzer Bereich)
  "outerRadiusMm": 250,
  "scoringRule": "edge-touch",       // Treffer zählt für den höchsten Ring, den der Lochrand berührt
  "referenceContrast": "dark-bull-on-light-paper"
}
```

### 5.2 Startwerte (Achtung: zu verifizieren)
Die Werte oben entsprechen der gängigen Pistolenscheibe (Ring 10 = Ø 50 mm, jeder weitere Ring +50 mm im Durchmesser, Innenzehn Ø 25 mm, Spiegel Ø 200 mm, Gesamt Ø 500 mm). Sie stammen aus dem Gedächtnis des Planers und **müssen** gegen das aktuelle Regelwerk (DSB-Sportordnung / ISSF-Regeln) und gegen die **real ausgemessene Scheibe** des Nutzers geprüft werden. Bitte den Nutzer, Ø des 10er-Rings und des Spiegels mit dem Lineal zu messen und zu bestätigen. Die **Schnellfeuer-/Duellscheibe** hat eine andere Geometrie und wird nur über einen weiteren Konfigurationsdatensatz ergänzt, sobald der Nutzer die Maße liefert (nicht raten).

### 5.3 Wertung (Ringzahl)
Wertung nach Lochrand: Ein Schuss zählt für den höchsten Ring, den sein Lochrand berührt.

```
r_bullet = caliber_mm / 2
d        = Abstand Lochmitte → Scheibenmitte (mm)
excess   = d - r_bullet - R10            // R10 = äußerer Radius des 10er-Rings
ring     = excess <= 0 ? 10 : 10 - ceil(excess / ringWidthMm)   // ringWidthMm = 25
ring     = clamp(ring, 0, 10)             // 0 = Fehlschuss/außerhalb
```

Kontrollbeispiele (müssen als Unit-Tests existieren, Kaliber 5,6 mm, R10 = 25, Ringbreite 25):

| d (mm) | d − r (mm) | erwartete Ringzahl |
|---|---|---|
| 22,0 | 19,2 | 10 |
| 30,0 | 27,2 | 9 |
| 52,9 | 50,1 | 8 |
| 0,0 | −2,8 | 10 |

Implementiere die Wertung **allgemein** über die Liste der Ringradien (nicht über die Formel oben, die nur für gleichmäßige Ringbreite gilt), und teste beide Wege gegeneinander. Innenzehn („X") als Zusatzinformation, dezimale Wertung optional und nur wenn der Nutzer sie will.

## 6. Bedienkonzept (so einfach wie möglich)

1. Nutzer öffnet die PWA (Startbildschirm-Icon), das Handy hängt am Spektiv, die Scheibe ist im Bild.
2. **Ein Tipp auf „Scheibe erfassen".** Die App findet Scheibe und Ringe selbst und blendet eine Überlagerung (Ringe + Mitte) über das Livebild.
3. Passt die Überlagerung nicht, kann der Nutzer sie korrigieren (Abschnitt 7.3). Sonst ein Tipp auf „Passt", danach ist die Kalibrierung eingefroren.
4. **Ab jetzt keine Bedienung mehr nötig.** Jeder neue Treffer wird erkannt, im Bild markiert, als Text angezeigt und per Sprache angesagt.
5. Nach Serienende (automatisch nach N Schuss oder per großem Knopf „Serie beenden") folgt die **Gruppenansage**.
6. **Scheibenwechsel** erkennt die App selbst und fragt einmalig, ob neu gestartet werden soll (Abschnitt 9.6).

**Bedienelemente (bewusst minimal):**
- Großer Status (z. B. „Bereit", „Suche Scheibe", „Erkannt", „Ruhe abwarten …").
- Livebild mit Ringüberlagerung und nummerierten Treffermarkern.
- Große Textzeile mit der letzten Ansage; darunter Trefferliste der Serie.
- Ein großer Knopf „Letzten Treffer löschen" (für Fehlerkennungen), ein Knopf „Serie beenden", ein Knopf „Neue Scheibe".
- Einstellungsseite: Kaliber, Scheibentyp, Ansageumfang, Stimme/Tempo, Serienlänge, Stummschalten, Klickwert (optional, Abschnitt 10.4).
- Ausrichtung: Hoch- und Querformat, große Touch-Ziele (mindestens 48 px), hoher Kontrast, dunkles Design (Handy am Stand, oft Blendung). Kein Scrollen im Hauptbildschirm.
- Verstecktes **Debug-Menü** (langer Druck auf den Titel), siehe Abschnitt 11.

## 7. Kamera und Kalibrierung

### 7.1 Kamera starten und stabilisieren
- `getUserMedia` mit Rückkamera, gewünschter Auflösung (Ziel 1920×1080 oder höher, sofern das Gerät es kann und die Bildrate noch reicht), Bildrate 15–30 fps.
- Lies `track.getCapabilities()` und `track.getSettings()` aus und speichere sie im Debug-Log.
- **Wo unterstützt, sperren:** Fokus (`focusMode: "manual"` bzw. Fokusdistanz), Belichtung (`exposureMode: "manual"` oder Belichtungskorrektur festhalten), Weißabgleich (`whiteBalanceMode: "manual"`), Zoom (auf Nutzerwert). Nach dem Einfrieren prüfen, ob die Einstellungen tatsächlich übernommen wurden (`getSettings()`), und **sichtbar im Debug-Menü** anzeigen, was gesperrt werden konnte und was nicht.
- Wenn Sperren nicht möglich sind: **nicht abstürzen**, sondern in der Software kompensieren (Abschnitt 9.3) und dem Nutzer einen kurzen Hinweis geben („Belichtung lässt sich in diesem Browser nicht sperren – Erkennung ist eingeschränkt stabil").
- Frag Fähigkeiten geräteunabhängig ab; baue keine feste Annahme über ein Handymodell ein.

### 7.2 Automatische Scheibenerkennung
Ziel: Transformation **Bild → Scheibenebene (mm)**, mit einem **Konfidenzwert**.

Vorgehen (Empfehlung, du darfst begründet verbessern):
1. Verkleinertes Graubild, Glättung, adaptive Schwelle/Otsu. Finde den **schwarzen Spiegel** als große, annähernd elliptische dunkle Fläche (Konturen, `fitEllipse`, Flächen-/Rundheitsfilter).
2. Verifiziere über **radiale Intensitätsprofile** ausgehend vom Mittelpunktskandidaten: An den aus der Scheibenkonfiguration bekannten Radien müssen Hell/Dunkel-Übergänge (Spiegelrand, Ringlinien im hellen Bereich) auftreten. Aus der Übereinstimmung entsteht der Konfidenzwert.
3. **Transformation:** Bei 25 m mit Tele-Optik ist die Perspektive nahezu affin. Bilde die gefundene Ellipse auf einen Kreis ab (affine Abbildung). Wähle die Abbildung so, dass **keine zusätzliche Drehung** entsteht (symmetrisch-positive Wurzel der Ellipsenmatrix), damit „oben im Bild" = „oben auf der Scheibe" bleibt. Falls das Handy merklich gerollt ist, bietet die manuelle Korrektur eine Drehung an.
4. Optionale Verfeinerung: Rendere ein Scheibenmodell aus der Konfiguration und richte es per ECC oder Optimierung am Bild aus (Mitte, Maßstab, Scherung fein justieren). Nur einbauen, wenn es in den synthetischen Tests messbar hilft.
5. Ausgabe: 3×3-Matrix (bzw. 2×3 affin), Mittelpunkt in Bildkoordinaten, **Auflösung in px/mm**, Konfidenz, Diagnosebild für das Debug-Menü.

**Auflösungs-Check (wichtig, immer anzeigen):** Berechne die Lochgröße in Pixeln (`caliber_mm * px_per_mm`). Bewertung als Ampel im UI:
- ≥ 10 px Lochdurchmesser: gut
- 5–10 px: grenzwertig, Hinweis „Mehr Zoom oder näher ran empfohlen"
- < 5 px: „Auflösung zu gering für sichere Trefferkennung"
Die Grenzen sind konfigurierbar. Rechne außerdem eine **Positionsunsicherheit in mm** (Größenordnung 0,3 px ÷ px/mm) und zeige sie im Debug-Menü.

### 7.3 Manuelle Korrektur (Fallback, auch bei niedriger Konfidenz)
Wenn die Erkennung unsicher ist oder der Nutzer korrigieren will: Überlagerung per Finger verschieben (Mitte), per Zweifingergeste skalieren, und mit zwei Reglern/Griffen Seitenverhältnis und Drehung feinjustieren. Die Überlagerung zeigt die Ringe des Scheibenmodells; der Nutzer richtet sie an den echten Ringen aus. Dieselbe Transformationsdarstellung wie bei der automatischen Erkennung verwenden.

### 7.4 Nachführung (Drift des Bildes)
Auch bei festem Handy verschiebt sich das Bild minimal (Rückstoß, Erschütterung am Nachbarstand, Spektiv-Nachgeben). Verfolge die Scheibe kontinuierlich:
- Halte Referenzmerkmale (Ringstruktur/Scheibenrand/Spiegelkontur, **nicht** die Löcher) fest und schätze pro Bild eine kleine Restverschiebung (Phasenkorrelation oder ECC im Scheibenbereich).
- Korrigiere die Transformation entsprechend, sofern die Verschiebung klein ist (z. B. < 2 mm Scheibenebene). Ist sie größer oder der Registrierungsfehler hoch, gilt das als **Störung** (Abschnitt 9.5), und es wird nichts gewertet, bis sich das Bild beruhigt hat.

## 8. Datenmodell

```ts
type TargetConfig = { /* Abschnitt 5.1 */ };

type Settings = {
  caliberMm: number;              // Standard 5.6
  targetId: string;               // Standard "pistol-25m-precision"
  verbosity: "short" | "detailed";
  voice: { lang: "de-DE"; voiceURI?: string; rate: number; muted: boolean };
  seriesLength: number;           // Standard 5, 0 = manuell beenden
  autoEndSeries: boolean;
  clickValueMmPerClick?: number;  // optional, für Korrekturhinweise
  minHolePxWarn: number;          // Standard 10
  minHolePxError: number;         // Standard 5
};

type Shot = {
  id: number;                     // laufend je Serie
  tMs: number;                    // Zeitstempel
  xMm: number; yMm: number;       // relativ zur Scheibenmitte, x nach rechts, y NACH OBEN (Achtung Vorzeichen, testen!)
  dMm: number;                    // Abstand zur Mitte
  angleDeg: number;               // 0° = rechts, 90° = oben
  ring: number; innerTen: boolean;
  holeAreaPx: number;
  confidence: number;             // 0..1
  flags: string[];                // z. B. "possible-overlap", "low-resolution", "manual"
};

type Series = { id: string; startedAt: number; targetId: string; caliberMm: number; shots: Shot[]; stats?: GroupStats };

type GroupStats = {
  n: number;
  meanXMm: number; meanYMm: number;        // Gruppenmittelpunkt = systematischer Versatz
  meanOffsetMm: number; meanOffsetAngleDeg: number;
  extremeSpreadMm: number;                  // größter Abstand zweier Trefferzentren
  groupDiameterMm: number;                  // extremeSpread + caliber (Außenkante-zu-Außenkante), beides ausgeben
  meanRadiusMm: number;                     // mittlerer Abstand zum Gruppenmittelpunkt
  sdXMm: number; sdYMm: number;
  trend?: { slopeXMmPerShot: number; slopeYMmPerShot: number; significant: boolean };
  centered: boolean;                        // Versatz statistisch nicht von 0 unterscheidbar?
};
```

**Koordinatenkonvention:** x nach rechts positiv, y nach oben positiv (Scheibenblick), Bildkoordinaten (y nach unten) beim Umrechnen **eindeutig** trennen. Schreibe dafür Unit-Tests mit Spiegeltests (Punkt links unten muss „links unten" ergeben).

## 9. Schusserkennung (Kern der App)

### 9.1 Grundprinzip
**Differenzbild:** Ein neues Loch ist eine Veränderung, die im Referenzbild noch nicht vorhanden war. Vergleiche im **entzerrten Scheibenbereich** (nicht im Rohbild), damit Größe und Kalibergröße direkt in mm gefiltert werden können.

### 9.2 Referenzbild
- Beim Einfrieren der Kalibrierung: Referenz = robuste Mittelung/Median mehrerer ruhiger Bilder (Rauschreduktion).
- Nach jedem bestätigten Treffer: Referenz **aktualisieren** (das neue Loch wird Teil der Referenz), aber erst, wenn der Treffer stabil bestätigt ist.
- Langsame Lichtänderungen (Wolken, Hallenlicht) über langsam nachgeführte Referenz oder Normalisierung abfangen, ohne dass echte Löcher „wegadaptiert" werden.

### 9.3 Helligkeitsnormalisierung
Vor der Differenzbildung Referenz und aktuelles Bild robust auf gleiche Helligkeit bringen (Gain/Offset per robuster Regression, z. B. auf den unveränderten Bildanteilen; oder lokale Normalisierung). Berücksichtige:
- Auto-Belichtung des Handys, die nicht sperrbar ist,
- **Flackern** von Leuchtstoff-/LED-Licht (50 Hz-Streifen im Video),
- unterschiedliche Kontrastpolarität: Ein Loch im **hellen** Papier ist meist dunkler, im **schwarzen** Spiegel je nach Kugelfang/Hintergrund heller oder kaum verändert. Nimm daher den **Betrag** der Differenz, nimm keine feste Polarität an, und protokolliere die beobachtete Polarität pro Treffer im Debug-Log.

### 9.4 Kandidatenbildung und Filter
1. Adaptive Schwelle aus dem gemessenen Rauschen (z. B. Median + k · MAD), nicht ein fester Wert.
2. Morphologie (Öffnen/Schließen), Zusammenhangskomponenten.
3. **Größenfilter aus dem Kaliber:** erwartete Lochfläche ≈ π · (caliber/2)² in mm², Toleranzband (Papierrisse vergrößern das Loch, z. B. Faktor 0,5–3,0). Alles andere (Staub, Schatten, Fingerspitzen, Papierwellen) verwerfen.
4. Formfilter (Rundheit/Kompaktheit), Ort im Scheibenbereich.
5. **Zeitliche Stabilität:** Ein Kandidat zählt erst, wenn er in K aufeinanderfolgenden Verarbeitungsschritten (Standard K = 3 bei ca. 8 fps, konfigurierbar) an praktisch derselben Stelle (< 0,5 mm Bewegung) sichtbar ist **und** die Szene ruhig war.
6. **Positionsbestimmung:** Subpixel-Schwerpunkt der Änderungsfläche bzw. Anpassung eines Kreises/einer Ellipse an den Lochrand. Ausgabe in mm relativ zur Scheibenmitte.

### 9.5 Störungserkennung („Ruhe abwarten")
Erkenne globale Bildänderungen und werte in dieser Zeit **nichts**:
- Anteil geänderter Pixel im Scheibenbereich über Schwellwert,
- Registrierungsverschiebung/-fehler über Schwellwert,
- plötzlicher Helligkeitssprung.
Reaktion: Status „Ruhe abwarten …", Erkennung pausieren, nach Beruhigung (z. B. 0,5–1,0 s stabile Bilder, konfigurierbar) Referenz neu bewerten und **erst dann** weiter auf Treffer prüfen. Typische Auslöser: Schussrückstoß/Erschütterung, Person im Bild, Hand am Spektiv, Kamerawackeln, Scheibenwechsel.

**Wichtig:** Ein Schuss verursacht selbst kurz eine Erschütterung des Handys. Die Erkennung muss zuverlässig **nach** der Erschütterung das neue Loch finden (Verzögerung Schuss → Ansage soll unter etwa 2–3 s liegen, messen und dokumentieren).

### 9.6 Scheibenwechsel
Erkenne „andere Scheibe": Referenz und Scheibenstruktur passen nicht mehr (großer, anhaltender Unterschied, Löcher verschwunden, Ringfindung liefert neue Konfiguration). Dann **einmal** fragen („Neue Scheibe erkannt – Serie beenden und neu starten?"), nicht automatisch weiterzählen. Serie sauber abschließen, Statistik anbieten.

### 9.7 Überlappende Löcher
Enge Gruppen: Ein neuer Schuss kann in oder an einem bestehenden Loch landen.
- Prüfe bei Änderungen, die ein bestehendes Loch **berühren**, ob die vereinigte Fläche wächst (neuer Schuss) oder nicht.
- Bestimme die Position des neuen Anteils aus der **Zusatzfläche** (Vereinigung minus altes Loch).
- Setze das Flag `possible-overlap` und senke die Konfidenz. Sprich in der Ansage vorsichtig: „möglicherweise überlappend".
- Perfekt lösbar ist das nicht. Dokumentiere die Grenzen ehrlich in `docs/GRENZEN.md`.

### 9.8 Fehlerkorrektur durch den Nutzer
„Letzten Treffer löschen" entfernt ihn aus Liste und Statistik **und** setzt die Referenz zurück, sodass ein echtes Loch nicht doppelt gezählt wird. (Optional, niedrige Priorität: „Treffer manuell setzen" per Tipp auf das Bild für übersehene Schüsse, mit Flag `manual`.)

## 10. Auswertung und Ausgabe

### 10.1 Pro Treffer
- Ringzahl (Abschnitt 5.3), Abstand zur Mitte in mm, Richtung.
- **Richtung in Worten:** rechts / links / oben / unten und Kombinationen („links unten", „rechts oben"). Bei Abstand < 1 mm: „genau in der Mitte". Schwellen für „nur oben/unten" statt Diagonale festlegen (z. B. wenn eine Achse weniger als 30 % der anderen ausmacht) und im Code dokumentieren.
- Zahlen im Deutschen mit **Komma** und sprechbar formatiert (z. B. „vierzehn Komma fünf Millimeter", bei kurzer Ansage auf ganze mm runden). Teste die Ausgabetexte als reine Funktion (Text rein/raus), ohne TTS.

Beispiele Ansagetext (detailliert):
- „Neun. Vierzehn Millimeter links unten."
- „Zehn. Genau in der Mitte."
- Kurz: „Neun."

### 10.2 Pro Serie/Gruppe (nach Serienende)
Ansage z. B.: „Serie beendet. Fünf Schuss, achtundvierzig Ringe. Die Gruppe liegt neun Millimeter zu tief und drei Millimeter links. Streukreis vierundvierzig Millimeter." Bei n = 1 keine Gruppenaussage, bei n = 2 nur Abstand und Versatz, ab n = 3 zusätzlich Streuung und Trendaussage.

### 10.3 Systematik statistisch sauber
- **Gruppenmittelpunkt** relativ zur Mitte = systematischer Versatz.
- **Extremes Streumaß** (größter Abstand zweier Zentren) und **mittlerer Radius** ausgeben.
- **Ist der Versatz echt oder Zufall?** Ab n ≥ 3: Wenn der Versatz kleiner ist als die typische Streuung des Mittelwerts (z. B. SD/√n), dann sage „Gruppe liegt im Rahmen mittig" statt einer Korrekturempfehlung. Verwende eine einfache, dokumentierte Regel und teste sie mit Gegenbeispielen. Keine falsche Präzision suggerieren.
- **Trend/Drift:** lineare Regression von x und y über die Schussnummer ab n ≥ 4. Nur als „Trend" melden, wenn er deutlich über dem Rauschen liegt. Formulierung z. B. „Die Treffer wandern nach unten."
- Werte in mm ausgeben (Scheibenebene).

### 10.4 Korrekturhinweis (optional)
Wenn der Nutzer in den Einstellungen einen **Klickwert** (mm pro Klick auf 25 m) einträgt, gib zusätzlich an, um wie viele Klicks in welche Richtung korrigiert werden müsste („etwa drei Klicks höher"). Ohne Klickwert **keine** Klickangabe raten. Das Wort „Korrektur" nur bei statistisch belastbarem Versatz verwenden.

### 10.5 Sprachausgabe (TTS)
- `speechSynthesis`, `lang = "de-DE"`, beste verfügbare (bevorzugt lokale/offline) deutsche Stimme automatisch wählen, in den Einstellungen änderbar; Tempo einstellbar; Stummschalten.
- Chrome/Android verlangt eine **Nutzergeste**, bevor Ton erlaubt ist: Beim „Scheibe erfassen"-Tipp die TTS initialisieren („Bereit").
- **Warteschlange:** Neue Ansage darf veraltete, noch nicht gesprochene Ansagen ersetzen bzw. sinnvoll kürzen. Schnelle Schussfolgen (Schnellfeuer) dürfen sich nicht aufstauen. Lange Serienauswertung darf von einer neuen Trefferansage unterbrochen werden. Dokumentiere die Regel.
- **Fallback:** Ist keine deutsche Stimme vorhanden oder TTS nicht verfügbar, zeige die Ansage groß als Text und weise **einmal** darauf hin, wie der Nutzer eine Stimme installiert (Android-Einstellungen → Text-to-Speech).
- Ansagen dürfen nie Schussvorbereitung stören: kurz, ruhig, keine Signaltöne ohne Wunsch.
- Text und Ton sind **dieselbe Quelle** (ein Ansagetext, zwei Ausgabekanäle).

## 11. Debug- und Entwicklungswerkzeuge (nicht im normalen Bedienfluss)

Verstecktes Menü (langer Druck auf den Titel), enthält:
- Anzeige: Bildrate, Verarbeitungszeit pro Bild, Latenz Schuss → Ansage, px/mm, Positionsunsicherheit, Konfidenz, gesperrte/nicht gesperrte Kameraeinstellungen.
- Diagnosebilder: entzerrte Scheibe, Differenzbild, Schwellbild, Kandidaten mit Filtergründen.
- **Aufnahmeknopf:** speichert den Kamerastream als Testvideo (`MediaRecorder`) samt Metadaten (Kalibrierung, Einstellungen, Gerätefähigkeiten) und bietet Download/Teilen an. So kann der Nutzer am Stand ohne PC echte Testdaten erzeugen, die später zur Verbesserung der Erkennung dienen.
- **Sitzungsexport** als JSON (alle Treffer, Statistik, Ereignislog mit Zeitstempeln, verworfene Kandidaten mit Grund).
- Umschalter für Detektorparameter (Schwellen, K, Ruhezeit) mit Werten zum Zurücksetzen.

Alle Debug-Daten bleiben lokal.

## 12. Tests und Nachweise (zwingend)

### 12.1 Synthetischer Testdatengenerator (Meilenstein 2, hohe Priorität)
Baue ein Werkzeug, das aus der Scheibenkonfiguration **Testbilder/-videos rendert**, in denen Trefferlöcher an **bekannten Positionen** hinzukommen. Parameter:
- Scheibentyp, Kaliber, Auflösung/px pro mm, Belichtung, Rauschen, Unschärfe, JPEG-/Videokompression,
- affine/perspektivische Schräglage, leichte Bilddrehung,
- **Störungen:** globaler Helligkeitswechsel, Auto-Belichtungsdrift, 50-Hz-Flackern, Wackeln (Verschiebung kurz nach jedem Schuss), Hand/Person im Bild, Scheibenwechsel, Staub/Papierwellen,
- Lochvarianten (Riss, Rand, helles oder dunkles Loch, im Spiegel schwer sichtbar), **überlappende Löcher**.
Da die wahre Lage bekannt ist, lassen sich Fehler exakt messen.

### 12.2 Unit-Tests
- Wertung (Tabelle aus 5.3, plus Grenzfälle exakt auf der Ringgrenze, Kaliber 5,6/9,0/11,5, Rand außerhalb),
- Geometrie/Koordinaten (Vorzeichen, Spiegeltests, Richtungswörter),
- Statistik (bekannte Punktmengen mit Handrechnung, n = 1…10, Trend, „im Rahmen mittig"),
- Ansagetexte (Zahlenformat mit Komma, Grammatik, Kurz/Detail),
- Konfigurationsvalidierung (kaputte Scheibenkonfiguration wird abgelehnt).

### 12.3 Pipeline-Tests mit synthetischen Daten
Akzeptanzziele (bei Lochdurchmesser ≥ 10 px, Startwerte, anpassbar mit Begründung):
- Erkennungsrate neuer Löcher ≥ 98 % ohne Störungen, ≥ 90 % mit gemischten Störungen,
- **Fehlalarme:** 0 pro 1000 ruhige Bilder, ≤ 1 pro Störungsszenario-Durchlauf,
- mittlerer Positionsfehler ≤ 0,5 mm, 95-Perzentil ≤ 1,0 mm (bei ≥ 2 px/mm),
- korrekte Ringzahl in ≥ 99 % der Fälle, in denen das Loch nicht näher als der Positionsfehler an einer Ringgrenze liegt,
- Störungsszenarien (Wackeln nach dem Schuss, Hand im Bild, Scheibenwechsel, Helligkeitswechsel) erzeugen **keine** Fehltreffer und **keine** verlorenen echten Treffer nach der Ruhephase.
Wenn ein Ziel verfehlt wird, **berichte es ehrlich** samt Ursache. Senke Ziele nicht heimlich.

### 12.4 Ende-zu-Ende mit Playwright (Chromium)
- Fake-Kamera per Chromium-Flags (`--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`, `--use-file-for-fake-video-capture=<Video>`) mit den synthetischen Videos.
- Prüfe den kompletten Ablauf: Start → Kalibrierung → Treffer werden erkannt → Ansagetext erscheint → Serienende → Gruppentext.
- Prüfe TTS-Aufrufe über einen Stub/Spy auf `speechSynthesis`.
- **Offline-Test:** Seite laden, Service Worker aktivieren lassen, Kontext auf offline setzen, Seite neu laden, Ablauf erneut prüfen. Es dürfen keine Netzwerkanfragen nach außen gehen (im Test überwachen und bei Verstoß fehlschlagen lassen).
- Prüfe, dass Wake Lock beantragt wird und dass das Verhalten bei fehlender Unterstützung sauber ist.

### 12.5 Leistungsnachweis
- Messe Verarbeitungszeit pro Bild und Latenz Schuss → Ansage (im Debug-Menü und in einem reproduzierbaren Benchmark). Ziel: ≥ 5 verarbeitete Bilder/s auf einem Mittelklasse-Android, Latenz Schuss → Ansage ≲ 2–3 s.
- Da du kein echtes Handy zur Verfügung hast, dokumentiere Messungen im Headless-Chromium und markiere sie deutlich als **nicht repräsentativ für das Handy**. Baue eine **Selbstmessung in der App** ein (Debug-Menü), damit der Nutzer echte Werte vom Gerät liefern kann.
- Bündelgröße und erste Ladezeit dokumentieren (OpenCV/WASM-Größe!).

### 12.6 Was nur der Nutzer am Stand prüfen kann
Erstelle `docs/TESTPROTOKOLL_SCHIESSSTAND.md` (deutsch, einfach, Schritt für Schritt): Aufbau, Beleuchtung, was zu fotografieren/aufzuzeichnen ist, was die App anzeigen soll, welche Ergebnisse der Nutzer zurückmelden soll (Debug-Export, Testvideos, Screenshots, Ringzahl per Hand gegengeprüft, Abweichung per Lineal nachgemessen). Enthalten sein muss ein **Genauigkeitstest**: mehrere Treffer per Lineal/Schablone von Hand vermessen und mit den Appwerten vergleichen.

## 13. Meilensteine mit Abnahmekriterien

**M0 – Grundlage und Spike**
- Repository, TypeScript strict, Vite, Lint, Vitest, Playwright, CI (Tests bei jedem Push), `CLAUDE.md`, `docs/`-Ordner.
- PWA-Gerüst: Manifest, Service Worker, installierbar, offline lauffähig (leere Hülle).
- **Spike:** OpenCV.js laden im Worker, Größe/Ladezeit messen, zeigen, dass die für Abschnitt 7 und 9 nötigen Funktionen (Konturen, `fitEllipse`, Warp, Zusammenhangskomponenten, Registrierung) verfügbar sind. Ergebnis in `docs/SPIKE_OPENCV.md`, inkl. Empfehlung (Standardbuild/eigener Build/Eigenimplementierung).
- Deployment-Weg auf HTTPS festgelegt (mit Nutzer abgestimmt), Weg zum Test auf dem echten Handy beschrieben.
- Abnahme: Alle Checks grün, App lädt offline, Nutzer kann die leere Hülle auf dem Handy installieren.

**M1 – Kamera und Kalibrierung**
- Kamerastart, Fähigkeiten auslesen, Sperren (soweit möglich), Wake Lock, Ausrichtung.
- Automatische Scheibenerkennung + Überlagerung + Konfidenz + manuelle Korrektur + Auflösungsampel.
- Scheibenkonfiguration als JSON inkl. Validierung.
- Abnahme: Auf synthetischen Bildern mit Schräglage/Drehung/Helligkeit wird die Mitte auf ≤ 0,5 mm genau gefunden; Fake-Kamera-E2E-Test läuft; Nutzer testet am realen Bild (Scheibe in der Wohnung/im Stand) und meldet Ergebnis.

**M2 – Schusserkennung und Text**
- Generator (12.1), Referenzbild, Normalisierung, Kandidaten/Filter, zeitliche Stabilität, Störungserkennung, Wertung, Trefferliste, Textausgabe.
- Abnahme: Akzeptanzziele aus 12.3 für die Basisszenarien erreicht und belegt; E2E-Test grün.

**M3 – Sprache und Gruppenanalyse**
- TTS inkl. Warteschlange und Fallback, Ansagetexte, Serienverwaltung, Statistik, Trend, „im Rahmen mittig"-Logik, optionaler Klickwert.
- Abnahme: Unit-Tests für Texte/Statistik; E2E prüft TTS-Aufrufe; Nutzer bestätigt, dass Ansagen verständlich und nicht störend sind.

**M4 – Robustheit**
- Nachführung, Überlappungslogik, Scheibenwechsel, Fehlerkorrektur, alle Störungsszenarien aus 12.1.
- Abnahme: Akzeptanzziele für gemischte Störungen erreicht; `docs/GRENZEN.md` ehrlich verfasst.

**M5 – Leistung, Offline, Akku**
- Bildrate adaptiv (nur Scheibenbereich verarbeiten, ROI, sinnvolle Auflösung), Worker-Auslastung, Speicherlecks prüfen (Dauerlauf-Test mit langem synthetischem Video), Akku-/Wärmehinweise.
- Offline-Test vollständig, Update-Strategie (kein Update mitten in der Serie).
- Abnahme: Benchmark und Selbstmessung vorhanden, Dauerlauf ≥ 30 Minuten simuliert ohne Speicherwachstum.

**M6 – Werkzeuge, Doku, Übergabe**
- Debug-Menü komplett (Aufnahme, Export), `docs/TESTPROTOKOLL_SCHIESSSTAND.md`, `docs/BEDIENUNG.md` (Nutzer, deutsch), `docs/ENTWICKLUNG.md`, `docs/GRENZEN.md`, `docs/OFFEN.md`.
- Abschlussprüfung gemäß Abschnitt 15.

**Ausdrücklich noch nicht im Umfang** (nur in `docs/OFFEN.md` als Ideen führen, nicht bauen): weitere Scheibentypen/Disziplinen (Schnellfeuer, Luftpistole, Gewehr), Mikrofon als zusätzlicher Schuss-Auslöser, Langzeit-Historie über mehrere Sitzungen mit Diagrammen, Export als PDF, iOS-Optimierung. Halte die Architektur dafür offen (Scheibenkonfiguration, austauschbarer Detektor, Trigger-Schnittstelle).

## 14. Qualitätsleitplanken

- **Fehlalarme sind schlimmer als eine leicht verzögerte Erkennung.** Ein falscher Treffer im Ohr stört das Schießen mehr als 1 s Verzögerung. Im Zweifel abwarten und stabil bestätigen.
- **Kein stilles Versagen:** Wenn die Kalibrierung verloren geht, die Auflösung zu gering ist oder das Bild dauerhaft unruhig ist, muss die App das **sichtbar und hörbar (einmalig, kurz)** melden, statt weiter falsche Werte zu liefern.
- **Ehrliche Unsicherheit:** Konfidenz und Flags nie verstecken. Bei geringer Konfidenz vorsichtig formulieren.
- **Robust gegen Fehlbedienung:** Doppeltippen, Drehen des Handys, App in den Hintergrund und zurück, Bildschirmsperre, Kamera-Berechtigung verweigert (verständliche deutsche Fehlermeldung mit Anleitung), Kamera von anderer App belegt.
- **Barrierearmut:** ausreichende Schriftgrößen, Kontrast, keine reine Farbkodierung.
- **Keine Nachrichten oder Ansagen im Sekundentakt**; Ansage nur bei relevanten Ereignissen.
- **Sicherheit beim Sport:** Die App ist ein Auswertungshelfer. Sie darf nie den Eindruck erwecken, sicherheitsrelevante Entscheidungen zu treffen. Kein „Feuerfreigabe"-Verhalten.

## 15. Abschlussprüfung (Definition of Done) – vor der Übergabe vollständig ausführen

Führe die folgenden Prüfungen **tatsächlich aus** und berichte pro Punkt „bestanden / nicht bestanden / nicht prüfbar (Grund)". Ein Punkt „bestanden" braucht einen Nachweis (Befehlsausgabe, Testbericht, Screenshot).

1. `tsc --noEmit`, ESLint und Prettier ohne Fehler.
2. Alle Unit-Tests und alle Playwright-Tests grün, mit Zusammenfassung der Anzahl.
3. Akzeptanzziele aus 12.3 als Tabelle (Ziel vs. gemessen), inkl. der Szenarien mit Störungen.
4. Offline-Test: keine externen Requests, App vollständig nach Offline-Reload nutzbar, Service Worker aktiv.
5. Produktions-Build erstellt, Bündelgröße und Ladezeit dokumentiert, keine ungenutzten großen Abhängigkeiten.
6. Wertung: Kontrollwerte aus 5.3 und Grenzfälle als Tests, Ergebnisse angeben.
7. Koordinaten/Richtung: Spiegeltests grün (links unten bleibt links unten).
8. Sprachausgabe: Ansagetexte in Kurz und Detail für mindestens 10 Beispieltreffer ausgeben und auf Grammatik/Zahlenformat prüfen; TTS-Aufrufe im E2E-Test belegt.
9. Speicher/Dauerlauf: simulierter Lauf ≥ 30 Minuten ohne wachsenden Speicherverbrauch.
10. Datenschutz: Bestätigung per Netzwerküberwachung, dass keine Daten das Gerät verlassen.
11. Dokumentation vollständig vorhanden und konsistent (jede Datei aus Abschnitt 13/M6 existiert, Befehle darin wurden **wirklich ausgeführt** und funktionieren).
12. Konsistenzprüfung gegen diese Anweisung: Gehe Abschnitt 1 bis 14 durch und liste zu jedem Abschnitt, ob er erfüllt ist, und wenn nicht, warum. Keine Abweichung ohne Begründung.
13. Liste aller **bekannten Grenzen** und aller Dinge, die nur am echten Schießstand geprüft werden können, in `docs/GRENZEN.md` und `docs/TESTPROTOKOLL_SCHIESSSTAND.md`.
14. Übergabebericht an den Nutzer (deutsch, kurz): Was wurde gebaut, wie installiert er die App auf dem Handy, wie startet er das erste Testschießen, was soll er zurückmelden.

## 16. Erste Schritte (konkret)

1. Lies diese Datei komplett. Prüfe, ob etwas in sich widersprüchlich oder technisch nicht machbar ist, und benenne es **vor** dem Planen.
2. Frage die offenen Punkte aus Abschnitt 3 gesammelt in einer einzigen Nachricht ab (Standardwerte vorschlagen, damit der Nutzer nur „ok" sagen muss).
3. Präsentiere im Plan-Modus: Ordnerstruktur, Bibliotheken mit Begründung, Architektur (Hauptthread / Worker / CV-Schnittstelle / Konfigurationen), Risiken, Reihenfolge M0 bis M6, Aufwandsschätzung je Meilenstein.
4. Warte auf Freigabe, dann starte mit M0.

## 17. Bekannte Risiken (Kurzfassung zur Erinnerung)

1. **Kamerasteuerung im Browser** (Fokus/Belichtung sperren) ist geräte- und browserabhängig. Softwareseitige Kompensation ist Pflicht.
2. **Loch im schwarzen Spiegel** hat wenig Kontrast. Entscheidend sind Licht, Auflösung und die Referenzmittelung.
3. **Optik des Spektivs** (Vignettierung, Verzeichnung, Fokus) beeinflusst die Millimetergenauigkeit. Nur am realen Aufbau messbar.
4. **Auflösung bei 25 m:** Ohne genug Zoom ist ein Loch nur wenige Pixel groß. Die Ampel (7.2) gehört zu den wichtigsten Bedienhinweisen.
5. **Rückstoß und Erschütterung** lösen Fehltreffer aus, wenn die Ruhelogik (9.5) zu schwach ist.
6. **Überlappende Löcher** sind nur begrenzt lösbar. Ehrlich dokumentieren.
7. **Akku und Wärme** bei Dauerbetrieb von Kamera plus WASM-Verarbeitung.
8. **Ringgeometrie und Kaliber** müssen mit der realen Scheibe abgeglichen werden, sonst sind die Ringzahlen systematisch falsch.

---
*Ende der Anweisung.*
