from __future__ import annotations

import io

import pytest
from PIL import Image

from kindle_meta.covers import CoverError, crop, optimize_for_kindle, rotate, thumbnail


def _make_image(width: int, height: int, mode: str = "RGB", color=(200, 50, 50)) -> bytes:
    img = Image.new(mode, (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_optimize_for_kindle_shrinks_tall_image():
    data = _make_image(1000, 2000)
    result = optimize_for_kindle(data, target_height=1680)
    img = Image.open(io.BytesIO(result))
    assert img.format == "JPEG"
    assert img.height == 1680
    assert img.width == 840


def test_optimize_for_kindle_never_upscales():
    data = _make_image(300, 500)
    result = optimize_for_kindle(data, target_height=1680)
    img = Image.open(io.BytesIO(result))
    assert img.height == 500
    assert img.width == 300


def test_optimize_for_kindle_flattens_transparency_to_white():
    data = _make_image(100, 100, mode="RGBA", color=(0, 0, 0, 0))
    result = optimize_for_kindle(data)
    img = Image.open(io.BytesIO(result)).convert("RGB")
    assert img.getpixel((50, 50)) == (255, 255, 255)


def test_optimize_for_kindle_crop_to_ratio():
    data = _make_image(1000, 1000)
    result = optimize_for_kindle(data, crop_to_ratio=True, target_height=1000)
    img = Image.open(io.BytesIO(result))
    ratio = img.width / img.height
    assert abs(ratio - 1.6) < 0.05


def test_rotate_expands_dimensions():
    data = _make_image(200, 100)
    result = rotate(data, 90)
    img = Image.open(io.BytesIO(result))
    assert img.width == 100
    assert img.height == 200


def test_crop_valid_box():
    data = _make_image(200, 200)
    result = crop(data, (10, 10, 100, 100))
    img = Image.open(io.BytesIO(result))
    assert img.width == 90
    assert img.height == 90


def test_crop_invalid_box_raises():
    data = _make_image(200, 200)
    with pytest.raises(CoverError):
        crop(data, (100, 100, 10, 10))
    with pytest.raises(CoverError):
        crop(data, (0, 0, 500, 500))


def test_thumbnail_respects_max_side():
    data = _make_image(800, 400)
    result = thumbnail(data, max_side=200)
    img = Image.open(io.BytesIO(result))
    assert max(img.width, img.height) <= 200
