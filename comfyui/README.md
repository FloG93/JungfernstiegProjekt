# FaboroHacks Image Upscale V2 — Vergleich + Auflösungs-Presets

Datei: `FaboroHacks_Image_Upscale_V2_Compare_Presets.json` (ComfyUI-Workflow, per Drag & Drop laden)

## Was neu ist gegenüber V1

### 1. Vergleich Input vs. Final (am Ende jedes Pfades)
Beide Upscale-Pfade enden jetzt in einer eigenen Vergleichs-Box:

- **✅ Vergleich · Input vs. Final (SeedVR2)** — aktiv
- **✅ Vergleich · Input vs. Final (FlashVSR)** — mit dem FlashVSR-Branch einschalten

Jede Box enthält einen `Image Comparer (rgthree)` (A/B-Slider) plus einen Skalierungs-Node,
der das **Originalbild aus dem LoadImage** mit `nearest` auf die Zielauflösung bringt.
Dadurch liegen A und B auf der gleichen Leinwand und der Slider vergleicht echte Pixel —
ohne Schönfärbung durch Lanczos.

Wichtig: Der Vergleich hängt direkt am `LoadImage`, nicht am geblurrten Zwischenbild.
In V1 zeigte der Comparer das bereits vorbehandelte Bild — das war für eine
Qualitätsprüfung nicht ehrlich.

### 2. Sechs Auflösungs-Presets in eigenen Kästchen
Unten im Graph liegen sechs Gruppen (2K / QHD / 3K / 4K / 6K / 8K), jede mit einem
Int-Node und einem Hinweis zu VRAM und Einsatzzweck. Genau eines aktivieren —
am einfachsten über das Panel **Preset-Schalter** (Fast Groups Bypasser, auf "preset" gefiltert,
`max one`). Standard ist 3K/3000 px, also der Originalwert aus V1.

Ein `Any Switch (rgthree)` nimmt das erste aktive Preset und verteilt den Wert an:

- SeedVR2: `resolution` **und** `max_resolution`
- FlashVSR: finale Skalierung auf die lange Kante
- beide Vergleichs-Boxen

Ist kein Preset aktiv, bricht der Lauf mit "resolution is missing" ab.
Ohne rgthree lässt sich der Int-Node auch direkt an `resolution` hängen.

### 3. Kleinere Korrekturen
- `SaveImage` im SeedVR2-Pfad war gebypasst — das Ergebnis wurde nie gespeichert. Jetzt aktiv.
- Dateinamen mit Datum: `Upscale/SeedVR2_%date:yyyy-MM-dd%` bzw. `Upscale/FlashVSR_…`
- FlashVSR speichert jetzt das auf die Zielauflösung gebrachte Bild, nicht den rohen 4x-Output.
- Ausführungsreihenfolge (`order`) neu berechnet, Gruppen-Rechtecke überschneidungsfrei.

## Abhängigkeiten
Unverändert gegenüber V1 — es kamen keine neuen Custom-Node-Packs dazu:
`comfy-core`, `rgthree-comfy`, `comfyui_layerstyle`, `seedvr2_videoupscaler`,
`ComfyUI-FlashVSR_Ultra_Fast`.
