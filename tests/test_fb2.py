from __future__ import annotations

import base64

from kindle_meta.readers import read_metadata

FB2_TEMPLATE = """<?xml version="1.0" encoding="UTF-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"
             xmlns:l="http://www.w3.org/1999/xlink">
  <description>
    <title-info>
      <genre>adventure</genre>
      <author>
        <first-name>Anna</first-name>
        <last-name>Musterfrau</last-name>
      </author>
      <book-title>Die FB2-Reise</book-title>
      <annotation><p>Eine kurze Zusammenfassung der Geschichte.</p></annotation>
      <coverpage><image l:href="#cover.jpg"/></coverpage>
      <lang>de</lang>
    </title-info>
    <publish-info>
      <publisher>FB2-Verlag</publisher>
      <year>2019</year>
      <isbn>9783161484100</isbn>
    </publish-info>
  </description>
  <body>
    <section>
      <p>Der Regen fiel leise auf das Dach, während sie am Fenster stand
      und über die vergangenen Jahre nachdachte, die so schnell vergangen
      waren wie ein einziger Atemzug im kalten Winterwind.</p>
    </section>
  </body>
  <binary id="cover.jpg" content-type="image/jpeg">{cover_b64}</binary>
</FictionBook>
"""


def _write_fb2(tmp_path, cover_bytes: bytes = b"\xff\xd8\xff\xe0fakejpeg"):
    content = FB2_TEMPLATE.format(cover_b64=base64.b64encode(cover_bytes).decode("ascii"))
    path = tmp_path / "beispiel.fb2"
    path.write_text(content, encoding="utf-8")
    return str(path), cover_bytes


def test_read_fb2_metadata(tmp_path):
    path, cover_bytes = _write_fb2(tmp_path)
    meta = read_metadata(path)

    assert meta.title == "Die FB2-Reise"
    assert meta.authors == ["Anna Musterfrau"]
    assert meta.language == "de"
    assert meta.subjects == ["adventure"]
    assert meta.description == "Eine kurze Zusammenfassung der Geschichte."
    assert meta.publisher == "FB2-Verlag"
    assert meta.published == "2019"
    assert meta.isbn == "9783161484100"
    assert meta.cover == cover_bytes
    assert meta.cover_mime == "image/jpeg"
    assert "Regen" in meta.sample_text


def test_read_fb2_without_cover_or_publish_info(tmp_path):
    content = """<?xml version="1.0" encoding="UTF-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <description>
    <title-info>
      <book-title>Minimalbuch</book-title>
      <author><first-name>Max</first-name><last-name>Mustermann</last-name></author>
    </title-info>
  </description>
  <body><section><p>Kurzer Text.</p></section></body>
</FictionBook>
"""
    path = tmp_path / "minimal.fb2"
    path.write_text(content, encoding="utf-8")
    meta = read_metadata(str(path))
    assert meta.title == "Minimalbuch"
    assert meta.authors == ["Max Mustermann"]
    assert meta.has_cover() is False
    assert meta.publisher == ""
