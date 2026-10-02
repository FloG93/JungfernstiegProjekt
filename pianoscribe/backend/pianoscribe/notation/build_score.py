"""Aufbau der Klavierpartitur mit music21 und Export als MusicXML.

Zwei ``PartStaff``s (Violin- und Bassschlüssel) mit geschweifter Klammer in einer
``StaffGroup``, dazu Taktart, Tonart, Tempoangabe, Titel, Auftakt, Haltebögen und Pedalzeichen.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path

from music21 import (
    bar,
    chord,
    clef,
    duration,
    expressions,
    instrument,
    layout,
    metadata,
    note,
    pitch,
    stream,
    tempo,
    tie,
)
from music21 import key as m21key
from music21 import meter as m21meter
from music21.stream import makeNotation

from .keys import Key, spell
from .measures import Item, MeasureSpec
from .meter import TimeSig
from .types import LEFT, RIGHT, TPQ, QPedal


@dataclass
class ScoreInput:
    measures: list[MeasureSpec]  # Takt-Gerüst (ohne Items)
    items: dict[int, list[list[Item]]]  # Hand → Items je Takt (gleiche Reihenfolge)
    pedals: list[QPedal]
    ts: TimeSig
    key: Key
    tempo_bpm: float
    title: str
    composer: str
    show_pedal: bool = True


def _ql(ticks: int) -> Fraction:
    return Fraction(ticks, TPQ)


def _m21_pitch(midi: int, key: Key) -> pitch.Pitch:
    sp = spell(midi, key)
    p = pitch.Pitch()
    p.step = sp.step  # type: ignore[assignment]
    p.octave = sp.octave
    p.accidental = pitch.Accidental(sp.alter) if sp.alter else None
    return p


def _element(item: Item, key: Key) -> note.GeneralNote:
    ql = _ql(item.duration)
    if item.is_rest:
        rest = note.Rest(quarterLength=ql)
        if item.full_measure:
            rest.fullMeasure = True
        return rest
    notes = []
    for midi, vel in zip(item.pitches, item.velocities, strict=True):
        n = note.Note(_m21_pitch(midi, key), quarterLength=ql)
        n.volume.velocity = max(1, min(127, vel))
        notes.append(n)
    el: note.GeneralNote = notes[0] if len(notes) == 1 else chord.Chord(notes, quarterLength=ql)
    if item.tie:
        el.tie = tie.Tie(item.tie)
    return el


def _pedal_spanners(pedals: Sequence[QPedal],
                    placed: dict[int, list[tuple[int, note.GeneralNote]]]
                    ) -> list[tuple[int, expressions.PedalMark]]:
    """Pedalzeichen (Ped. … *) über die Noten, die innerhalb des Pedals angeschlagen werden.

    Bevorzugt an der linken Hand (unter dem Bass-System); spielt sie im Pedalbereich nichts,
    an der rechten. Dargestellt als Pedal-Klammer (|___|): Bei häufigen Pedalwechseln bleibt das
    lesbar, während sich „Ped.“ und „*“ am Wechsel überlagern würden.
    """
    marks = []
    for ped in pedals:
        for hand in (LEFT, RIGHT):
            members = [el for start, el in placed[hand]
                       if ped.start <= start < ped.end and not isinstance(el, note.Rest)]
            if members:
                mark = expressions.PedalMark()
                mark.pedalType = expressions.PedalType.Sustain
                mark.pedalForm = expressions.PedalForm.Line
                mark.addSpannedElements(*members)
                marks.append((hand, mark))
                break
    return marks


def build_score(data: ScoreInput) -> stream.Score:
    score = stream.Score()
    score.metadata = metadata.Metadata()
    score.metadata.title = data.title or ""
    score.metadata.composer = data.composer or ""
    beat_ref = duration.Duration(float(data.ts.beat_ql))
    parts: dict[int, stream.PartStaff] = {}
    placed: dict[int, list[tuple[int, note.GeneralNote]]] = {RIGHT: [], LEFT: []}

    for hand in (RIGHT, LEFT):
        part = stream.PartStaff(id="RH" if hand == RIGHT else "LH")
        part.insert(0, instrument.Piano())
        part.partName = "Klavier"
        part.partAbbreviation = "Kl."
        # Solo-Klavier: keine Instrumentenbezeichnung (StreamStyle, mypy kennt nur Style)
        part.style.printPartName = False  # type: ignore[attr-defined]
        part.style.printPartAbbreviation = False  # type: ignore[attr-defined]
        for index, spec in enumerate(data.measures):
            m = stream.Measure(number=spec.number)
            if index == 0:
                m.insert(0, clef.TrebleClef() if hand == RIGHT else clef.BassClef())
                m.insert(0, m21key.Key(data.key.tonic_name, data.key.mode))
                m.insert(0, m21meter.TimeSignature(str(data.ts)))
                if hand == RIGHT:
                    mark = tempo.MetronomeMark(number=round(data.tempo_bpm), referent=beat_ref)
                    m.insert(0, mark)
            if spec.number == 0:
                m.paddingLeft = float(data.ts.bar_ql - _ql(spec.length))
                m.showNumber = stream.enums.ShowNumber.NEVER
            for item in data.items[hand][index]:
                el = _element(item, data.key)
                m.insert(float(_ql(item.offset)), el)
                placed[hand].append((spec.start + item.offset, el))
            makeNotation.makeTupletBrackets(m, inPlace=True)
            if index == len(data.measures) - 1:
                m.rightBarline = bar.Barline("final")
            part.append(m)
        parts[hand] = part

    if data.show_pedal:
        for hand, pedal_mark in _pedal_spanners(data.pedals, placed):
            parts[hand].insert(0, pedal_mark)

    for hand in (RIGHT, LEFT):
        score.insert(0, parts[hand])
    group = layout.StaffGroup([parts[RIGHT], parts[LEFT]], symbol="brace")
    group.barTogether = True
    score.insert(0, group)
    return score


def write_musicxml(score: stream.Score, path: Path) -> None:
    tmp = path.with_suffix(".tmp")
    score.write("musicxml", fp=str(tmp))
    tmp.replace(path)


def to_musicxml_string(score: stream.Score) -> str:
    from music21.musicxml.m21ToXml import GeneralObjectExporter

    return GeneralObjectExporter(score).parse().decode("utf-8")
