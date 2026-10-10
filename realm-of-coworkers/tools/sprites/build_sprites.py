#!/usr/bin/env python3
"""Baut die Sprite-Atlanten aus dem Universal-LPC-Baukasten (OPEN-051).

    pnpm sprites                      # braucht LPC_DIR oder --lpc
    python3 tools/sprites/build_sprites.py --lpc ~/Universal-LPC-...  --vorschau

Quelle ist ein Klon von https://github.com/sanderfrenken/Universal-LPC-Spritesheet-Character-Generator
(ein `git clone --depth 1 --filter=blob:none --no-checkout` genügt, die Dateien werden per `git show`
gelesen). Ergebnis: je Figur ein PNG mit festem Raster plus `atlas.json`; die Lizenzangaben der
benutzten Ebenen landen in `packages/content/ASSETS.md`.

Das Spiel braucht nur den klassischen Bereich der Blätter (Zeilen 0 bis 20):
Zaubern, Stoß, Laufen, Hieb, Schuss, Treffer. Jede Gruppe hat vier Richtungen (Norden, Westen,
Süden, Osten); „Treffer“ gibt es nur nach Süden.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover - Hinweis für Mitwirkende
    sys.exit("Pillow fehlt: pip install Pillow")

KACHEL = 64
SPALTEN = 13
#: Erste Zeile und Bildanzahl je Animation im Quellblatt.
QUELLE = {
    "cast": (0, 7),
    "thrust": (4, 8),
    "walk": (8, 9),
    "slash": (12, 6),
    "shoot": (16, 13),
    "hurt": (20, 6),
}
QUELL_ZEILEN = 21
RICHTUNGEN = ["n", "w", "s", "e"]
#: Zeilen des erzeugten Atlas in fester Reihenfolge.
#: „Zaubern“ nutzt dieselben Bilder wie der Angriff: In den LPC-Zauberzeilen hält die Figur keine Waffe (OPEN-052).
ZIEL = [("walk", d) for d in RICHTUNGEN] + [("attack", d) for d in RICHTUNGEN] + [("hurt", "s")]
GRUPPEN = ("helden", "gegner", "bosse")
WURZEL = Path(__file__).resolve().parents[2]
AUSGABE = WURZEL / "apps/client/public/sprites"
ASSETS_MD = WURZEL / "packages/content/ASSETS.md"
MARKE = "<!-- sprites:anfang -->"
MARKE_ENDE = "<!-- sprites:ende -->"


@dataclass
class Ebene:
    pfad: str
    z: int
    blatt: str


class Baukasten:
    """Liest Blattdefinitionen und Bilder aus dem Klon, auch ohne Arbeitskopie."""

    def __init__(self, wurzel: Path):
        self.wurzel = wurzel
        self._cache: dict[str, bytes] = {}
        if not (wurzel / ".git").exists() and not (wurzel / "sheet_definitions").exists():
            sys.exit(f"{wurzel} sieht nicht nach dem LPC-Baukasten aus.")

    def lies(self, pfad: str) -> bytes | None:
        if pfad in self._cache:
            return self._cache[pfad]
        datei = self.wurzel / pfad
        if datei.exists():
            daten = datei.read_bytes()
        else:
            fertig = subprocess.run(
                ["git", "-C", str(self.wurzel), "show", f"HEAD:{pfad}"],
                capture_output=True,
            )
            if fertig.returncode != 0:
                return None
            daten = fertig.stdout
        self._cache[pfad] = daten
        return daten

    def definition(self, blatt: str) -> dict:
        daten = self.lies(f"sheet_definitions/{blatt}.json")
        if daten is None:
            sys.exit(f"Blatt {blatt} gibt es nicht (sheet_definitions/{blatt}.json).")
        return json.loads(daten)

    def bild(self, pfad: str) -> Image.Image | None:
        daten = self.lies(f"spritesheets/{pfad}")
        if daten is None:
            return None
        return Image.open(BytesIO(daten)).convert("RGBA")


def ebenen_der_figur(bk: Baukasten, figur: dict) -> tuple[list[Ebene], list[dict]]:
    """Alle Bildebenen einer Figur mit z-Lage, dazu die Lizenzangaben der benutzten Blätter."""
    koerper = figur["koerper"]
    ebenen: list[Ebene] = []
    quellen: list[dict] = []
    for eintrag in figur["ebenen"]:
        blatt, variante = eintrag["blatt"], eintrag["variante"]
        d = bk.definition(blatt)
        varianten = d.get("variants") or []
        if varianten and variante not in varianten:
            sys.exit(f"{figur['id']}: Variante '{variante}' gibt es in {blatt} nicht. Möglich: {', '.join(varianten[:12])} …")
        lagen = [(k, v) for k, v in sorted(d.items()) if k.startswith("layer_")]
        koerperformen = {k for _, v in lagen for k in v if k != "zPos"}
        if koerperformen and koerper not in koerperformen:
            sys.exit(f"{figur['id']}: {blatt} gibt es nicht für Körper '{koerper}', nur für {', '.join(sorted(koerperformen))}.")
        gefunden = False
        for _, lage in lagen:
            ordner = lage.get(koerper)
            if not ordner:
                continue
            ordner = ordner if ordner.endswith("/") else ordner + "/"  # im Baukasten fehlt er manchmal
            # Dateinamen schreiben Leerzeichen als Unterstrich ("dark brown" → "dark_brown.png")
            for name in (variante, variante.replace(" ", "_")):
                pfad = f"{ordner}{name}.png"
                if bk.lies(f"spritesheets/{pfad}") is not None:
                    ebenen.append(Ebene(pfad, int(lage.get("zPos", 50)), blatt))
                    gefunden = True
                    break
        if not gefunden:
            sys.exit(f"{figur['id']}: keine Bilddatei für {blatt} ({variante}, Körper {koerper}).")
        quellen.append({"blatt": blatt, "name": d.get("name", blatt), "credits": d.get("credits", [])})
    ebenen.sort(key=lambda e: e.z)
    return ebenen, quellen


def grundblatt(bk: Baukasten, ebenen: list[Ebene]) -> Image.Image:
    """Alle Ebenen übereinander, nur der klassische Bereich (Zeilen 0 bis 20)."""
    hoehe = QUELL_ZEILEN * KACHEL
    ziel = Image.new("RGBA", (SPALTEN * KACHEL, hoehe), (0, 0, 0, 0))
    for e in ebenen:
        im = bk.bild(e.pfad)
        if im is None or im.width != SPALTEN * KACHEL:
            continue  # Sonderblätter (z. B. 128-px-Angriffe) passen nicht ins Raster
        ziel.alpha_composite(im.crop((0, 0, ziel.width, min(hoehe, im.height))), (0, 0))
    return ziel


def angriff_pruefen(bk: Baukasten, figur: dict, ebenen: list[Ebene]) -> None:
    """Nicht jedes LPC-Blatt deckt jede Animation ab: Roben haben keine Stoßbilder, viele Waffen nur
    128-px-Sonderblätter für den Hieb (OPEN-052). Ohne Prüfung kämpfte die Figur nackt oder mit leerer Hand."""
    erste, bilder = QUELLE[figur["angriff"]]
    oben, unten = erste * KACHEL, (erste + len(RICHTUNGEN)) * KACHEL
    # Je Ausrüstungsteil, nicht je Ebene: Waffen haben Vorder- und Hintergrundebenen, eine davon darf leer sein.
    sichtbar: dict[str, bool] = {}
    for e in ebenen:
        im = bk.bild(e.pfad)
        if im is None or im.width != SPALTEN * KACHEL:
            continue
        da = im.crop((0, oben, bilder * KACHEL, min(im.height, unten))).getbbox() is not None
        sichtbar[e.blatt] = sichtbar.get(e.blatt, False) or da
    fehlt = [blatt for blatt, da in sichtbar.items() if not da]
    if fehlt:
        sys.exit(
            f"{figur['id']}: {', '.join(sorted(set(fehlt)))} fehlt bzw. fehlen in der Animation "
            f"'{figur['angriff']}'. Andere Ausrüstung oder Animation wählen (OPEN-052)."
        )


def atlas_der_figur(grund: Image.Image, angriff: str) -> tuple[Image.Image, int]:
    """Schneidet die gebrauchten Animationen in das feste Atlas-Raster."""
    _, angriff_bilder = QUELLE[angriff]
    atlas = Image.new("RGBA", (SPALTEN * KACHEL, len(ZIEL) * KACHEL), (0, 0, 0, 0))
    for ziel_zeile, (name, richtung) in enumerate(ZIEL):
        quelle = angriff if name == "attack" else name
        erste, bilder = QUELLE[quelle]
        zeile = erste if quelle == "hurt" else erste + RICHTUNGEN.index(richtung)
        aus = grund.crop((0, zeile * KACHEL, bilder * KACHEL, (zeile + 1) * KACHEL))
        atlas.paste(aus, (0, ziel_zeile * KACHEL))
    return atlas, angriff_bilder


def vorschau(figuren: dict[str, Image.Image], ziel: Path) -> None:  # noqa: D401
    """Ein Bild mit Lauf- und Angriffsbildern aller Figuren, dreifach vergrößert."""
    zeilen = [("walk", "e", 9), ("attack", "e", 13)]
    breite = 13 * KACHEL
    hoehe = len(figuren) * len(zeilen) * KACHEL
    bild = Image.new("RGBA", (breite, hoehe), (26, 22, 34, 255))
    y = 0
    for atlas in figuren.values():
        for name, richtung, _ in zeilen:
            idx = ZIEL.index((name, richtung))
            bild.paste(atlas.crop((0, idx * KACHEL, breite, (idx + 1) * KACHEL)), (0, y))
            y += KACHEL
    bild.resize((breite * 3, hoehe * 3), Image.NEAREST).save(ziel)


def lizenzen_schreiben(quellen: dict[str, list[dict]]) -> None:
    """Trägt Herkunft und Lizenz je benutztem Blatt in ASSETS.md ein."""
    zeilen = [
        MARKE,
        "",
        "## Sprites aus dem Universal-LPC-Baukasten (OPEN-051)",
        "",
        "Quelle: <https://github.com/sanderfrenken/Universal-LPC-Spritesheet-Character-Generator>,",
        "zusammengesetzt mit `tools/sprites/build_sprites.py` (`pnpm sprites`), Figurenliste in",
        "`tools/sprites/figuren.json`. Die Lizenztexte liegen in `packages/content/lizenzen/`.",
        "",
        "| Figur | Ebene | Urheber | Lizenz |",
        "| --- | --- | --- | --- |",
    ]
    for figur, blaetter in quellen.items():
        for b in blaetter:
            for c in b["credits"]:
                autoren = ", ".join(c.get("authors", [])) or "siehe Quelle"
                lizenz = ", ".join(c.get("licenses", [])) or "siehe Quelle"
                zeilen.append(f"| {figur} | {b['name']} | {autoren} | {lizenz} |")
    zeilen += ["", MARKE_ENDE, ""]
    neu = "\n".join(zeilen)
    text = ASSETS_MD.read_text(encoding="utf-8")
    if MARKE in text:
        vorher, rest = text.split(MARKE, 1)
        nachher = rest.split(MARKE_ENDE, 1)[1] if MARKE_ENDE in rest else ""
        text = vorher + neu + nachher.lstrip("\n")
    else:
        text = text.rstrip("\n") + "\n\n" + neu
    ASSETS_MD.write_text(text, encoding="utf-8")


def main() -> None:
    p = argparse.ArgumentParser(description="Sprite-Atlanten aus dem LPC-Baukasten bauen")
    p.add_argument("--lpc", default=None, help="Klon des LPC-Baukastens (sonst LPC_DIR)")
    p.add_argument("--vorschau", action="store_true", help="zusätzlich eine Vorschau als PNG")
    p.add_argument("--figuren", default=str(Path(__file__).with_name("figuren.json")))
    args = p.parse_args()

    import os

    pfad = args.lpc or os.environ.get("LPC_DIR")
    if not pfad:
        sys.exit("Bitte --lpc <Ordner> angeben oder LPC_DIR setzen (Klon des LPC-Baukastens).")
    bk = Baukasten(Path(pfad).expanduser().resolve())
    liste = json.loads(Path(args.figuren).read_text(encoding="utf-8"))
    AUSGABE.mkdir(parents=True, exist_ok=True)

    atlanten: dict[str, Image.Image] = {}
    quellen: dict[str, list[dict]] = {}
    meta: dict[str, dict] = {}
    gesamt = 0
    for gruppe in GRUPPEN:
        for figur in liste.get(gruppe, []):
            ebenen, q = ebenen_der_figur(bk, figur)
            angriff_pruefen(bk, figur, ebenen)
            atlas, bilder = atlas_der_figur(grundblatt(bk, ebenen), figur["angriff"])
            datei = AUSGABE / f"{figur['id']}.png"
            atlas.save(datei, optimize=True)
            atlanten[figur["id"]] = atlas
            quellen[figur["id"]] = q
            meta[figur["id"]] = {
                "gruppe": gruppe,
                "angriff": figur["angriff"],
                "angriffBilder": bilder,
                "skalierung": figur.get("skalierung", 1),
            }
            gesamt += datei.stat().st_size
            print(f"{figur['id']:14s} {len(ebenen):2d} Ebenen → {datei.relative_to(WURZEL)} ({datei.stat().st_size // 1024} KB)")
    print(f"{len(meta)} Figuren, zusammen {gesamt // 1024} KB")

    (AUSGABE / "atlas.json").write_text(
        json.dumps(
            {
                "kachel": KACHEL,
                "spalten": SPALTEN,
                "zeilen": [f"{n}-{r}" for n, r in ZIEL],
                "bilder": {n: QUELLE[n][1] for n in QUELLE},
                "figuren": meta,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    lizenzen_schreiben(quellen)
    if args.vorschau:
        vorschau(atlanten, AUSGABE.parent / "sprites-vorschau.png")
        print("Vorschau: apps/client/public/sprites-vorschau.png")


if __name__ == "__main__":
    main()
