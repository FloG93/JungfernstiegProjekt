# FaboroHacks Image Upscale V3 — Mehrere Auflösungen pro Lauf + Vergleich

Datei: `FaboroHacks_Image_Upscale_V3_MultiRes_Compare.json` (ComfyUI-Workflow, per Drag & Drop laden)

## Kernidee

Jedes Preset-Kästchen ist eine **vollständige Upscale-Einheit**, kein bloßer Zahlenwert:

```
LoadImage ─┬─ (Blur/Alpha-Vorbereitung) ─┬─ Preset 2K  → SeedVR2 → Vergleich + Speichern
           │                             ├─ Preset QHD → SeedVR2 → Vergleich + Speichern
           │                             ├─ Preset 3K  → SeedVR2 → Vergleich + Speichern
           │                             ├─ Preset 4K  → SeedVR2 → Vergleich + Speichern
           │                             ├─ Preset 6K  → SeedVR2 → Vergleich + Speichern
           │                             └─ Preset 8K  → SeedVR2 → Vergleich + Speichern
           └─ Originalbild → je Box auf Zielgröße (nearest) → Vergleich A
```

Es dürfen **beliebig viele Presets gleichzeitig aktiv** sein. ComfyUI arbeitet die
aktiven Zweige in einem einzigen Queue-Lauf nacheinander ab — Modelle (DiT + VAE)
werden dabei nur einmal geladen und von allen Zweigen geteilt. Am Ende steht pro
Auflösung ein A/B-Vergleich im Graph und eine Datei im Output.

Die Presets: **2K 2048 · QHD 2560 · 3K 3000 (Standard) · 4K 4096 · 6K 6144 · 8K 8192** (lange Kante).

## Bedienung

- **Preset-Schalter** (links, rgthree Fast Groups Bypasser, gefiltert auf „preset"):
  ein Klick pro Auflösung. Alternativ Rechtsklick auf die Gruppe → *Bypass Group Nodes*.
- Seed ist in allen Boxen **42 / fixed** — nur so sind die Auflösungen fair vergleichbar.
- Dateinamen tragen die Auflösung: `Upscale/SeedVR2_4096px_<Datum>`.
- RAM: jede aktive Box hält ihr Ergebnis bis zum Ende des Laufs im Speicher.
  2–3 Presets gleichzeitig sind unkritisch, alle 6 brauchen viel System-RAM.

## Vergleich Input vs. Final

Jede Box enthält einen `Image Comparer (rgthree)`:
**A** = Originalbild direkt aus dem `LoadImage`, mit `nearest` auf die Zielauflösung
gebracht (zeigt echte Pixel, keine Schönfärbung durch Lanczos) · **B** = Ergebnis.
Der FlashVSR-Zweig hat eine eigene Vergleichsbox.

## FlashVSR

Bleibt ein einzelner Pfad. Dort bestimmt nicht die Zielauflösung die Qualität,
sondern Vorskalierung × `scale`; bei `scale = 4`:
`512→2048 · 640→2560 · 750→3000 · 1024→4096 · 1536→6144 · 2048→8192`.
Die Mehrfach-Auflösung in einem Lauf gibt es nur im SeedVR2-Pfad.

## Abhängigkeiten

Unverändert gegenüber V1, es kam kein neues Node-Pack dazu:
`comfy-core`, `rgthree-comfy`, `comfyui_layerstyle`, `seedvr2_videoupscaler`,
`ComfyUI-FlashVSR_Ultra_Fast`.

## Änderungen gegenüber V1

- Vergleich Input ↔ Final am Ende jedes Pfades (V1 verglich gegen das bereits
  vorbehandelte Zwischenbild, nicht gegen den echten Input).
- Sechs Auflösungs-Presets als eigene, sequenziell abgearbeitete Zweige.
- `SaveImage` im SeedVR2-Pfad war gebypasst — Ergebnisse wurden nie gespeichert.
- Dateinamen mit Auflösung und Datum.
- FlashVSR speichert das auf Zielgröße skalierte Bild statt des rohen 4×-Outputs.
