"""Tests für die gevendorte ByteDance-Inferenz (ohne Modellgewichte)."""

import numpy as np
import pytest

from pianoscribe.transcription.bytedance_vendor.inference import SEGMENT_SAMPLES, deframe, enframe
from pianoscribe.transcription.bytedance_vendor.postprocess import (
    PedalEvent,
    binarize_regression,
    detect_notes,
    detect_pedals,
)


def _original_binarize(reg: np.ndarray, threshold: float, neighbour: int):
    """Wörtliche Portierung von RegressionPostProcessor.get_binarized_output_from_regression."""
    binary = np.zeros_like(reg)
    shift = np.zeros_like(reg)
    frames, classes = reg.shape
    with np.errstate(divide="ignore", invalid="ignore"):
        _original_loop(reg, threshold, neighbour, binary, shift, frames, classes)
    return binary, shift


def _original_loop(reg, threshold, neighbour, binary, shift, frames, classes):
    for k in range(classes):
        x = reg[:, k]
        for n in range(neighbour, frames - neighbour):
            monotonic = True
            for i in range(neighbour):
                if x[n - i] < x[n - i - 1]:
                    monotonic = False
                if x[n + i] < x[n + i + 1]:
                    monotonic = False
            if x[n] > threshold and monotonic:
                binary[n, k] = 1
                if x[n - 1] > x[n + 1]:
                    shift[n, k] = (x[n + 1] - x[n - 1]) / (x[n] - x[n + 1]) / 2
                else:
                    shift[n, k] = (x[n + 1] - x[n - 1]) / (x[n] - x[n - 1]) / 2


@pytest.mark.parametrize("neighbour", [2, 4])
def test_binarize_matches_original_loop(neighbour):
    rng = np.random.default_rng(0)
    # Glatte Kurven mit Peaks plus ein paar Plateaus, wie sie das Modell liefert.
    reg = rng.random((400, 6)).astype(np.float32)
    reg = np.apply_along_axis(lambda c: np.convolve(c, np.ones(5) / 5, mode="same"), 0, reg)
    reg = reg.astype(np.float32)
    reg[100:104, 1] = 0.8
    binary, shift = binarize_regression(reg, 0.3, neighbour)
    ref_binary, ref_shift = _original_binarize(reg, 0.3, neighbour)
    np.testing.assert_array_equal(binary, ref_binary)
    finite = np.isfinite(ref_shift)
    np.testing.assert_allclose(shift[finite], ref_shift[finite], rtol=1e-6, atol=1e-7)


def test_binarize_short_input_returns_zeros():
    reg = np.full((3, 2), 0.9, dtype=np.float32)
    binary, shift = binarize_regression(reg, 0.3, 2)
    assert not binary.any() and not shift.any()


def test_enframe_deframe_roundtrip_lengths():
    audio = np.arange(SEGMENT_SAMPLES * 3, dtype=np.float32)
    segments = enframe(audio)
    assert segments.shape == (5, SEGMENT_SAMPLES)
    np.testing.assert_array_equal(segments[1, :10], audio[SEGMENT_SAMPLES // 2 :][:10])
    # 1001 Frames je Segment (center=True), wie beim Modell.
    frames = np.zeros((5, 1001, 88), dtype=np.float32)
    assert deframe(frames).shape[0] == 750 + 3 * 500 + 750


def _single_note_outputs(frames: int = 300) -> dict[str, np.ndarray]:
    out = {k: np.zeros((frames, 88), dtype=np.float32) for k in
           ("reg_onset_output", "reg_offset_output", "frame_output", "velocity_output")}
    k = 60 - 21
    onset = 50
    out["reg_onset_output"][onset - 2 : onset + 3, k] = [0.2, 0.5, 0.9, 0.5, 0.2]
    out["frame_output"][onset:150, k] = 0.9
    out["reg_offset_output"][146:155, k] = [0.2, 0.3, 0.4, 0.6, 0.9, 0.6, 0.4, 0.3, 0.2]
    out["velocity_output"][onset, k] = 0.5
    out["reg_pedal_offset_output"] = np.zeros((frames, 1), dtype=np.float32)
    out["pedal_frame_output"] = np.zeros((frames, 1), dtype=np.float32)
    out["pedal_frame_output"][20:120, 0] = 0.9
    out["reg_pedal_offset_output"][116:125, 0] = [0.2, 0.3, 0.4, 0.6, 0.9, 0.6, 0.4, 0.3, 0.2]
    return out


def test_detect_notes_and_pedals_from_synthetic_curves():
    out = _single_note_outputs()
    notes = detect_notes(out)
    assert len(notes) == 1
    note = notes[0]
    assert note.pitch == 60
    assert note.onset == pytest.approx(0.50, abs=0.011)
    assert note.offset == pytest.approx(1.50, abs=0.011)
    assert note.velocity == 64
    pedals = detect_pedals(out)
    assert pedals == [PedalEvent(onset=pytest.approx(0.20), offset=pytest.approx(1.20, abs=0.011))]
