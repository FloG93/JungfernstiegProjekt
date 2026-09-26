"""Cover-Bildbearbeitung: Optimierung für Kindle, Drehen, Zuschneiden."""

from __future__ import annotations

import io

TARGET_RATIO = 1.6
TARGET_HEIGHT = 1680
JPEG_QUALITY = 85


class CoverError(Exception):
    """Fehler bei der Cover-Bearbeitung (z. B. ungültiger Zuschnitt)."""


def _load(data: bytes):
    from PIL import Image

    return Image.open(io.BytesIO(data))


def optimize_for_kindle(
    data: bytes,
    *,
    target_height: int = TARGET_HEIGHT,
    crop_to_ratio: bool = False,
    quality: int = JPEG_QUALITY,
) -> bytes:
    """Wandelt ein Cover in ein Kindle-taugliches RGB-JPEG um.

    Transparenz wird auf Weiß gelegt, optional wird mittig auf
    `TARGET_RATIO` zugeschnitten. Es wird nur verkleinert, nie vergrößert.
    """
    from PIL import Image

    img = _load(data)
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        img = img.convert("RGBA")
        background = Image.new("RGB", img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[-1])
        img = background
    else:
        img = img.convert("RGB")

    if crop_to_ratio:
        width, height = img.size
        current_ratio = width / height
        if current_ratio > TARGET_RATIO:
            new_width = int(height * TARGET_RATIO)
            left = (width - new_width) // 2
            img = img.crop((left, 0, left + new_width, height))
        elif current_ratio < TARGET_RATIO:
            new_height = int(width / TARGET_RATIO)
            top = (height - new_height) // 2
            img = img.crop((0, top, width, top + new_height))

    if img.height > target_height:
        new_width = max(1, int(img.width * (target_height / img.height)))
        img = img.resize((new_width, target_height), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    return buf.getvalue()


def rotate(data: bytes, degrees: float) -> bytes:
    """Dreht ein Bild im Uhrzeigersinn um `degrees` Grad."""
    img = _load(data)
    rotated = img.rotate(-degrees, expand=True)
    buf = io.BytesIO()
    rotated.save(buf, format=img.format or "PNG")
    return buf.getvalue()


def crop(data: bytes, box: tuple[int, int, int, int]) -> bytes:
    """Schneidet ein Bild auf `box` (links, oben, rechts, unten) zu."""
    left, top, right, bottom = box
    img = _load(data)
    if left < 0 or top < 0 or left >= right or top >= bottom:
        raise CoverError("Ungültiger Zuschnittsbereich")
    if right > img.width or bottom > img.height:
        raise CoverError("Zuschnittsbereich liegt außerhalb des Bildes")
    cropped = img.crop(box)
    buf = io.BytesIO()
    cropped.save(buf, format=img.format or "PNG")
    return buf.getvalue()


def thumbnail(data: bytes, max_side: int = 200) -> bytes:
    """Erzeugt ein JPEG-Thumbnail mit maximaler Kantenlänge `max_side`."""
    img = _load(data).convert("RGB")
    img.thumbnail((max_side, max_side))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=JPEG_QUALITY)
    return buf.getvalue()
