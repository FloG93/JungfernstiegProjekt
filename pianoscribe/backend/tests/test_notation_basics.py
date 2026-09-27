"""Grundlegende Tests der Notationsbausteine (Taktart, Tonart, Raster, Schreibweise)."""

from fractions import Fraction

import numpy as np
import pytest

from pianoscribe.notation import keys, meter
from pianoscribe.notation.grid import build_grid
from pianoscribe.notation.measures import Metrics, compute_layout, is_simple, spell_span
from pianoscribe.notation.types import TPQ, QNote

Q = TPQ  # Viertel in Ticks


# ---- Taktart -----------------------------------------------------------------------------------
@pytest.mark.parametrize(("text", "bpb", "beat_ql", "compound"), [
    ("4/4", 4, 1, False), ("3/4", 3, 1, False), ("2/2", 2, 2, False),
    ("6/8", 2, Fraction(3, 2), True), ("12/8", 4, Fraction(3, 2), True), ("3/8", 3, Fraction(1, 2),
                                                                           False),
])
def test_time_signatures(text, bpb, beat_ql, compound):
    ts = meter.parse_time_signature(text)
    assert (ts.beats_per_bar, ts.beat_ql, ts.compound) == (bpb, beat_ql, compound)
    assert ts.bar_ql == Fraction(4 * ts.numerator, ts.denominator)


def test_divisions():
    four = meter.parse_time_signature("4/4")
    assert four.straight_divisions() == [1, 2, 4]
    assert four.straight_divisions(meter.EIGHTH) == [1, 2]
    assert four.triplet_divisions() == [3]
    six = meter.parse_time_signature("6/8")
    assert six.straight_divisions() == [1, 3, 6]
    assert six.triplet_divisions() == []


@pytest.mark.parametrize("bad", ["", "4", "4/3", "0/4", "17/4", "a/b"])
def test_invalid_time_signatures(bad):
    with pytest.raises(ValueError):
        meter.parse_time_signature(bad)


# ---- Tonart -----------------------------------------------------------------------------------
@pytest.mark.parametrize(("text", "sharps", "german"), [
    ("C major", 0, "C-Dur"), ("E- major", -3, "Es-Dur"), ("Eb", -3, "Es-Dur"),
    ("c# minor", 4, "cis-Moll"), ("f#", 3, "fis-Moll"), ("B- major", -2, "B-Dur"),
    ("b minor", 2, "h-Moll"), ("A- major", -4, "As-Dur"), ("d moll", -1, "d-Moll"),
])
def test_parse_key(text, sharps, german):
    k = keys.parse_key(text)
    assert k.sharps == sharps
    assert k.german == german


def test_transpose_key_prefers_few_accidentals():
    assert str(keys.transpose_key(keys.parse_key("B major"), 1)) == "C major"
    assert str(keys.transpose_key(keys.parse_key("E- major"), 2)) == "F major"
    assert str(keys.transpose_key(keys.parse_key("a minor"), 1)) == "b- minor"


def test_spelling_follows_key():
    e_flat = keys.parse_key("E- major")
    assert keys.spell(70, e_flat).name == "B-4"
    assert keys.spell(68, e_flat).name == "A-4"
    assert keys.spell(69, e_flat).name == "A4"  # #4 als Auflösung, nicht Bbb
    d_minor = keys.parse_key("d minor")
    assert keys.spell(61, d_minor).name == "C#4"  # Leitton
    f_sharp = keys.parse_key("F# major")
    assert keys.spell(65, f_sharp).name == "E#4"
    assert keys.spell(60, keys.parse_key("C# major")).name == "B#3"


def test_detect_key_major_and_minor():
    c_major = [60, 62, 64, 65, 67, 69, 71, 72, 64, 67, 60]
    assert str(keys.detect_key(c_major)) == "C major"
    a_minor = [57, 59, 60, 62, 64, 65, 68, 69, 57, 64, 60, 57]
    assert str(keys.detect_key(a_minor)) == "a minor"
    assert str(keys.detect_key([p + 3 for p in c_major])) == "E- major"


# ---- Raster -----------------------------------------------------------------------------------
def test_grid_interpolates_tempo_changes():
    beats = [0.0, 0.5, 1.0, 1.6, 2.2, 2.8]
    grid = build_grid(beats, [0.0, 2.2], meter.parse_time_signature("4/4"), (0.0, 2.8))
    assert grid.tempo_source == "auto"
    b = float(grid.to_beat(1.3)[0]) - grid.bar_beat
    assert b == pytest.approx(2.5)
    assert float(grid.to_time(grid.to_beat(2.0))[0]) == pytest.approx(2.0)


def test_grid_extrapolates_before_first_beat():
    beats = list(np.arange(1.0, 5.0, 0.5))
    grid = build_grid(beats, beats[::4], meter.parse_time_signature("4/4"), (0.1, 4.5))
    assert grid.times[0] <= 0.1
    assert float(grid.to_beat(0.5)[0]) - grid.bar_beat == pytest.approx(-1.0)


def test_grid_manual_tempo_and_downbeat():
    grid = build_grid([], [], meter.parse_time_signature("3/4"), (0.0, 5.0), tempo_bpm=90,
                      first_downbeat=1.0)
    assert (grid.tempo_source, grid.downbeat_source) == ("manual", "manual")
    assert float(grid.to_time(grid.bar_beat)[0]) == pytest.approx(1.0)
    assert grid.beat_duration(grid.bar_beat) == pytest.approx(60 / 90)


def test_grid_phase_from_downbeats():
    beats = list(np.arange(0.0, 8.0, 0.5))
    downbeats = [0.5, 2.5, 4.5, 6.5]  # jeder vierte Beat ab Index 1
    grid = build_grid(beats, downbeats, meter.parse_time_signature("4/4"), (0.0, 8.0))
    assert float(grid.to_time(grid.bar_beat)[0]) % 2.0 == pytest.approx(0.5)


# ---- Taktgerüst und Schreibweise ---------------------------------------------------------------
def test_layout_pickup_of_one_beat():
    notes = [QNote(3 * Q, 4 * Q, 60, 80), QNote(4 * Q, 8 * Q, 62, 80)]
    layout, shift = compute_layout(notes, meter.parse_time_signature("4/4"))
    assert (layout.pickup_ticks, layout.n_bars, shift) == (Q, 1, 4 * Q)


def test_layout_eighth_pickup_and_offbeat_start():
    ts = meter.parse_time_signature("4/4")
    layout, _ = compute_layout([QNote(3 * Q + Q // 2, 5 * Q, 60, 80)], ts)
    assert layout.pickup_ticks == Q // 2
    layout, _ = compute_layout([QNote(2 * Q + Q // 4, 5 * Q, 60, 80)], ts)
    assert layout.pickup_ticks == 2 * Q  # auf den Schlag abgerundet


def test_is_simple_values():
    assert all(is_simple(t) for t in (Q, Q // 2, Q // 4, 3 * Q // 4, 3 * Q // 2, 2 * Q, 3 * Q,
                                      4 * Q, Q // 3, 2 * Q // 3))
    assert not any(is_simple(t) for t in (5 * Q // 4, 5 * Q, 7 * Q // 4))


FOUR = Metrics.of(meter.parse_time_signature("4/4"))


@pytest.mark.parametrize(("start", "end", "rest", "expected"), [
    (0, 4 * Q, False, [(0, 4 * Q)]),                       # Ganze
    (Q, 3 * Q, False, [(Q, 3 * Q)]),                       # Halbe auf 2 (Synkope erlaubt)
    (Q, 3 * Q, True, [(Q, 2 * Q), (2 * Q, 3 * Q)]),        # Pausen strenger
    (0, 3 * Q, True, [(0, 2 * Q), (2 * Q, 3 * Q)]),        # keine punktierte Halbe als Pause
    (Q // 2, 3 * Q // 2, False, [(Q // 2, 3 * Q // 2)]),   # Achtel-Viertel-Achtel
    (3 * Q // 2, 5 * Q // 2, False,                         # über die Taktmitte → binden
     [(3 * Q // 2, 2 * Q), (2 * Q, 5 * Q // 2)]),
    (0, 3 * Q // 2, False, [(0, 3 * Q // 2)]),             # punktierte Viertel
    (Q // 4, 5 * Q // 4, False,                             # Sechzehntel-Synkope → binden
     [(Q // 4, Q), (Q, 5 * Q // 4)]),
    (Q // 3, Q, False, [(Q // 3, Q)]),                     # Triolen-Viertel innerhalb des Schlags
    (0, 9 * Q // 4, False, [(0, 2 * Q), (2 * Q, 9 * Q // 4)]),
])
def test_spell_span(start, end, rest, expected):
    assert spell_span(start, end, FOUR, rest) == expected


def test_spell_span_compound():
    six = Metrics.of(meter.parse_time_signature("6/8"))
    beat = 3 * Q // 2
    assert spell_span(0, 2 * beat, six, False) == [(0, 2 * beat)]   # punktierte Halbe
    assert spell_span(0, 5 * Q // 4, six, False) == [(0, Q), (Q, 5 * Q // 4)]
