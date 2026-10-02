# Herkunft der Grafik- und Tondateien (16.5)

Das Spiel verwendet derzeit **keine fremden Asset-Dateien**. Alles entsteht im Code und steht unter der Lizenz des Projekts:

| Bereich | Entstehung | Ort |
| --- | --- | --- |
| Figuren, Gegner, Bosse, Hintergründe | zur Laufzeit gezeichnete Platzhalter (Formen mit Klassen- bzw. Typ-Symbol, 14.8) | `apps/client/src/game/textures.ts` |
| Symbole der App (PWA) | SVG von Hand, PNG per Skript erzeugt | `apps/client/public/icon.svg`, `apps/client/scripts/icons.mjs` |
| Klänge | per WebAudio erzeugt (Oszillatoren, Rauschen) | `apps/client/src/lib/audio.ts` |
| Musik | per WebAudio erzeugte Flächenklänge je Stimmung | `apps/client/src/lib/music.ts` |
| Element- und Oberflächensymbole | Unicode-Zeichen der Systemschrift | `apps/client/src/game/palette.ts` |

Kommen später Pixel-Art-Atlanten oder Ogg-Dateien dazu (14.8, 14.9), steht hier je Datei Herkunft, Autor und Lizenz
(bevorzugt CC0).
