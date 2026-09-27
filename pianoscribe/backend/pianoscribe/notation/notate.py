"""Einstieg der Notationsstufe: reine Funktion (Rohnoten, Beats, Parameter) → Partitur.

Die Stufe braucht weder GPU noch Modelle und läuft typischerweise in unter einer Sekunde.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

import numpy as np
from music21 import stream

from ..project import NotationParams
from . import cleanup
from .build_score import ScoreInput, build_score
from .events import build_events
from .grid import BeatGrid, build_grid
from .hands import split_fixed
from .keys import Key, detect_key, parse_key, transpose_key
from .measures import Metrics, compute_layout, fill_measure, measure_specs
from .meter import TimeSig, parse_time_signature
from .quantize import choose_divisions, quantize_notes, quantize_pedals
from .types import (
    LEFT,
    RIGHT,
    TPQ,
    Event,
    NotationInfo,
    QNote,
    QPedal,
    RawNote,
    RawPedal,
    ScoreLayout,
)


@dataclass
class NotationResult:
    score: stream.Score
    events: dict[int, list[Event]]
    pedals: list[QPedal]
    layout: ScoreLayout
    ts: TimeSig
    key: Key
    tempo_bpm: float
    info: NotationInfo
    playback: dict[str, Any]


def _choose_key(notes: Sequence[RawNote], params: NotationParams) -> tuple[Key, str]:
    if params.key:
        return transpose_key(parse_key(params.key), params.transpose), "manual"
    weights = [min(n.duration, 2.0) for n in notes]
    return detect_key([n.pitch for n in notes], weights), "auto"


def _playback(events: dict[int, list[Event]], pedals: Sequence[QPedal], layout: ScoreLayout,
              grid: BeatGrid, ts: TimeSig, shift: int) -> dict[str, Any]:
    """Daten für Wiedergabe und Cursor: Viertelposition (wie Verovios qstamp) und Audiozeit."""
    beat_ticks = ts.beat_ticks

    def seconds(tick: int) -> float:
        beat = (tick + shift) / beat_ticks + grid.bar_beat
        return round(float(grid.to_time(beat)[0]), 4)

    def quarters(tick: int) -> float:
        return round((tick + layout.pickup_ticks) / TPQ, 4)

    notes = []
    for hand in (RIGHT, LEFT):
        for ev in events.get(hand, []):
            for pitch, vel in zip(ev.pitches, ev.velocities, strict=True):
                notes.append({"p": pitch, "v": vel, "h": hand, "q0": quarters(ev.start),
                              "q1": quarters(ev.end), "t0": seconds(ev.start),
                              "t1": seconds(ev.end)})
    notes.sort(key=lambda n: (n["q0"], n["p"]))
    first = layout.start_tick
    beat_map = []
    for tick in range(first, layout.end_tick + beat_ticks, beat_ticks):
        beat_map.append({"q": quarters(tick), "t": seconds(tick)})
    return {
        "notes": notes,
        "pedals": [{"q0": quarters(p.start), "q1": quarters(p.end), "t0": seconds(p.start),
                    "t1": seconds(p.end)} for p in pedals],
        "beats": beat_map,
        "measures": [{"n": 0 if tick < 0 else tick // layout.bar_ticks + 1,
                      "q": quarters(tick), "t": seconds(tick)}
                     for tick in ([first] if layout.pickup_ticks else [])
                     + list(range(0, layout.end_tick, layout.bar_ticks))],
    }


def notate(notes: Sequence[RawNote], pedals: Sequence[RawPedal], beats: Sequence[float],
           downbeats: Sequence[float], params: NotationParams,
           trim_start: float = 0.0) -> NotationResult:
    """Erzeugt aus Rohnoten und Beats eine Klavierpartitur.

    Zeiten von Noten, Pedal und Beats beziehen sich auf den getrimmten Ausschnitt;
    ``params.first_downbeat_s`` auf die Originaldatei (daher ``trim_start``).
    """
    ts = parse_time_signature(params.time_signature)
    warnings: list[str] = []

    cleaned = cleanup.filter_notes(notes, params.min_note_ms, params.min_velocity)
    cleaned = cleanup.merge_overlaps(cleaned)
    cleaned = cleanup.transpose(cleaned, params.transpose)
    if not cleaned:
        warnings.append("Keine Noten übrig – Mindestlänge oder Mindestlautstärke senken.")

    span = ((min(n.onset for n in cleaned), max(n.offset for n in cleaned))
            if cleaned else (0.0, 1.0))
    first_downbeat = (params.first_downbeat_s - trim_start
                      if params.first_downbeat_s is not None else None)
    grid = build_grid(beats, downbeats, ts, span, params.tempo_bpm, first_downbeat)
    if grid.tempo_source == "fallback":
        warnings.append("Kein Takt erkannt – Tempo bitte manuell setzen.")

    onset_beats = grid.to_beat(np.array([n.onset for n in cleaned])) - grid.bar_beat
    divisions = choose_divisions(onset_beats, ts, params.grid)
    qnotes: list[QNote] = quantize_notes(cleaned, grid, ts, divisions)
    qpedals = quantize_pedals(pedals, grid, ts, divisions) if params.pedal else []

    layout, shift = compute_layout(qnotes, ts)
    for n in qnotes:
        n.start -= shift
        n.end -= shift
    for p in qpedals:
        p.start -= shift
        p.end -= shift
    qpedals = [p for p in qpedals if p.end > layout.start_tick and p.start < layout.end_tick]

    split_fixed(qnotes, params.hand_split.pitch)
    key, key_source = _choose_key(cleaned, params)
    events = {hand: build_events(qnotes, hand) for hand in (RIGHT, LEFT)}

    metrics = Metrics.of(ts)
    specs = measure_specs(layout)
    items = {hand: [fill_measure(spec, events[hand], metrics) for spec in specs]
             for hand in (RIGHT, LEFT)}
    score = build_score(ScoreInput(
        measures=specs, items=items, pedals=qpedals, ts=ts, key=key,
        tempo_bpm=grid.tempo_bpm, title=params.title, composer=params.composer,
        show_pedal=params.pedal,
    ))
    first_downbeat_abs = float(grid.to_time(shift / ts.beat_ticks + grid.bar_beat)[0]) + trim_start
    info = NotationInfo(
        tempo_bpm=round(grid.tempo_bpm, 1), tempo_source=grid.tempo_source,
        time_signature=str(ts), key=str(key), key_source=key_source,
        pickup_quarters=float(layout.pickup_ticks / TPQ), measures=layout.n_bars,
        grid=params.grid, first_downbeat_s=round(first_downbeat_abs, 3),
        notes=sum(len(ev.pitches) for evs in events.values() for ev in evs),
        warnings=warnings,
    )
    playback = _playback(events, qpedals, layout, grid, ts, shift)
    return NotationResult(score, events, qpedals, layout, ts, key, grid.tempo_bpm, info, playback)
