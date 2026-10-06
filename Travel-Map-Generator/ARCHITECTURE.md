# Travel-Map-Generator – Architektur und technische Entscheidungen

Begleitdokument zu [`PLAN.md`](PLAN.md). Hier stehen die Festlegungen, auf die
sich die Meilensteine stützen – inklusive der Gründe und der bekannten Grenzen.

## 1. Repo-Layout

```
JungfernstiegProjekt/
├── README.md                     # wird zur Übersicht beider Projekte
├── kindle_meta/ …                # bestehendes Python-Projekt, unberührt
├── site/
│   └── index.html                # Hauptseite -> flog93.github.io/JungfernstiegProjekt/
├── Travel-Map-Generator/
│   ├── PLAN.md  ARCHITECTURE.md  README.md
│   ├── index.html                # Editor-Einstieg
│   ├── viewer.html               # eigenständiger interaktiver Viewer (M8)
│   ├── package.json  vite.config.ts  tsconfig.json
│   ├── src/
│   │   ├── core/                 # reines TypeScript, kein DOM, voll getestet
│   │   │   ├── model/            # Projekt-Schema, Versionierung, Migration
│   │   │   ├── geo/              # Bogenlänge, Großkreis, Douglas-Peucker, GPX
│   │   │   ├── timeline/         # Zeit -> Zustand, Keyframes, Easing
│   │   │   └── providers/        # Routing/Geocoding/Höhe/Wetter, reine Clients
│   │   ├── map/                  # MapLibre: Stile, Layer, Terrain, Marker
│   │   ├── export/               # Frame-Renderer, Encoder, Alpha, Share-Paket
│   │   ├── ui/                   # React-Komponenten, Timeline, Dialoge
│   │   ├── state/                # Zustand-Store, Undo/Redo, Autosave
│   │   └── storage/              # IndexedDB, .tmgz Ex-/Import, Key-Verwaltung
│   ├── public/                   # Icons, Fahrzeug-Sprites, Beispielprojekt
│   └── tests/                    # Vitest (Unit) + Playwright (E2E)
└── .github/workflows/
    ├── ci.yml                    # bestehend: Python
    ├── tmg-ci.yml                # neu: Lint, Typecheck, Unit-Tests der App
    └── pages.yml                 # neu: Build + Deploy der Pages-Seite
```

`site/` und `Travel-Map-Generator/` werden im Workflow zu einem `_site/`
zusammengesetzt. Vite läuft mit `base: "/JungfernstiegProjekt/Travel-Map-Generator/"`.

## 2. Stack

| Baustein | Wahl | Grund |
|---|---|---|
| Sprache | TypeScript, strict | Das Datenmodell ist das Herz der App; Typfehler dort kosten später Stunden. |
| Build | Vite | Schnell, statischer Output, `base`-Pfad für Pages-Unterordner. |
| UI | React + Zustand | Timeline, Medien-Liste und Dialoge sind klassischer Zustands-UI-Code. Zustand bleibt klein und erlaubt einfaches Undo/Redo über Snapshots. |
| Karte | MapLibre GL JS | Open Source, kein Pflicht-Token, 3D-Terrain, `preserveDrawingBuffer` für Frame-Capture, Custom Layer für three.js. |
| 3D-Modelle (ab M5) | three.js in einem MapLibre-Custom-Layer | Nur wo nötig; Icon-Sprites decken den Großteil ab und kosten keine Performance. |
| Styling | Tailwind | Konsistente, kompakte Oberfläche ohne eigenes Design-System. |
| Video | WebCodecs + Mediabunny, Fallback `ffmpeg.wasm` | Siehe Abschnitt 6. |
| Tests | Vitest + Playwright | Kern-Logik unit, Oberfläche und Export Ende-zu-Ende. |

## 3. Datenmodell (Schema v1, Auszug)

Eine Projektdatei ist JSON; `.tmgz` ist ein ZIP aus `project.json` plus
optionalen Medien. `schemaVersion` wird bei jedem Laden geprüft und migriert.

```ts
type Project = {
  schemaVersion: 1
  id: string; title: string; createdAt: string; updatedAt: string
  segments: Segment[]            // Reihenfolge = Reiseverlauf
  media: MediaItem[]
  annotations: Annotation[]      // Banderolen, Kapitel, Sprachnotizen
  style: StyleSettings           // Kartenstil, Linie, Terrain, Umwelt-Overlays
  camera: CameraSettings         // Modus + Keyframes
  timing: TimingSettings         // Gesamtdauer, Pausen, Easing
  export: ExportSettings         // Seitenverhältnis, fps, Audio, Alpha
}

type Segment =
  | { kind: 'routed';  mode: TravelMode; options: RouteOptions
      waypoints: Waypoint[]; geometry: LineString; stats: RouteStats
      provider: string; fetchedAt: string }              // Ergebnis wird persistiert
  | { kind: 'arc';     mode: 'plane' | 'ship'
      from: Waypoint; to: Waypoint; arcHeight: number }  // Großkreis, kein Routing
  | { kind: 'gpx';     source: string; geometry: LineString
      elevation?: number[]; times?: string[]; tolerance: number }

type TravelMode = 'car' | 'motorcycle' | 'bicycle' | 'foot'
type RouteOptions = { avoidMotorways: boolean; avoidTolls: boolean
                      avoidFerries: boolean; preferCurvy: boolean }
```

Zwei Entscheidungen dahinter:

- **Routen-Geometrie wird mitgespeichert.** Ein Projekt muss ohne erneute
  API-Anfrage wieder öffnen und exportieren können – sonst hängt ein fertiges
  Video am Tageskontingent eines Gratis-Dienstes.
- **Medien werden referenziert, nicht eingebettet**, solange man im Editor
  arbeitet (IndexedDB-Handle). Erst Export/Teilen packt Kopien ein.

## 4. Provider-Abstraktion

Jede externe Quelle liegt hinter einem Interface mit einer Fähigkeiten-Tabelle,
damit die Oberfläche nur anbietet, was der aktive Anbieter wirklich kann.

| Aufgabe | Default (kein Key) | Optional mit Key | Hinweis |
|---|---|---|---|
| Basiskarte (Vektor) | OpenFreeMap | MapTiler, Stadia | Attribution ist Pflicht und fest eingebaut. |
| Satellit / 3D-Fotorealismus | – | MapTiler, Mapbox, Google 3D Tiles | Ohne Key nicht verfügbar; Stil wird ausgegraut. |
| Höhenmodell / 3D-Gelände | AWS Terrarium (`encoding: "terrarium"`) | MapTiler Terrain | Keyless, global; falsches `encoding` ergibt still falsches Relief. |
| Routing | OSRM-Demo bzw. HeiGIT-Gratiskontingent | HeiGIT/ORS-Key, GraphHopper | Siehe Abschnitt 5. |
| Geocoding | Photon / Nominatim | ORS Pelias | Rate-Limits der Nominatim-Policy werden eingehalten (Entprellen, Cache). |
| Historisches Wetter | Open-Meteo Archiv | – | Keyless, CORS-fähig. |

Keys liegen ausschließlich im `localStorage` des Nutzers, mit sichtbarem Hinweis
im Einstellungsdialog. Kein Key wird jemals committet oder weitergesendet.

## 5. Routing-Profile, ehrlich

- *Auto*, *Fahrrad*, *Zu Fuß* bilden direkt auf die Profile der Anbieter ab
  (`driving-car`, `cycling-regular`, `foot-walking`).
- *Motorrad* gibt es in den Gratis-Profilen **nicht**: GraphHoppers
  Motorrad-Profil ist nur auf Anfrage verfügbar, ORS hat keines. Wir setzen es
  als Auto-Profil mit `avoid_features: ["highways", "tollways"]` plus Vorliebe
  für kurvige Nebenstrecken um und schreiben das in die Oberfläche. Ein echtes
  Motorrad-Profil bleibt als Key-Option im Interface vorgesehen.
- „Autobahnen vermeiden" ist bei ORS über `avoid_features` abgedeckt; zusätzlich
  sind Vermeidungs-Polygone möglich, falls einzelne Abschnitte raus sollen.
- Hinweis zum Endpunkt: `api.openrouteservice.org` ist zugunsten von
  `api.heigit.org` abgekündigt und stark kontingentiert – wir sprechen von
  Anfang an den neuen Endpunkt.

## 6. Animation: deterministische Zeitachse

Der Kern ist eine reine Funktion:

```ts
stateAt(project: Project, tSeconds: number): FrameState
// -> Position, Kurswinkel, Neigung, gezeichneter Linienanteil,
//    Kamera (Center/Zoom/Pitch/Bearing), sichtbare Medien und Texte
```

Keine Wanduhr, kein `requestAnimationFrame` im Kern. Vorschau und Export rufen
dieselbe Funktion – die Vorschau mit der echten Zeit, der Export mit
`frame / fps`. Das ist die Voraussetzung dafür, dass der Export aussieht wie die
Vorschau, dass Scrubbing exakt ist und dass Frames im Test per Hash vergleichbar
sind.

Details: Routen werden nach Bogenlänge parametrisiert (nicht nach Punktindex,
sonst wird die Fahrt an dichten Trackstellen langsam); Geschwindigkeit und
Kamera werden über Keyframes mit Bézier-Easing interpoliert, Kurswinkel aus der
Tangente, Kurvenneigung aus der Winkeländerung pro Strecke.

## 6a. Zwei Fallstricke, die schon eingebaut sind

Beides fällt erst spät auf und ist dann teuer, deshalb steht es ab M0 im Code:

- **MapLibre-Worker.** MapLibre sucht seinen Web-Worker über `import.meta.url`
  als Nachbardatei von `maplibre-gl.mjs`. Nach dem Bündeln liegt dort nur noch
  der eigene Chunk, der Worker fehlt, und die Karte bleibt leer – sichtbar nur
  als Konsolenmeldung „Worker failed to load". `src/map/worker.ts` setzt die
  URL darum ausdrücklich über `setWorkerUrl()` auf das von Vite emittierte
  Asset.
- **`preserveDrawingBuffer`.** Ohne dieses Flag liefert das Karten-Canvas beim
  späteren Frame-Capture ein leeres Bild. In MapLibre 6 sitzt es in
  `canvasContextAttributes` und lässt sich nach dem Erzeugen der Karte nicht
  mehr ändern – also von Anfang an gesetzt.

## 7. Export-Pipeline

```
Zeitachse ──► für jeden Frame:
                 stateAt(t) → Karte setzen → auf 'idle' warten (Kacheln fertig)
                 → Overlay-Canvas zeichnen (Linie, Marker, Pop-ups, Text)
                 → Frame an Encoder
                                   ├── WebCodecs VideoEncoder + Mediabunny → MP4/H.264, WebM/VP9
                                   ├── ffmpeg.wasm (Fallback/ProRes)        → MP4, ProRes 4444
                                   └── PNG-Sequenz + ZIP                    → immer verfügbar, mit Alpha
```

Entscheidungen und Grenzen:

- **Das Warten auf `map.once('idle')` pro Frame ist nicht optional.** Ohne das
  landen halb geladene Kacheln im Video. Es bestimmt die Exportdauer stärker als
  das Encoding.
- **WebCodecs ist der Hauptpfad**: nativ, hardwarebeschleunigt, kein 30-MB-WASM,
  kein `SharedArrayBuffer`. Mediabunny (Nachfolger von `mp4-muxer`/`webm-muxer`)
  übernimmt das Muxen.
- **`ffmpeg.wasm` nur als Fallback und für ProRes.** GitHub Pages kann die
  COOP/COEP-Header für `SharedArrayBuffer` nicht setzen; multithreaded läuft es
  dort nur über einen Service-Worker-Trick (`coi-serviceworker`, kostet einen
  Reload beim ersten Besuch und hilft nicht in jedem eingebetteten Kontext).
  Ohne ihn bleibt der singlethreaded Pfad – deutlich langsamer. Wir prüfen
  `crossOriginIsolated` beim Start und sagen dem Nutzer, was gerade geht.
- **Alpha-Export** (M7): PNG-Sequenz ist der verlässliche Weg (verlustfrei,
  überall importierbar). WebM/VP9 mit Alpha ist kompakt, aber nicht in jedem
  Schnittprogramm willkommen. ProRes 4444 geht über `ffmpeg.wasm` mit harten
  Speichergrenzen – die App rechnet vorher aus, ob Auflösung × Länge passt, und
  legt sonst das fertige lokale `ffmpeg`-Kommando bei.

## 8. Speicherung

- **Projekte:** IndexedDB, Autosave mit Debounce, Undo/Redo über
  Store-Snapshots.
- **Medien:** als Blob in IndexedDB, Thumbnails separat; nichts verlässt den
  Browser.
- **Austausch:** `.tmgz` (ZIP) exportieren/importieren – das ist auch das
  Backup-Format.
- **Teilen (M8):** erzeugt einen Ordner mit `viewer.html`, `project.json` und
  verkleinerten Medien, den der Nutzer bewusst ins Repo legt. Erst dann ist
  etwas öffentlich.

## 9. Tests und Qualitätsschranken

| Ebene | Werkzeug | Was abgedeckt wird |
|---|---|---|
| Kern | Vitest | Geo-Mathematik (Bogenlänge, Großkreis, Vereinfachung), GPX-Parser mit echten Beispieldateien, `stateAt` an Abschnittsgrenzen, Schema-Migration |
| Provider | Vitest mit aufgezeichneten Antworten | Request-Bau, Fehler- und Rate-Limit-Pfade – keine echten API-Aufrufe im CI |
| Oberfläche | Playwright | Route anlegen, speichern, neu laden, Timeline scrubben |
| Export | Playwright | Kurzer Export, Frame-Hashes gegen Referenzbilder; verhindert stille Abweichungen zwischen Vorschau und Video |
| Budget | CI-Check | Bundle-Größe, Vorschau-fps bei einer Referenzroute |

## 10. Was diese App ausdrücklich nicht kann

Damit es später keine Enttäuschung gibt:

1. **Kein fotorealistisches 3D ohne bezahlten Key.** Keyless gibt es Vektorkarten
   und echtes 3D-Gelände, aber keine Satellitenbilder.
2. **Exportdauer ist kein Nullsummenspiel.** Ein Minuten-Video braucht
   Minuten – der Großteil davon fürs Nachladen der Kartenkacheln.
3. **ProRes im Browser hat Grenzen.** Für lange Overlay-Spuren ist der Weg
   PNG-Sequenz plus lokales `ffmpeg`.
4. **Medien werden nicht gehostet.** Interaktive Einbettung heißt: Viewer-Paket
   ins eigene Repo legen.
5. **Keine kommerzielle Nutzung der Gratis-Kontingente** – das verbieten die
   Nutzungsbedingungen der Anbieter, nicht wir.
