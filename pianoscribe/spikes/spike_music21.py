"""Spike: Klavierpartitur mit music21 bauen, als MusicXML exportieren und mit Verovio prüfen.

Geprüft: zwei PartStaffs mit Klammer, Tonart, Takt, Tempo, Titel/Komponist, Auftakt,
Haltebogen über den Taktstrich, Achteltriolen, Pedalzeichen; Laufzeit für eine große Partitur.
Aufruf (aus backend/):  uv run python ../spikes/spike_music21.py <out_dir>
"""

import sys
import time
from fractions import Fraction
from pathlib import Path

import verovio
from music21 import (bar, chord, clef, expressions, key, layout, metadata, meter, note, stream, tie,
                     tempo)


def build(n_bars: int = 2, dense: bool = False) -> stream.Score:
    score = stream.Score()
    score.metadata = metadata.Metadata(title="Spike – Auftakt", composer="PianoScribe")
    rh, lh = stream.PartStaff(id="RH"), stream.PartStaff(id="LH")
    pedal = expressions.PedalMark()
    pedal.pedalType = expressions.PedalType.Sustain
    pedal.pedalForm = expressions.PedalForm.Symbol

    for number in range(0, n_bars + 1):
        m_r, m_l = stream.Measure(number=number), stream.Measure(number=number)
        if number == 0:
            m_r.insert(0, clef.TrebleClef())
            m_l.insert(0, clef.BassClef())
            for m in (m_r, m_l):
                m.insert(0, key.Key("E-"))
                m.insert(0, meter.TimeSignature("4/4"))
            m_r.insert(0, tempo.MetronomeMark(number=96, referent=note.Note(type="quarter")))
            m_r.append(note.Note("B-4", quarterLength=1))
            m_l.append(note.Rest(quarterLength=1))
            for m in (m_r, m_l):
                m.paddingLeft = 3.0
        elif dense:
            for i in range(16):
                m_r.append(note.Note(70 + (i % 5), quarterLength=0.25))
            for i in range(8):
                n = note.Note(39 + (i % 4) * 3, quarterLength=0.5)
                m_l.append(n)
        else:
            for p in (68, 72, 75):
                m_r.append(note.Note(p, quarterLength=Fraction(1, 3)))
            m_r.append(chord.Chord([67, 75], quarterLength=1))
            tied = note.Note("A-5", quarterLength=2)
            tied.tie = tie.Tie("start") if number < n_bars else None
            m_r.append(tied)
            for i, p in enumerate([39, 46, 55, 46, 39, 46, 55, 46]):
                n = note.Note(p, quarterLength=0.5)
                m_l.append(n)
                if i < 7:
                    pedal.addSpannedElements(n)
        rh.append(m_r)
        lh.append(m_l)
    if n_bars >= 2 and not dense:
        first = rh.getElementsByClass(stream.Measure)[2].notes.first()
        first.tie = tie.Tie("stop")
    lh.insert(0, pedal)
    for m in (rh.getElementsByClass(stream.Measure).last(),
              lh.getElementsByClass(stream.Measure).last()):
        m.rightBarline = bar.Barline("final")
    score.insert(0, rh)
    score.insert(0, lh)
    group = layout.StaffGroup([rh, lh], name="Klavier", abbreviation="Kl.", symbol="brace")
    group.barTogether = True
    score.insert(0, group)
    return score


def render(xml_path: Path, out_dir: Path) -> None:
    tk = verovio.toolkit()
    tk.setOptions({"pageWidth": 2100, "pageHeight": 2970, "scale": 40, "header": "auto",
                   "footer": "none"})
    ok = tk.loadFile(str(xml_path))
    print(f"Verovio lädt: {ok}; Seiten: {tk.getPageCount()}")
    svg = tk.renderToSVG(1)
    (out_dir / "spike_page1.svg").write_text(svg)
    checks = {
        "Titel": "Spike" in svg,
        "Pedal": 'class="pedal' in svg,
        "Tuplet": 'class="tuplet' in svg,
        "Tie": 'class="tie' in svg,
        "Klammer": 'class="grpSym' in svg or "brace" in svg.lower(),
    }
    print("SVG-Checks:", checks)
    timemap = tk.renderToTimemap({"includeMeasures": True})
    print("Timemap erste Einträge:", timemap[:3])


def main() -> None:
    out_dir = Path(sys.argv[1])
    out_dir.mkdir(parents=True, exist_ok=True)
    score = build()
    xml_path = out_dir / "spike.musicxml"
    score.write("musicxml", fp=str(xml_path))
    text = xml_path.read_text()
    wanted = ('<pedal type="start"', '<pedal type="stop"', 'implicit="yes"', '<tuplet',
              '<tied type="start"', '<group-symbol>brace', '<work-title>', '<fifths>-3',
              '<per-minute>96')
    print("MusicXML:", {k: (k in text) for k in wanted})
    render(xml_path, out_dir)
    score.write("midi", fp=str(out_dir / "spike.mid"))

    for bars in (50, 200):
        t0 = time.perf_counter()
        big = build(bars, dense=True)
        t1 = time.perf_counter()
        big.write("musicxml", fp=str(out_dir / f"big{bars}.musicxml"))
        t2 = time.perf_counter()
        big.write("midi", fp=str(out_dir / f"big{bars}.mid"))
        t3 = time.perf_counter()
        print(f"{bars} Takte ({bars * 24} Noten): bauen {t1 - t0:.2f}s, MusicXML {t2 - t1:.2f}s, "
              f"MIDI {t3 - t2:.2f}s")


if __name__ == "__main__":
    main()
