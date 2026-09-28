"""Erzeugt ``pianoscribe.ico`` (Windows-Icon) aus ``pianoscribe.svg``.

Das Icon ist eingecheckt; das Skript braucht man nur nach Änderungen am SVG. Es benutzt
``rsvg-convert`` (librsvg) und packt die PNGs ohne weitere Abhängigkeiten in eine ICO-Datei.

Aufruf:  python packaging/make_icon.py
"""

from __future__ import annotations

import shutil
import struct
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SIZES = (16, 20, 24, 32, 40, 48, 64, 128, 256)


def render_png(svg: Path, size: int) -> bytes:
    return subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size), str(svg)],
                          check=True, capture_output=True).stdout


def build_ico(images: list[tuple[int, bytes]]) -> bytes:
    """ICO-Container mit PNG-Einträgen (seit Windows Vista unterstützt)."""
    header = struct.pack("<HHH", 0, 1, len(images))
    offset = len(header) + 16 * len(images)
    entries, blobs = b"", b""
    for size, png in images:
        dim = 0 if size >= 256 else size  # 0 steht für 256
        entries += struct.pack("<BBBBHHII", dim, dim, 0, 0, 1, 32, len(png), offset)
        blobs += png
        offset += len(png)
    return header + entries + blobs


def main() -> int:
    if not shutil.which("rsvg-convert"):
        print("rsvg-convert fehlt (z. B. apt install librsvg2-bin)", file=sys.stderr)
        return 1
    svg = HERE / "pianoscribe.svg"
    ico = build_ico([(size, render_png(svg, size)) for size in SIZES])
    (HERE / "pianoscribe.ico").write_bytes(ico)
    print(f"{HERE / 'pianoscribe.ico'} ({len(ico)} Bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
