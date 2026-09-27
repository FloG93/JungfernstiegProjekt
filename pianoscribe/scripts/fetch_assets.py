"""Lädt die nicht eingecheckten Assets: Salamander-Piano-Samples und (unter Windows) ffmpeg.

Aufruf (aus pianoscribe/backend):  uv run python ../scripts/fetch_assets.py [--ffmpeg] [--samples]
Ohne Optionen wird alles geladen, was auf dieser Plattform gebraucht wird.
"""

from __future__ import annotations

import argparse
import io
import shutil
import sys
import zipfile
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"

# Salamander Grand Piano V3 (Alexander Holm, CC-BY 3.0), reduzierte Auswahl
# aus dem Tone.js-Projekt: jede kleine Terz, eine Velocity-Stufe.
SAMPLES_BASE_URL = "https://tonejs.github.io/audio/salamander/"
SAMPLE_NOTES = [
    "A0", "C1", "Ds1", "Fs1", "A1", "C2", "Ds2", "Fs2", "A2", "C3", "Ds3", "Fs3",
    "A3", "C4", "Ds4", "Fs4", "A4", "C5", "Ds5", "Fs5", "A5", "C6", "Ds6", "Fs6",
    "A6", "C7", "Ds7", "Fs7", "A7", "C8",
]
SAMPLES_LICENSE = """Salamander Grand Piano V3
Copyright (c) Alexander Holm
Lizenz: Creative Commons Attribution 3.0 Unported (CC BY 3.0)
https://creativecommons.org/licenses/by/3.0/
Quelle der reduzierten Auswahl: https://tonejs.github.io/audio/salamander/
"""

# Statischer ffmpeg-Build für Windows (gyan.dev, "essentials").
FFMPEG_WIN_URL = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"


def _client() -> httpx.Client:
    return httpx.Client(follow_redirects=True, timeout=httpx.Timeout(60.0, connect=20.0))


def fetch_samples(force: bool = False) -> None:
    target = ASSETS / "samples" / "salamander"
    target.mkdir(parents=True, exist_ok=True)
    with _client() as client:
        for note in SAMPLE_NOTES:
            path = target / f"{note}.mp3"
            if path.exists() and path.stat().st_size > 0 and not force:
                continue
            response = client.get(SAMPLES_BASE_URL + f"{note}.mp3")
            response.raise_for_status()
            path.write_bytes(response.content)
            print(f"  {path.name} ({len(response.content) // 1024} KB)")
    (target / "LICENSE.txt").write_text(SAMPLES_LICENSE, encoding="utf-8")
    print(f"Samples bereit: {target}")


def fetch_ffmpeg_windows(force: bool = False) -> None:
    target = ASSETS / "ffmpeg" / "ffmpeg.exe"
    if target.exists() and not force:
        print(f"ffmpeg vorhanden: {target}")
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    print(f"Lade {FFMPEG_WIN_URL} …")
    with _client() as client:
        response = client.get(FFMPEG_WIN_URL)
        response.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        members = {Path(name).name: name for name in archive.namelist()}
        for wanted in ("ffmpeg.exe", "LICENSE"):
            name = members.get(wanted)
            if name is None:
                continue
            with archive.open(name) as src, open(target.parent / wanted, "wb") as dst:
                shutil.copyfileobj(src, dst)
    if not target.exists():
        raise SystemExit("ffmpeg.exe nicht im Archiv gefunden")
    print(f"ffmpeg bereit: {target}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", action="store_true", help="nur die Piano-Samples laden")
    parser.add_argument("--ffmpeg", action="store_true", help="nur ffmpeg (Windows) laden")
    parser.add_argument("--force", action="store_true", help="vorhandene Dateien überschreiben")
    args = parser.parse_args(argv)
    everything = not (args.samples or args.ffmpeg)
    if args.samples or everything:
        fetch_samples(args.force)
    if args.ffmpeg or (everything and sys.platform == "win32"):
        fetch_ffmpeg_windows(args.force)
    elif everything:
        print("ffmpeg: unter Linux/macOS das System-ffmpeg verwenden (z. B. apt install ffmpeg).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
