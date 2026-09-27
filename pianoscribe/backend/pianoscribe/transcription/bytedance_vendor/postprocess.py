"""Nachverarbeitung: Modellausgaben → Noten- und Pedal-Events.

Angepasst aus piano_transcription_inference (utilities.RegressionPostProcessor, piano_vad),
MIT-Lizenz, siehe LICENSE. Die Peak-Erkennung ist vektorisiert, liefert aber dieselben
Ergebnisse wie das Original.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .model import BEGIN_NOTE, FRAMES_PER_SECOND, VELOCITY_SCALE

ONSET_THRESHOLD = 0.3
OFFSET_THRESHOLD = 0.3
FRAME_THRESHOLD = 0.1
PEDAL_OFFSET_THRESHOLD = 0.2
PEDAL_FRAME_THRESHOLD = 0.5
MAX_NOTE_FRAMES = 600  # Original: Noten ohne erkanntes Ende werden nach 6 s beendet


@dataclass(frozen=True)
class NoteEvent:
    onset: float
    offset: float
    pitch: int
    velocity: int


@dataclass(frozen=True)
class PedalEvent:
    onset: float
    offset: float


def binarize_regression(reg: np.ndarray, threshold: float,
                        neighbour: int) -> tuple[np.ndarray, np.ndarray]:
    """Lokale Maxima der Regressionskurve (monoton steigend/fallend) + Sub-Frame-Versatz.

    ``reg`` hat die Form (frames, classes). Entspricht
    ``RegressionPostProcessor.get_binarized_output_from_regression``.
    """
    frames = reg.shape[0]
    binary = np.zeros_like(reg)
    shift = np.zeros_like(reg)
    if frames <= 2 * neighbour:
        return binary, shift
    lo, hi = neighbour, frames - neighbour
    center = reg[lo:hi]
    cond = center > threshold
    for i in range(neighbour):
        cond &= reg[lo - i : hi - i] >= reg[lo - i - 1 : hi - i - 1]
        cond &= reg[lo + i : hi + i] >= reg[lo + i + 1 : hi + i + 1]
    prev = reg[lo - 1 : hi - 1]
    nxt = reg[lo + 1 : hi + 1]
    with np.errstate(divide="ignore", invalid="ignore"):
        shift_val = np.where(prev > nxt, (nxt - prev) / (center - nxt) / 2,
                             (nxt - prev) / (center - prev) / 2)
    binary[lo:hi][cond] = 1
    shift[lo:hi][cond] = shift_val[cond]
    return binary, shift


def _detect_notes_one_pitch(frame: np.ndarray, onset: np.ndarray, onset_shift: np.ndarray,
                            offset: np.ndarray, offset_shift: np.ndarray,
                            velocity: np.ndarray) -> list[tuple[int, int, float, float, float]]:
    """Entspricht ``piano_vad.note_detection_with_onset_offset_regress``."""
    out: list[tuple[int, int, float, float, float]] = []
    bgn: int | None = None
    frame_disappear: int | None = None
    offset_occur: int | None = None
    frames = onset.shape[0]
    for i in range(frames):
        if onset[i] == 1:
            if bgn is not None:
                # Zwei Onsets hintereinander, z. B. bei gehaltenem Pedal.
                out.append((bgn, max(i - 1, 0), onset_shift[bgn], 0.0, velocity[bgn]))
                frame_disappear, offset_occur = None, None
            bgn = i
        if bgn is not None and i > bgn:
            if frame[i] <= FRAME_THRESHOLD and frame_disappear is None:
                frame_disappear = i
            if offset[i] == 1 and offset_occur is None:
                offset_occur = i
            if frame_disappear is not None:
                if offset_occur is not None and offset_occur - bgn > frame_disappear - offset_occur:
                    fin = offset_occur
                else:
                    fin = frame_disappear
                out.append((bgn, fin, onset_shift[bgn], offset_shift[fin], velocity[bgn]))
                bgn, frame_disappear, offset_occur = None, None, None
            if bgn is not None and (i - bgn >= MAX_NOTE_FRAMES or i == frames - 1):
                out.append((bgn, i, onset_shift[bgn], offset_shift[i], velocity[bgn]))
                bgn, frame_disappear, offset_occur = None, None, None
    return out


def detect_notes(outputs: dict[str, np.ndarray]) -> list[NoteEvent]:
    onset, onset_shift = binarize_regression(outputs["reg_onset_output"], ONSET_THRESHOLD, 2)
    offset, offset_shift = binarize_regression(outputs["reg_offset_output"], OFFSET_THRESHOLD, 4)
    frame = outputs["frame_output"]
    velocity = outputs["velocity_output"]
    events: list[NoteEvent] = []
    for k in range(frame.shape[1]):
        tuples = _detect_notes_one_pitch(frame[:, k], onset[:, k], onset_shift[:, k],
                                         offset[:, k], offset_shift[:, k], velocity[:, k])
        for bgn, fin, on_shift, off_shift, vel in tuples:
            # Wie im Original: in float64 rechnen, dann auf float32 runden.
            on_t = np.float32((bgn + float(on_shift)) / FRAMES_PER_SECOND)
            off_t = np.float32((fin + float(off_shift)) / FRAMES_PER_SECOND)
            events.append(NoteEvent(float(on_t), float(off_t), k + BEGIN_NOTE,
                                    int(np.float32(vel) * VELOCITY_SCALE)))
    events.sort(key=lambda e: (e.onset, e.pitch))
    return events


def detect_pedals(outputs: dict[str, np.ndarray]) -> list[PedalEvent]:
    """Entspricht ``piano_vad.pedal_detection_with_onset_offset_regress``."""
    offset, offset_shift = binarize_regression(outputs["reg_pedal_offset_output"],
                                               PEDAL_OFFSET_THRESHOLD, 4)
    frame = outputs["pedal_frame_output"][:, 0]
    offset_1d, shift_1d = offset[:, 0], offset_shift[:, 0]
    tuples: list[tuple[int, int, float]] = []
    bgn: int | None = None
    frame_disappear: int | None = None
    offset_occur: int | None = None
    for i in range(1, frame.shape[0]):
        if frame[i] >= PEDAL_FRAME_THRESHOLD and frame[i] > frame[i - 1] and bgn is None:
            bgn = i
        if bgn is not None and i > bgn:
            if frame[i] <= PEDAL_FRAME_THRESHOLD and frame_disappear is None:
                frame_disappear = i
            if offset_1d[i] == 1 and offset_occur is None:
                offset_occur = i
            if offset_occur is not None:
                tuples.append((bgn, offset_occur, shift_1d[offset_occur]))
                bgn, frame_disappear, offset_occur = None, None, None
            elif frame_disappear is not None and i - frame_disappear >= 10:
                tuples.append((bgn, frame_disappear, shift_1d[frame_disappear]))
                bgn, frame_disappear, offset_occur = None, None, None
    tuples.sort(key=lambda t: t[0])
    return [PedalEvent(float(np.float32(b / FRAMES_PER_SECOND)),
                       float(np.float32((f + float(s)) / FRAMES_PER_SECOND)))
            for b, f, s in tuples]
