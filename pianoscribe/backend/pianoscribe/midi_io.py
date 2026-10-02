"""MIDI schreiben: Rohtranskription (``raw.mid``) und quantisierte Fassung (``score.mid``)."""

from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

import mido

from .notation.keys import Key
from .notation.meter import TimeSig
from .notation.types import LEFT, RIGHT, TPQ, Event, QPedal, RawNote, RawPedal, ScoreLayout

PPQ = 480
_RAW_BPM = 120.0
_MIDO_MAJOR = {"C", "G", "D", "A", "E", "B", "F#", "C#", "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"}
_MIDO_MINOR = {"A", "E", "B", "F#", "C#", "G#", "D#", "A#", "D", "G", "C", "F", "Bb", "Eb", "Ab"}


def _save(mid: mido.MidiFile, path: Path) -> None:
    tmp = path.with_suffix(".tmp")
    mid.save(str(tmp))
    tmp.replace(path)


def _to_track(events: list[tuple[int, int, mido.Message]], name: str) -> mido.MidiTrack:
    track = mido.MidiTrack()
    track.append(mido.MetaMessage("track_name", name=name, time=0))
    events.sort(key=lambda e: (e[0], e[1]))
    last = 0
    for tick, _, msg in events:
        track.append(msg.copy(time=max(0, tick - last)))
        last = max(last, tick)
    return track


def write_raw_midi(path: Path, notes: Sequence[RawNote], pedals: Sequence[RawPedal]) -> None:
    """Rohnoten mit echten Zeiten (Tempo 120, 960 Ticks pro Sekunde)."""
    per_second = PPQ * _RAW_BPM / 60.0
    mid = mido.MidiFile(type=1, ticks_per_beat=PPQ)
    meta = mido.MidiTrack()
    meta.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(_RAW_BPM), time=0))
    mid.tracks.append(meta)
    events: list[tuple[int, int, mido.Message]] = []
    for n in notes:
        velocity = max(1, min(127, n.velocity))
        events.append((round(n.onset * per_second), 1,
                       mido.Message("note_on", note=n.pitch, velocity=velocity)))
        events.append((round(n.offset * per_second), 0,
                       mido.Message("note_off", note=n.pitch, velocity=0)))
    for p in pedals:
        events.append((round(p.onset * per_second), 2,
                       mido.Message("control_change", control=64, value=127)))
        events.append((round(p.offset * per_second), 0,
                       mido.Message("control_change", control=64, value=0)))
    mid.tracks.append(_to_track(events, "Klavier (roh)"))
    _save(mid, path)


def _mido_key(key: Key) -> str | None:
    tonic = key.letter + ("#" * key.alter if key.alter > 0 else "b" * -key.alter)
    if key.mode == "minor":
        return tonic + "m" if tonic in _MIDO_MINOR else None
    return tonic if tonic in _MIDO_MAJOR else None


def write_score_midi(path: Path, events: dict[int, list[Event]], pedals: Sequence[QPedal],
                     layout: ScoreLayout, ts: TimeSig, key: Key, tempo_bpm: float, title: str,
                     with_pedal: bool = True) -> None:
    """Quantisierte Fassung mit konstantem Tempo; Tick 0 ist der Beginn des Auftakts."""
    scale = PPQ // TPQ
    origin = -layout.pickup_ticks
    mid = mido.MidiFile(type=1, ticks_per_beat=PPQ)
    meta = mido.MidiTrack()
    meta.append(mido.MetaMessage("track_name", name=title or "PianoScribe", time=0))
    quarter_bpm = tempo_bpm * float(ts.beat_ql)
    meta.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(quarter_bpm), time=0))
    meta.append(mido.MetaMessage("time_signature", numerator=ts.numerator,
                                 denominator=ts.denominator, time=0))
    key_name = _mido_key(key)
    if key_name:
        meta.append(mido.MetaMessage("key_signature", key=key_name, time=0))
    mid.tracks.append(meta)

    def tick(t: int) -> int:
        return (t - origin) * scale

    for hand, name in ((RIGHT, "Rechte Hand"), (LEFT, "Linke Hand")):
        msgs: list[tuple[int, int, mido.Message]] = [
            (0, -1, mido.Message("program_change", program=0, channel=0))]
        for ev in events.get(hand, []):
            for pitch, vel in zip(ev.pitches, ev.velocities, strict=True):
                msgs.append((tick(ev.start), 1, mido.Message(
                    "note_on", note=pitch, velocity=max(1, min(127, vel)))))
                msgs.append((tick(ev.end), 0, mido.Message("note_off", note=pitch, velocity=0)))
        if hand == LEFT and with_pedal:
            for p in pedals:
                msgs.append((tick(p.start), 2, mido.Message("control_change", control=64,
                                                            value=127)))
                msgs.append((tick(p.end), 0, mido.Message("control_change", control=64,
                                                          value=0)))
        mid.tracks.append(_to_track(msgs, name))
    _save(mid, path)
