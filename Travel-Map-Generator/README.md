# Travel-Map-Generator

Verwandelt Reisedaten (manuelle Punkte, berechnete Routen, GPX-Tracks) in
animierte Karten-Videos und interaktive, einbettbare Web-Karten.
Läuft vollständig im Browser – kein Server, keine Installation.

**App:** <https://flog93.github.io/JungfernstiegProjekt/Travel-Map-Generator/>

> **Status: Meilenstein M0 – Gerüst.** Karte, Build und Auslieferung über
> GitHub Pages stehen. Routen, Animation und Video-Export folgen in M1–M4.

- [`PLAN.md`](PLAN.md) – Meilensteine M0–M9 mit Abnahmekriterien
- [`ARCHITECTURE.md`](ARCHITECTURE.md) – Stack, Datenmodell, Export-Pipeline, Grenzen

## Entwicklung

```bash
cd Travel-Map-Generator
npm install
npm run dev          # Entwicklungsserver
npm run check        # Lint + Typen + Tests, wie in der CI
npm run build        # Produktions-Build nach dist/
```

| Skript | Zweck |
|---|---|
| `npm run dev` | Vite-Entwicklungsserver mit Hot Reload |
| `npm run lint` | ESLint über `src` und `tests` |
| `npm run typecheck` | `tsc --noEmit`, strikte Einstellungen |
| `npm run test` | Vitest (einmalig); `npm run test:watch` beobachtet |
| `npm run build` | Produktions-Build; `npm run preview` zeigt ihn an |

Der Build setzt `base` auf `/JungfernstiegProjekt/Travel-Map-Generator/`, weil
Pages die App in einem Unterordner ausliefert. Lokal läuft der Dev-Server
deshalb ebenfalls unter diesem Pfad – die ausgegebene URL stimmt.

## Was ohne API-Key funktioniert

Alles, was aktuell drin ist. Die Basiskarten kommen keylos von
[OpenFreeMap](https://openfreemap.org/); 3D-Gelände (ab M5) nutzt die freien
Terrarium-Kacheln von AWS, historisches Wetter (ab M6) Open-Meteo.
Optionale Keys für mehr Routing-Kontingent und Satellitenbilder kommen in M2
bzw. M5 und werden nur im Browser des Nutzers gespeichert – niemals im Repo.

## Lizenz

MIT
