"""Qualitätstests der Notationsstufe auf synthetischen Eingaben mit bekanntem Ergebnis.

Konvention: ``q0``/``q1`` in ``playback["notes"]`` sind Viertelpositionen ab Beginn des
ersten Takts (bzw. des Auftakts), ``h`` ist die Hand (0 = rechts, 1 = links).
"""

import re
from fractions import Fraction

import numpy as np
import verovio

from evaluation.notation_eval import compare, demo_truth
from evaluation.synth import demo_piece
from pianoscribe.notation.build_score import to_musicxml_string
from pianoscribe.notation.notate import notate
from pianoscribe.notation.types import LEFT, RIGHT, RawNote, RawPedal
from pianoscribe.project import NotationParams

RNG = np.random.default_rng(42)


def beats_at(bpm: float, n: int = 64, start: float = 1.0, bpb: int = 4):
    period = 60.0 / bpm
    beats = [start + i * period for i in range(n)]
    return beats, beats[::bpb]


def notes_from_beats(events, bpm: float, start: float = 1.0, jitter_ms: float = 0.0,
                     legato: float = 0.95, velocity: int = 80):
    """``events``: (Beat-Position, Dauer in Beats, Tonhöhe) → RawNotes mit optionalem Jitter."""
    period = 60.0 / bpm
    out = []
    for pos, dur, pitch in events:
        jitter = RNG.uniform(-jitter_ms, jitter_ms) / 1000 if jitter_ms else 0.0
        onset = start + pos * period + jitter
        out.append(RawNote(onset, onset + dur * period * legato, pitch, velocity))
    return out


def run(notes, bpm=100.0, pedals=(), bpb=4, **params):
    beats, downbeats = beats_at(bpm, bpb=bpb)
    p = NotationParams(**params)
    return notate(notes, list(pedals), beats, downbeats, p)


def make(events, bpm, jitter_ms=0.0, legato=0.95, **kwargs):
    """Noten und Beats mit demselben Tempo erzeugen und notieren."""
    return run(notes_from_beats(events, bpm, jitter_ms=jitter_ms, legato=legato), bpm=bpm,
               **kwargs)


def positions(result, hand):
    return [Fraction(n["q0"]).limit_denominator(12) for n in result.playback["notes"]
            if n["h"] == hand]


def xml_of(result):
    return to_musicxml_string(result.score)


def assert_renders(result):
    tk = verovio.toolkit()
    assert tk.loadData(xml_of(result))
    assert tk.getPageCount() >= 1


# ---- Raster ------------------------------------------------------------------------------------
def test_straight_eighths_with_jitter_stay_eighths():
    melody = [(i * 0.5, 0.5, 72 + (i % 5)) for i in range(32)]
    bass = [(float(i), 1.0, 48) for i in range(16)]
    result = make(melody + bass, 100, jitter_ms=20)
    rh = positions(result, RIGHT)
    assert len(rh) == 32
    assert all((q * 2).denominator == 1 for q in rh), rh
    durations = {round(n["q1"] - n["q0"], 3) for n in result.playback["notes"] if n["h"] == RIGHT}
    assert durations == {0.5}
    assert "<tuplet" not in xml_of(result)


def test_eighth_triplets_are_detected():
    straight = [(i * 0.5, 0.5, 72) for i in range(8)]  # Takt 1: Achtel
    triplets = [(4 + i / 3, 1 / 3, 74 + i % 3) for i in range(12)]  # Takt 2: Triolen
    result = make(straight + triplets, 90, jitter_ms=10)
    rh = positions(result, RIGHT)
    assert all((q * 2).denominator == 1 for q in rh[:8])
    assert all((q * 3).denominator == 1 for q in rh[8:]), rh[8:]
    assert re.search(r'<tuplet [^>]*type="start"', xml_of(result))
    assert_renders(result)


def test_triplets_against_eighths_per_hand():
    rh = [(i / 3, 1 / 3, 76) for i in range(12)]
    lh = [(i * 0.5, 0.5, 43 + (i % 2) * 7) for i in range(8)]
    result = make(rh + lh, 80, jitter_ms=8)
    assert all((q * 3).denominator == 1 for q in positions(result, RIGHT))
    assert all((q * 2).denominator == 1 for q in positions(result, LEFT))


def test_sixteenths_survive_auto_grid():
    run16 = [(i * 0.25, 0.25, 72 + i % 7) for i in range(16)]
    result = make(run16, 90, jitter_ms=8)
    rh = positions(result, RIGHT)
    assert rh == [Fraction(i, 4) for i in range(16)]


def test_fixed_eighth_grid_forces_eighths():
    run16 = [(i * 0.25, 0.25, 72 + i % 7) for i in range(16)]
    result = make(run16, 90, grid="1/8")
    assert all((q * 2).denominator == 1 for q in positions(result, RIGHT))


def test_arpeggiated_chord_becomes_one_chord():
    notes = [RawNote(1.0 + i * 0.012, 2.0, p, 80) for i, p in enumerate((60, 64, 67, 72))]
    result = run(notes)
    assert len({n["q0"] for n in result.playback["notes"]}) == 1


# ---- Hände -------------------------------------------------------------------------------------
def test_auto_hands_keep_accompaniment_reaching_d4_in_left_hand():
    events = []
    for bar, root in enumerate((46, 44, 46, 43)):
        for eighth in range(8):
            pattern = [root, root + 7, root + 16, root + 7]
            events.append((bar * 4 + eighth * 0.5, 0.5, pattern[eighth % 4]))
    lh_count = len(events)
    events += [(bar * 4 + beat, 1.0, 74 + beat) for bar in range(4) for beat in range(4)]
    result = make(events, 96, jitter_ms=8)
    hands = {(n["q0"], n["p"]): n["h"] for n in result.playback["notes"]}
    lh_notes = [(float(pos), pitch) for pos, _, pitch in events[:lh_count]]
    assert all(hands[(pos, pitch)] == LEFT for pos, pitch in lh_notes)
    assert max(p for _, p in lh_notes) == 62  # reicht bis D4


def test_auto_hands_keep_descending_melody_in_right_hand():
    melody = [(i * 1.0, 1.0, p) for i, p in enumerate((72, 69, 67, 65, 64, 62, 60, 59, 57, 59))]
    bass = [(i * 2.0, 2.0, p) for i, p in enumerate((36, 41, 43, 36, 38))]
    result = make(melody + bass, 90)
    for n in result.playback["notes"]:
        assert n["h"] == (RIGHT if n["p"] >= 57 else LEFT), n


def test_fixed_split():
    result = make([(0, 1, 59), (1, 1, 60), (2, 1, 64), (3, 1, 55)], 100,
                  hand_split={"mode": "fixed", "pitch": 60})
    assert [(n["p"], n["h"]) for n in result.playback["notes"]] == [
        (59, LEFT), (60, RIGHT), (64, RIGHT), (55, LEFT)]


# ---- Takt, Auftakt, Dauern ---------------------------------------------------------------------
def test_pickup_and_tie_over_barline():
    notes = notes_from_beats([(3, 1, 67), (4, 1, 72), (7, 2, 74), (9, 3, 72)], 100)
    result = run(notes)
    assert result.info.pickup_quarters == 1.0
    xml = xml_of(result)
    assert 'implicit="yes"' in xml
    assert '<tie type="start"' in xml and '<tie type="stop"' in xml
    assert_renders(result)


def test_small_gaps_are_closed_but_real_rests_stay():
    staccato = [(i * 1.0, 0.25, 72) for i in range(4)]  # Viertel kurz gespielt → echte Pausen?
    legato = [(4 + i * 1.0, 0.9, 74) for i in range(4)]  # fast volle Viertel → Viertel
    result = make(staccato + legato, 100, legato=1.0)
    durs = [round(n["q1"] - n["q0"], 3) for n in result.playback["notes"]]
    assert durs[:4] == [0.25] * 4
    assert durs[4:] == [1.0] * 4


def test_final_overhang_does_not_add_a_bar():
    notes = notes_from_beats([(0, 1, 60), (1, 1, 62), (2, 1, 64), (3, 1.5, 65)], 100)
    result = run(notes)
    assert result.info.measures == 1


def test_three_four_and_six_eight():
    waltz = []
    for bar in range(4):
        waltz += [(bar * 3, 1, 43), (bar * 3 + 1, 1, 64), (bar * 3 + 2, 1, 67)]
    result = make(waltz, 120, bpb=3, time_signature="3/4")
    assert result.info.measures == 4
    assert "<beats>3</beats>" in xml_of(result)
    assert_renders(result)

    six = [(i / 3, 1 / 3, 72 + i % 3) for i in range(12)]  # Achtel im 6/8 (Schlag = 3 Achtel)
    result = make(six, 60, bpb=2, time_signature="6/8")
    assert all((q * 2).denominator == 1 for q in positions(result, RIGHT))
    assert "<beat-type>8</beat-type>" in xml_of(result)
    assert_renders(result)


# ---- Tonart, Transposition, Pedal, Tempo -------------------------------------------------------
def test_key_detection_and_spelling():
    e_flat = [63, 65, 67, 68, 70, 72, 74, 75, 70, 67, 68, 63]
    result = make([(i, 1, p) for i, p in enumerate(e_flat)], 100)
    assert result.info.key == "E- major"
    xml = xml_of(result)
    assert "<fifths>-3</fifths>" in xml
    assert "<step>A</step>\n            <alter>-1</alter>" in xml.replace("  ", " ") or (
        "<step>A</step>" in xml and "<alter>-1</alter>" in xml)
    assert "<step>G</step>\n" in xml and "G#" not in xml


def test_manual_key_is_transposed():
    notes = notes_from_beats([(i, 1, p) for i, p in enumerate([63, 67, 70, 75])], 100)
    result = run(notes, key="E- major", transpose=2)
    assert result.info.key == "F major"
    assert "<fifths>-1</fifths>" in xml_of(result)
    assert [n["p"] for n in result.playback["notes"]] == [65, 69, 72, 77]


def test_pedal_marks_can_be_switched_off():
    notes = notes_from_beats([(i * 0.5, 0.5, 48 + (i % 3) * 4) for i in range(16)], 100)
    pedals = [RawPedal(1.0, 3.3), RawPedal(3.35, 5.7)]
    with_pedal = xml_of(run(notes, pedals=pedals))
    assert with_pedal.count('<pedal line="yes"') >= 2
    assert "<pedal" not in xml_of(run(notes, pedals=pedals, pedal=False))


def test_manual_tempo_overrides_detection():
    notes = notes_from_beats([(i, 1, 60 + i) for i in range(8)], 100)
    result = run(notes, tempo_bpm=50)
    assert (result.info.tempo_bpm, result.info.tempo_source) == (50, "manual")
    # halbes Tempo → doppelt so schnelle Notenwerte
    assert [round(n["q1"] - n["q0"], 3) for n in result.playback["notes"]][:4] == [0.5] * 4


def test_filters_and_empty_input():
    notes = [RawNote(1.0, 1.02, 60, 90), RawNote(1.5, 2.0, 62, 10), RawNote(2.0, 2.5, 64, 80)]
    result = run(notes, min_note_ms=50, min_velocity=20)
    assert [n["p"] for n in result.playback["notes"]] == [64]
    empty = run([])
    assert empty.info.warnings and empty.info.notes == 0
    assert_renders(empty)


# ---- Regressionstest: Demo-Stück aus der Ground Truth ------------------------------------------
def test_demo_piece_is_notated_exactly():
    piece = demo_piece()
    raw = [RawNote(n.start, n.end, n.pitch, n.velocity) for n in piece.notes]
    result = notate(raw, [], piece.beats, piece.downbeats, NotationParams())
    score = compare(result.playback["notes"], demo_truth())
    assert score.onset_accuracy == 1.0, score
    assert score.onset_precision == 1.0, score
    assert score.hand_accuracy == 1.0, score
    assert score.duration_correct == score.truth, score
    assert (result.info.key, result.info.pickup_quarters) == ("E- major", 1.0)
    assert_renders(result)
