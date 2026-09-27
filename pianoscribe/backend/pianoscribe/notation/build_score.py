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


def _pedal_spanners(pedals: Sequence[QPedal], placed: list[tuple[int, note.GeneralNote]]
                    ) -> list[expressions.PedalMark]:
    """Pedalzeichen (Ped. … *) über die Noten, die innerhalb des Pedals angeschlagen werden."""
    marks = []
    for ped in pedals:
        members = [el for start, el in placed
                   if ped.start <= start < ped.end and not isinstance(el, note.Rest)]
        if not members:
            continue
        mark = expressions.PedalMark()
        mark.pedalType = expressions.PedalType.Sustain
        mark.pedalForm = expressions.PedalForm.Symbol
        mark.addSpannedElements(*members)
        marks.append(mark)
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
        part.partName = "Klavier"
        part.insert(0, instrument.Piano())
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
            if index == len(data.measures) - 1:
                m.rightBarline = bar.Barline("final")
            part.append(m)
        parts[hand] = part

    if data.show_pedal:
        target = LEFT if any(not isinstance(el, note.Rest) for _, el in placed[LEFT]) else RIGHT
        for pedal_mark in _pedal_spanners(data.pedals, placed[target]):
            parts[target].insert(0, pedal_mark)

    for hand in (RIGHT, LEFT):
        score.insert(0, parts[hand])
    group = layout.StaffGroup([parts[RIGHT], parts[LEFT]], name="Klavier", abbreviation="Kl.",
                              symbol="brace")
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
