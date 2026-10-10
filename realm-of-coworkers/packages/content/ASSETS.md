# Herkunft der Grafik- und Tondateien (16.5)

Die Figuren sind Pixel-Art aus dem Universal-LPC-Baukasten (Tabelle unten, OPEN-051). Alles andere entsteht im Code
und steht unter der Lizenz des Projekts:

| Bereich | Entstehung | Ort |
| --- | --- | --- |
| Helden, Gegner, Bosse | Pixel-Art, aus LPC-Ebenen zusammengesetzt (`pnpm sprites`) | `apps/client/public/sprites/` |
| Boden, Hügel, Platzhalter | zur Laufzeit gezeichnet (Pixel-Raster, feste Zufallsfolge je Kapitel) | `apps/client/src/game/textures.ts` |
| Symbole der App (PWA) | SVG von Hand, PNG per Skript erzeugt | `apps/client/public/icon.svg`, `apps/client/scripts/icons.mjs` |
| Klänge | per WebAudio erzeugt (Oszillatoren, Rauschen) | `apps/client/src/lib/audio.ts` |
| Musik | per WebAudio erzeugte Flächenklänge je Stimmung | `apps/client/src/lib/music.ts` |
| Element- und Oberflächensymbole | Unicode-Zeichen der Systemschrift | `apps/client/src/game/palette.ts` |

Kommen später Ogg-Dateien dazu (14.9), steht hier je Datei Herkunft, Autor und Lizenz.
Die Lizenztexte der benutzten Grafiken liegen in `packages/content/lizenzen/`.

<!-- sprites:anfang -->

## Sprites aus dem Universal-LPC-Baukasten (OPEN-051)

Quelle: <https://github.com/sanderfrenken/Universal-LPC-Spritesheet-Character-Generator>,
zusammengesetzt mit `tools/sprites/build_sprites.py` (`pnpm sprites`), Figurenliste in
`tools/sprites/figuren.json`. Die Lizenztexte liegen in `packages/content/lizenzen/`.

| Figur | Ebene | Urheber | Lizenz |
| --- | --- | --- | --- |
| krieger | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| krieger | Body color | Benjamin K. Smith (BenCreating), bluecarrot16, TheraHedwig, Evert, MuffinElZangano, Durrani, Pierre Vigier (pvigier), ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| krieger | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Sander Frenken (castelonia), Benjamin K. Smith (BenCreating), Eliza Wyatt (ElizaWy), dalonedrau, Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| krieger | Body color | bluecarrot16, Evert, TheraHedwig, Benjamin K. Smith (BenCreating), MuffinElZangano, Durrani, Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| krieger | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Benjamin K. Smith (BenCreating), Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| krieger | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), ElizaWy, MuffinElZangano, Durrani, Nila122, kheftel, Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| krieger | Human male | bluecarrot16, Benjamin K. Smith (BenCreating), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| krieger | Armour | bluecarrot16, Michael Whitlock (bigbeargames), Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| krieger | Boots Metal Plating | JaidynReiman | OGA-BY 3.0+, CC-BY 3.0+, GPL 3.0 |
| krieger | Plate | recolor by bigbeargames | color reduced to 7 colors and adapted to v3 bases by bluecarrot16 |
| krieger | Plate | adapted to female base by makrohn | recolor by bigbeargames |
| krieger | Plate | color reduced to 7 colors and adapted to v3 bases by bluecarrot16 | adapted to teen base from male/female by JaidynReiman |
| krieger | Armour | Michael Whitlock (bigbeargames), Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| krieger | Armour | Michael Whitlock (bigbeargames), Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| krieger | Barbuta | bluecarrot16 | OGA-BY 3.0, CC-BY 3.0, CC-BY 4.0, GPL 2.0, GPL 3.0 |
| krieger | Mace | Johannes Sjölund (wulax), bluecarrot16 | OGA-BY 3.0, CC-BY-SA 3.0 |
| magier | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| magier | Body color | Benjamin K. Smith (BenCreating), bluecarrot16, TheraHedwig, Evert, MuffinElZangano, Durrani, Pierre Vigier (pvigier), ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| magier | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Sander Frenken (castelonia), Benjamin K. Smith (BenCreating), Eliza Wyatt (ElizaWy), dalonedrau, Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| magier | Body color | bluecarrot16, Evert, TheraHedwig, Benjamin K. Smith (BenCreating), MuffinElZangano, Durrani, Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| magier | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Benjamin K. Smith (BenCreating), Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| magier | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), ElizaWy, MuffinElZangano, Durrani, Nila122, kheftel, Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| magier | Human female | bluecarrot16, Benjamin K. Smith (BenCreating), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| magier | Plain | Manuel Riecke (MrBeast), Joe White | CC-BY-SA 3.0, GPL 3.0 |
| magier | Pants | bluecarrot16, JaidynReiman, ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, GPL 3.0, CC-BY-SA 3.0 |
| magier | Pants | bluecarrot16, JaidynReiman, ElizaWy, Joe White, Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, GPL 3.0, CC-BY-SA 3.0 |
| magier | Shoes | bluecarrot16, Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| magier | Shoes | Joe White, Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| magier | Robe | Luke Mehl | CC-BY-SA 3.0, GPL 3.0 |
| magier | Wizard Hat Base | Michael Whitlock (bigbeargames), Tuomo Untinen (reemax), JaidynReiman | CC-BY-SA 3.0, GPL 2.0, GPL 3.0 |
| magier | Simple staff | bluecarrot16, Dr. Jamgo | CC0 |
| waldlaeufer | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| waldlaeufer | Body color | Benjamin K. Smith (BenCreating), bluecarrot16, TheraHedwig, Evert, MuffinElZangano, Durrani, Pierre Vigier (pvigier), ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| waldlaeufer | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Sander Frenken (castelonia), Benjamin K. Smith (BenCreating), Eliza Wyatt (ElizaWy), dalonedrau, Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| waldlaeufer | Body color | bluecarrot16, Evert, TheraHedwig, Benjamin K. Smith (BenCreating), MuffinElZangano, Durrani, Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| waldlaeufer | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Benjamin K. Smith (BenCreating), Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| waldlaeufer | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), ElizaWy, MuffinElZangano, Durrani, Nila122, kheftel, Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| waldlaeufer | Human male | bluecarrot16, Benjamin K. Smith (BenCreating), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| waldlaeufer | Plain | Manuel Riecke (MrBeast), Joe White | CC-BY-SA 3.0, GPL 3.0 |
| waldlaeufer | Pants | bluecarrot16, JaidynReiman, ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, GPL 3.0, CC-BY-SA 3.0 |
| waldlaeufer | Pants | bluecarrot16, JaidynReiman, ElizaWy, Joe White, Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, GPL 3.0, CC-BY-SA 3.0 |
| waldlaeufer | Boots | bluecarrot16, Nila122 | OGA-BY 3.0, CC-BY-SA 3.0, GPL 2.0, GPL 3.0 |
| waldlaeufer | Boots | bluecarrot16, Nila122 | OGA-BY 3.0, CC-BY-SA 3.0, GPL 2.0, GPL 3.0 |
| waldlaeufer | Leather | Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| waldlaeufer | Leather | adapted to v3 bases by bluecarrot16 | Michael Whitlock (bigbeargames), Matthew Krohn (makrohn), Johannes Sjölund (wulax) |
| waldlaeufer | Hood | Johannes Sjölund (wulax), JaidynReiman | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| waldlaeufer | Recurve | Daniel Eddeland (daneeklu), gr3yh47, Johannes Sjölund (wulax), Pierre Vigier (pvigier) | CC-BY-SA 3.0 |
| schurke | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| schurke | Body color | Benjamin K. Smith (BenCreating), bluecarrot16, TheraHedwig, Evert, MuffinElZangano, Durrani, Pierre Vigier (pvigier), ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| schurke | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Sander Frenken (castelonia), Benjamin K. Smith (BenCreating), Eliza Wyatt (ElizaWy), dalonedrau, Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| schurke | Body color | bluecarrot16, Evert, TheraHedwig, Benjamin K. Smith (BenCreating), MuffinElZangano, Durrani, Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| schurke | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Benjamin K. Smith (BenCreating), Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| schurke | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), ElizaWy, MuffinElZangano, Durrani, Nila122, kheftel, Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| schurke | Human male | bluecarrot16, Benjamin K. Smith (BenCreating), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| schurke | Pants | bluecarrot16, JaidynReiman, ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, GPL 3.0, CC-BY-SA 3.0 |
| schurke | Pants | bluecarrot16, JaidynReiman, ElizaWy, Joe White, Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, GPL 3.0, CC-BY-SA 3.0 |
| schurke | Boots | bluecarrot16, Nila122 | OGA-BY 3.0, CC-BY-SA 3.0, GPL 2.0, GPL 3.0 |
| schurke | Boots | bluecarrot16, Nila122 | OGA-BY 3.0, CC-BY-SA 3.0, GPL 2.0, GPL 3.0 |
| schurke | Leather | Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| schurke | Leather | adapted to v3 bases by bluecarrot16 | Michael Whitlock (bigbeargames), Matthew Krohn (makrohn), Johannes Sjölund (wulax) |
| schurke | Hood | Johannes Sjölund (wulax), JaidynReiman | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| schurke | Dagger | bluecarrot16, Johannes Sjölund (wulax), Matthew Krohn (makrohn) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| kleriker | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| kleriker | Body color | Benjamin K. Smith (BenCreating), bluecarrot16, TheraHedwig, Evert, MuffinElZangano, Durrani, Pierre Vigier (pvigier), ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| kleriker | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Sander Frenken (castelonia), Benjamin K. Smith (BenCreating), Eliza Wyatt (ElizaWy), dalonedrau, Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| kleriker | Body color | bluecarrot16, Evert, TheraHedwig, Benjamin K. Smith (BenCreating), MuffinElZangano, Durrani, Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| kleriker | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Benjamin K. Smith (BenCreating), Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| kleriker | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), ElizaWy, MuffinElZangano, Durrani, Nila122, kheftel, Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| kleriker | Human female | bluecarrot16, Benjamin K. Smith (BenCreating), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| kleriker | Plain | Manuel Riecke (MrBeast), Joe White | CC-BY-SA 3.0, GPL 3.0 |
| kleriker | Shoes | bluecarrot16, Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| kleriker | Shoes | Joe White, Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| kleriker | Mace | Johannes Sjölund (wulax), bluecarrot16 | OGA-BY 3.0, CC-BY-SA 3.0 |
| kleriker | Longsleeve | JaidynReiman, Johannes Sjölund (wulax) | CC-BY-SA 3.0, GPL 3.0 |
| kleriker | Longsleeve | bluecarrot16, ElizaWy, Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| kleriker | Longsleeve | bluecarrot16, ElizaWy, Stephen Challener (Redshrike) | OGA-BY 3.0, GPL 3.0 |
| kleriker | Longsleeve | bluecarrot16, ElizaWy | CC-BY-SA 3.0, GPL 3.0 |
| kleriker | Plain skirt | bluecarrot16, Pierre Vigier (pvigier), Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| runenweber | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| runenweber | Body color | Benjamin K. Smith (BenCreating), bluecarrot16, TheraHedwig, Evert, MuffinElZangano, Durrani, Pierre Vigier (pvigier), ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| runenweber | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Sander Frenken (castelonia), Benjamin K. Smith (BenCreating), Eliza Wyatt (ElizaWy), dalonedrau, Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| runenweber | Body color | bluecarrot16, Evert, TheraHedwig, Benjamin K. Smith (BenCreating), MuffinElZangano, Durrani, Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| runenweber | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Benjamin K. Smith (BenCreating), Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| runenweber | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), ElizaWy, MuffinElZangano, Durrani, Nila122, kheftel, Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| runenweber | Human female | bluecarrot16, Benjamin K. Smith (BenCreating), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| runenweber | Plain | Manuel Riecke (MrBeast), Joe White | CC-BY-SA 3.0, GPL 3.0 |
| runenweber | Pants | bluecarrot16, JaidynReiman, ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, GPL 3.0, CC-BY-SA 3.0 |
| runenweber | Pants | bluecarrot16, JaidynReiman, ElizaWy, Joe White, Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, GPL 3.0, CC-BY-SA 3.0 |
| runenweber | Shoes | bluecarrot16, Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| runenweber | Shoes | Joe White, Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| runenweber | Robe | Luke Mehl | CC-BY-SA 3.0, GPL 3.0 |
| runenweber | Hood | Johannes Sjölund (wulax), JaidynReiman | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| runenweber | Simple staff | bluecarrot16, Dr. Jamgo | CC0 |
| scherge | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| scherge | Body color | Benjamin K. Smith (BenCreating), bluecarrot16, TheraHedwig, Evert, MuffinElZangano, Durrani, Pierre Vigier (pvigier), ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| scherge | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Sander Frenken (castelonia), Benjamin K. Smith (BenCreating), Eliza Wyatt (ElizaWy), dalonedrau, Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| scherge | Body color | bluecarrot16, Evert, TheraHedwig, Benjamin K. Smith (BenCreating), MuffinElZangano, Durrani, Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| scherge | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Benjamin K. Smith (BenCreating), Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| scherge | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), ElizaWy, MuffinElZangano, Durrani, Nila122, kheftel, Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| scherge | Goblin | bluecarrot16, Stephen Challener (Redshrike), William.Thomsponj | OGA-BY 3.0, CC-BY 4.0, GPL 2.0, GPL 3.0 |
| scherge | Pants | bluecarrot16, JaidynReiman, ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, GPL 3.0, CC-BY-SA 3.0 |
| scherge | Pants | bluecarrot16, JaidynReiman, ElizaWy, Joe White, Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, GPL 3.0, CC-BY-SA 3.0 |
| scherge | Boots | bluecarrot16, Nila122 | OGA-BY 3.0, CC-BY-SA 3.0, GPL 2.0, GPL 3.0 |
| scherge | Boots | bluecarrot16, Nila122 | OGA-BY 3.0, CC-BY-SA 3.0, GPL 2.0, GPL 3.0 |
| scherge | Leather | Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| scherge | Leather | adapted to v3 bases by bluecarrot16 | Michael Whitlock (bigbeargames), Matthew Krohn (makrohn), Johannes Sjölund (wulax) |
| scherge | Mace | Johannes Sjölund (wulax), bluecarrot16 | OGA-BY 3.0, CC-BY-SA 3.0 |
| hetzer | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| hetzer | Body color | Benjamin K. Smith (BenCreating), bluecarrot16, TheraHedwig, Evert, MuffinElZangano, Durrani, Pierre Vigier (pvigier), ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| hetzer | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Sander Frenken (castelonia), Benjamin K. Smith (BenCreating), Eliza Wyatt (ElizaWy), dalonedrau, Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| hetzer | Body color | bluecarrot16, Evert, TheraHedwig, Benjamin K. Smith (BenCreating), MuffinElZangano, Durrani, Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| hetzer | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Benjamin K. Smith (BenCreating), Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| hetzer | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), ElizaWy, MuffinElZangano, Durrani, Nila122, kheftel, Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| hetzer | Wolf male | bluecarrot16, Sander Frenken (castelonia), Benjamin K. Smith (BenCreating), William.Thompsonj, Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| hetzer | Pants | bluecarrot16, JaidynReiman, ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, GPL 3.0, CC-BY-SA 3.0 |
| hetzer | Pants | bluecarrot16, JaidynReiman, ElizaWy, Joe White, Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, GPL 3.0, CC-BY-SA 3.0 |
| hetzer | Boots | bluecarrot16, Nila122 | OGA-BY 3.0, CC-BY-SA 3.0, GPL 2.0, GPL 3.0 |
| hetzer | Boots | bluecarrot16, Nila122 | OGA-BY 3.0, CC-BY-SA 3.0, GPL 2.0, GPL 3.0 |
| hetzer | Leather | Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| hetzer | Leather | adapted to v3 bases by bluecarrot16 | Michael Whitlock (bigbeargames), Matthew Krohn (makrohn), Johannes Sjölund (wulax) |
| hetzer | Dagger | bluecarrot16, Johannes Sjölund (wulax), Matthew Krohn (makrohn) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| schuetze | Skeleton | bluecarrot16, Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| schuetze | Skeleton | bluecarrot16, Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| schuetze | Pants | bluecarrot16, JaidynReiman, ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, GPL 3.0, CC-BY-SA 3.0 |
| schuetze | Pants | bluecarrot16, JaidynReiman, ElizaWy, Joe White, Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, GPL 3.0, CC-BY-SA 3.0 |
| schuetze | Normal | walk animations by pvigier | split into layers and tweaked for v3 character bases by bluecarrot16. pvigier has agreed to license this sheet as OGA-BY 3.0+. |
| schwarmling | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| schwarmling | Body color | Benjamin K. Smith (BenCreating), bluecarrot16, TheraHedwig, Evert, MuffinElZangano, Durrani, Pierre Vigier (pvigier), ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| schwarmling | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Sander Frenken (castelonia), Benjamin K. Smith (BenCreating), Eliza Wyatt (ElizaWy), dalonedrau, Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| schwarmling | Body color | bluecarrot16, Evert, TheraHedwig, Benjamin K. Smith (BenCreating), MuffinElZangano, Durrani, Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| schwarmling | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Benjamin K. Smith (BenCreating), Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| schwarmling | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), ElizaWy, MuffinElZangano, Durrani, Nila122, kheftel, Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| schwarmling | Goblin child | bluecarrot16, Stephen Challener (Redshrike), William.Thomsponj | OGA-BY 3.0, CC-BY 4.0, GPL 2.0, GPL 3.0 |
| brecher | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| brecher | Body color | Benjamin K. Smith (BenCreating), bluecarrot16, TheraHedwig, Evert, MuffinElZangano, Durrani, Pierre Vigier (pvigier), ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| brecher | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Sander Frenken (castelonia), Benjamin K. Smith (BenCreating), Eliza Wyatt (ElizaWy), dalonedrau, Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| brecher | Body color | bluecarrot16, Evert, TheraHedwig, Benjamin K. Smith (BenCreating), MuffinElZangano, Durrani, Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| brecher | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Benjamin K. Smith (BenCreating), Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| brecher | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), ElizaWy, MuffinElZangano, Durrani, Nila122, kheftel, Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| brecher | Minotaur | Evert, Nila122, Daniel Eddeland (daneeklu) | CC-BY-SA 3.0, GPL 3.0 |
| brecher | Armour | bluecarrot16, Michael Whitlock (bigbeargames), Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| brecher | Boots Metal Plating | JaidynReiman | OGA-BY 3.0+, CC-BY 3.0+, GPL 3.0 |
| brecher | Plate | recolor by bigbeargames | color reduced to 7 colors and adapted to v3 bases by bluecarrot16 |
| brecher | Plate | adapted to female base by makrohn | recolor by bigbeargames |
| brecher | Plate | color reduced to 7 colors and adapted to v3 bases by bluecarrot16 | adapted to teen base from male/female by JaidynReiman |
| brecher | Mace | Johannes Sjölund (wulax), bluecarrot16 | OGA-BY 3.0, CC-BY-SA 3.0 |
| priester | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| priester | Body color | Benjamin K. Smith (BenCreating), bluecarrot16, TheraHedwig, Evert, MuffinElZangano, Durrani, Pierre Vigier (pvigier), ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| priester | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Sander Frenken (castelonia), Benjamin K. Smith (BenCreating), Eliza Wyatt (ElizaWy), dalonedrau, Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| priester | Body color | bluecarrot16, Evert, TheraHedwig, Benjamin K. Smith (BenCreating), MuffinElZangano, Durrani, Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| priester | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Benjamin K. Smith (BenCreating), Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| priester | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), ElizaWy, MuffinElZangano, Durrani, Nila122, kheftel, Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| priester | Human female | bluecarrot16, Benjamin K. Smith (BenCreating), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| priester | Pants | bluecarrot16, JaidynReiman, ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, GPL 3.0, CC-BY-SA 3.0 |
| priester | Pants | bluecarrot16, JaidynReiman, ElizaWy, Joe White, Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, GPL 3.0, CC-BY-SA 3.0 |
| priester | Shoes | bluecarrot16, Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| priester | Shoes | Joe White, Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| priester | Robe | Luke Mehl | CC-BY-SA 3.0, GPL 3.0 |
| priester | Hood | Johannes Sjölund (wulax), JaidynReiman | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| priester | Simple staff | bluecarrot16, Dr. Jamgo | CC0 |
| kultist | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| kultist | Body color | Benjamin K. Smith (BenCreating), bluecarrot16, TheraHedwig, Evert, MuffinElZangano, Durrani, Pierre Vigier (pvigier), ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| kultist | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Sander Frenken (castelonia), Benjamin K. Smith (BenCreating), Eliza Wyatt (ElizaWy), dalonedrau, Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| kultist | Body color | bluecarrot16, Evert, TheraHedwig, Benjamin K. Smith (BenCreating), MuffinElZangano, Durrani, Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| kultist | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Benjamin K. Smith (BenCreating), Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| kultist | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), ElizaWy, MuffinElZangano, Durrani, Nila122, kheftel, Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| kultist | Human male | bluecarrot16, Benjamin K. Smith (BenCreating), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| kultist | Pants | bluecarrot16, JaidynReiman, ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, GPL 3.0, CC-BY-SA 3.0 |
| kultist | Pants | bluecarrot16, JaidynReiman, ElizaWy, Joe White, Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, GPL 3.0, CC-BY-SA 3.0 |
| kultist | Shoes | bluecarrot16, Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| kultist | Shoes | Joe White, Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| kultist | Longsleeve | JaidynReiman, Johannes Sjölund (wulax) | CC-BY-SA 3.0, GPL 3.0 |
| kultist | Longsleeve | bluecarrot16, ElizaWy, Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| kultist | Longsleeve | bluecarrot16, ElizaWy, Stephen Challener (Redshrike) | OGA-BY 3.0, GPL 3.0 |
| kultist | Longsleeve | bluecarrot16, ElizaWy | CC-BY-SA 3.0, GPL 3.0 |
| kultist | Hood | Johannes Sjölund (wulax), JaidynReiman | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| kultist | Dagger | bluecarrot16, Johannes Sjölund (wulax), Matthew Krohn (makrohn) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| bomber | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| bomber | Body color | Benjamin K. Smith (BenCreating), bluecarrot16, TheraHedwig, Evert, MuffinElZangano, Durrani, Pierre Vigier (pvigier), ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| bomber | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Sander Frenken (castelonia), Benjamin K. Smith (BenCreating), Eliza Wyatt (ElizaWy), dalonedrau, Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| bomber | Body color | bluecarrot16, Evert, TheraHedwig, Benjamin K. Smith (BenCreating), MuffinElZangano, Durrani, Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| bomber | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Benjamin K. Smith (BenCreating), Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| bomber | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), ElizaWy, MuffinElZangano, Durrani, Nila122, kheftel, Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| bomber | Goblin | bluecarrot16, Stephen Challener (Redshrike), William.Thomsponj | OGA-BY 3.0, CC-BY 4.0, GPL 2.0, GPL 3.0 |
| bomber | Plain | Manuel Riecke (MrBeast), Joe White | CC-BY-SA 3.0, GPL 3.0 |
| bomber | Pants | bluecarrot16, JaidynReiman, ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, GPL 3.0, CC-BY-SA 3.0 |
| bomber | Pants | bluecarrot16, JaidynReiman, ElizaWy, Joe White, Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, GPL 3.0, CC-BY-SA 3.0 |
| bomber | Boots | bluecarrot16, Nila122 | OGA-BY 3.0, CC-BY-SA 3.0, GPL 2.0, GPL 3.0 |
| bomber | Boots | bluecarrot16, Nila122 | OGA-BY 3.0, CC-BY-SA 3.0, GPL 2.0, GPL 3.0 |
| bomber | Shortsleeve | bluecarrot16, ElizaWy, Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| bomber | Shortsleeve | bluecarrot16, ElizaWy, Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| bomber | Shortsleeve | Nyom, bluecarrot16, ElizaWy, Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| bomber | Shortsleeve | bluecarrot16, ElizaWy, Stephen Challener (Redshrike) | OGA-BY 3.0, GPL 3.0 |
| bomber | Square pack | Benjamin K. Smith (BenCreating), macmanmatty | CC-BY-SA 3.0, GPL 3.0 |
| waechter | Skeleton | bluecarrot16, Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| waechter | Skeleton | bluecarrot16, Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| waechter | Armour | bluecarrot16, Michael Whitlock (bigbeargames), Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| waechter | Legion | JaidynReiman, bluecarrot16, Nila122 | OGA-BY 3.0, CC-BY-SA 3.0, GPL 2.0, GPL 3.0 |
| waechter | Spear | walk animations redone by pvigier | split into layers and tweaked for v3 character bases by bluecarrot16 |
| ignarch | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| ignarch | Body color | Benjamin K. Smith (BenCreating), bluecarrot16, TheraHedwig, Evert, MuffinElZangano, Durrani, Pierre Vigier (pvigier), ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| ignarch | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Sander Frenken (castelonia), Benjamin K. Smith (BenCreating), Eliza Wyatt (ElizaWy), dalonedrau, Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| ignarch | Body color | bluecarrot16, Evert, TheraHedwig, Benjamin K. Smith (BenCreating), MuffinElZangano, Durrani, Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| ignarch | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Benjamin K. Smith (BenCreating), Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| ignarch | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), ElizaWy, MuffinElZangano, Durrani, Nila122, kheftel, Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| ignarch | Minotaur | Evert, Nila122, Daniel Eddeland (daneeklu) | CC-BY-SA 3.0, GPL 3.0 |
| ignarch | Armour | bluecarrot16, Michael Whitlock (bigbeargames), Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| ignarch | Boots Metal Plating | JaidynReiman | OGA-BY 3.0+, CC-BY 3.0+, GPL 3.0 |
| ignarch | Plate | recolor by bigbeargames | color reduced to 7 colors and adapted to v3 bases by bluecarrot16 |
| ignarch | Plate | adapted to female base by makrohn | recolor by bigbeargames |
| ignarch | Plate | color reduced to 7 colors and adapted to v3 bases by bluecarrot16 | adapted to teen base from male/female by JaidynReiman |
| ignarch | Mace | Johannes Sjölund (wulax), bluecarrot16 | OGA-BY 3.0, CC-BY-SA 3.0 |
| glaciara | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| glaciara | Body color | Benjamin K. Smith (BenCreating), bluecarrot16, TheraHedwig, Evert, MuffinElZangano, Durrani, Pierre Vigier (pvigier), ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| glaciara | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Sander Frenken (castelonia), Benjamin K. Smith (BenCreating), Eliza Wyatt (ElizaWy), dalonedrau, Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| glaciara | Body color | bluecarrot16, Evert, TheraHedwig, Benjamin K. Smith (BenCreating), MuffinElZangano, Durrani, Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| glaciara | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Benjamin K. Smith (BenCreating), Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| glaciara | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), ElizaWy, MuffinElZangano, Durrani, Nila122, kheftel, Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| glaciara | Vampire | gaunt version by bluecarrot16 | vampire fangs by bluecarrot16 |
| glaciara | Long | Manuel Riecke (MrBeast) | CC-BY-SA 3.0, GPL 3.0 |
| glaciara | Pants | bluecarrot16, JaidynReiman, ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, GPL 3.0, CC-BY-SA 3.0 |
| glaciara | Pants | bluecarrot16, JaidynReiman, ElizaWy, Joe White, Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, GPL 3.0, CC-BY-SA 3.0 |
| glaciara | Shoes | bluecarrot16, Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| glaciara | Shoes | Joe White, Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| glaciara | Robe | Luke Mehl | CC-BY-SA 3.0, GPL 3.0 |
| glaciara | Bat Wings | ElizaWy, JaidynReiman | OGA-BY 3.0 |
| glaciara | Simple staff | bluecarrot16, Dr. Jamgo | CC0 |
| voltrax | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| voltrax | Body color | Benjamin K. Smith (BenCreating), bluecarrot16, TheraHedwig, Evert, MuffinElZangano, Durrani, Pierre Vigier (pvigier), ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| voltrax | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Sander Frenken (castelonia), Benjamin K. Smith (BenCreating), Eliza Wyatt (ElizaWy), dalonedrau, Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| voltrax | Body color | bluecarrot16, Evert, TheraHedwig, Benjamin K. Smith (BenCreating), MuffinElZangano, Durrani, Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| voltrax | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Benjamin K. Smith (BenCreating), Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| voltrax | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), ElizaWy, MuffinElZangano, Durrani, Nila122, kheftel, Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| voltrax | Lizard male | bluecarrot16, Benjamin K. Smith (BenCreating), Nila122 | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| voltrax | Armour | bluecarrot16, Michael Whitlock (bigbeargames), Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| voltrax | Boots Metal Plating | JaidynReiman | OGA-BY 3.0+, CC-BY 3.0+, GPL 3.0 |
| voltrax | Legion | JaidynReiman, bluecarrot16, Nila122 | OGA-BY 3.0, CC-BY-SA 3.0, GPL 2.0, GPL 3.0 |
| voltrax | Spear | walk animations redone by pvigier | split into layers and tweaked for v3 character bases by bluecarrot16 |
| gorthul | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| gorthul | Body color | Benjamin K. Smith (BenCreating), bluecarrot16, TheraHedwig, Evert, MuffinElZangano, Durrani, Pierre Vigier (pvigier), ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| gorthul | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Sander Frenken (castelonia), Benjamin K. Smith (BenCreating), Eliza Wyatt (ElizaWy), dalonedrau, Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| gorthul | Body color | bluecarrot16, Evert, TheraHedwig, Benjamin K. Smith (BenCreating), MuffinElZangano, Durrani, Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| gorthul | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Benjamin K. Smith (BenCreating), Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| gorthul | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), ElizaWy, MuffinElZangano, Durrani, Nila122, kheftel, Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| gorthul | Troll | bluecarrot16, AntumDeluge, Tuomo Untinen (reemax) | CC-BY 3.0 |
| gorthul | Armour | bluecarrot16, Michael Whitlock (bigbeargames), Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| gorthul | Boots Metal Plating | JaidynReiman | OGA-BY 3.0+, CC-BY 3.0+, GPL 3.0 |
| gorthul | Plate | recolor by bigbeargames | color reduced to 7 colors and adapted to v3 bases by bluecarrot16 |
| gorthul | Plate | adapted to female base by makrohn | recolor by bigbeargames |
| gorthul | Plate | color reduced to 7 colors and adapted to v3 bases by bluecarrot16 | adapted to teen base from male/female by JaidynReiman |
| gorthul | Mace | Johannes Sjölund (wulax), bluecarrot16 | OGA-BY 3.0, CC-BY-SA 3.0 |
| solaris | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| solaris | Body color | Benjamin K. Smith (BenCreating), bluecarrot16, TheraHedwig, Evert, MuffinElZangano, Durrani, Pierre Vigier (pvigier), ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| solaris | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Sander Frenken (castelonia), Benjamin K. Smith (BenCreating), Eliza Wyatt (ElizaWy), dalonedrau, Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| solaris | Body color | bluecarrot16, Evert, TheraHedwig, Benjamin K. Smith (BenCreating), MuffinElZangano, Durrani, Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| solaris | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Benjamin K. Smith (BenCreating), Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| solaris | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), ElizaWy, MuffinElZangano, Durrani, Nila122, kheftel, Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| solaris | Human male | bluecarrot16, Benjamin K. Smith (BenCreating), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| solaris | Plain | Manuel Riecke (MrBeast), Joe White | CC-BY-SA 3.0, GPL 3.0 |
| solaris | Armour | bluecarrot16, Michael Whitlock (bigbeargames), Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| solaris | Boots Metal Plating | JaidynReiman | OGA-BY 3.0+, CC-BY 3.0+, GPL 3.0 |
| solaris | Plate | recolor by bigbeargames | color reduced to 7 colors and adapted to v3 bases by bluecarrot16 |
| solaris | Plate | adapted to female base by makrohn | recolor by bigbeargames |
| solaris | Plate | color reduced to 7 colors and adapted to v3 bases by bluecarrot16 | adapted to teen base from male/female by JaidynReiman |
| solaris | Feathered Wings | ElizaWy, Stephen Challener (Redshrike), JaidynReiman | OGA-BY 3.0 |
| solaris | Spear | walk animations redone by pvigier | split into layers and tweaked for v3 character bases by bluecarrot16 |
| nyxhara | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| nyxhara | Body color | Benjamin K. Smith (BenCreating), bluecarrot16, TheraHedwig, Evert, MuffinElZangano, Durrani, Pierre Vigier (pvigier), ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| nyxhara | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Sander Frenken (castelonia), Benjamin K. Smith (BenCreating), Eliza Wyatt (ElizaWy), dalonedrau, Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| nyxhara | Body color | bluecarrot16, Evert, TheraHedwig, Benjamin K. Smith (BenCreating), MuffinElZangano, Durrani, Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| nyxhara | Body color | bluecarrot16, Evert, TheraHedwig, MuffinElZangano, Durrani, Benjamin K. Smith (BenCreating), Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Matthew Krohn (makrohn), Johannes Sj?lund (wulax), Stephen Challener (Redshrike) | CC-BY-SA 3.0, GPL 3.0 |
| nyxhara | Body color | bluecarrot16, Benjamin K. Smith (BenCreating), ElizaWy, MuffinElZangano, Durrani, Nila122, kheftel, Stephen Challener (Redshrike) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| nyxhara | Vampire | gaunt version by bluecarrot16 | vampire fangs by bluecarrot16 |
| nyxhara | Long | Manuel Riecke (MrBeast) | CC-BY-SA 3.0, GPL 3.0 |
| nyxhara | Pants | bluecarrot16, JaidynReiman, ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, GPL 3.0, CC-BY-SA 3.0 |
| nyxhara | Pants | bluecarrot16, JaidynReiman, ElizaWy, Joe White, Matthew Krohn (makrohn), Johannes Sjölund (wulax) | OGA-BY 3.0, GPL 3.0, CC-BY-SA 3.0 |
| nyxhara | Shoes | bluecarrot16, Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| nyxhara | Shoes | Joe White, Johannes Sjölund (wulax) | OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 |
| nyxhara | Robe | Luke Mehl | CC-BY-SA 3.0, GPL 3.0 |
| nyxhara | Bat Wings | ElizaWy, JaidynReiman | OGA-BY 3.0 |
| nyxhara | Simple staff | bluecarrot16, Dr. Jamgo | CC0 |

<!-- sprites:ende -->
