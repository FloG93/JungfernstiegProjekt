"""Beat-Raster: Abbildung zwischen Sekunden und Schlagpositionen.

Grundlage sind die Beats von beat_this. Zwischen zwei Beats wird linear interpoliert, damit
Tempo-Schwankungen abgefangen werden; außerhalb wird mit dem lokalen Beat-Abstand
extrapoliert. Setzt der Nutzer Tempo oder ersten Taktschlag, haben diese Werte Vorrang.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np

from .meter import TimeSig

FALLBACK_BPM = 100.0
_MIN_BEAT_GAP = 0.08  # s; dichter liegende Beats gelten als Dubletten


@dataclass
class BeatGrid:
    times: np.ndarray  # Beat-Zeiten in s (streng monoton), deckt alle Noten ab
    bar_beat: int  # Index eines Beats, der auf einem Taktanfang liegt (bestimmt die Phase)
    beats_per_bar: int
    tempo_bpm: float
    tempo_source: str  # "auto" | "manual" | "fallback"
    downbeat_source: str  # "auto" | "manual" | "fallback"

    def to_beat(self, t: float | np.ndarray) -> np.ndarray:
        """Sekunden → fraktionaler Beat-Index (linear inter-/extrapoliert)."""
        t_arr = np.atleast_1d(np.asarray(t, dtype=float))
        times = self.times
        idx = np.clip(np.searchsorted(times, t_arr, side="right") - 1, 0, len(times) - 2)
        left, right = times[idx], times[idx + 1]
        return idx + (t_arr - left) / (right - left)

    def to_time(self, b: float | np.ndarray) -> np.ndarray:
        """Fraktionaler Beat-Index → Sekunden."""
        b_arr = np.atleast_1d(np.asarray(b, dtype=float))
        times = self.times
        idx = np.clip(np.floor(b_arr).astype(int), 0, len(times) - 2)
        return times[idx] + (b_arr - idx) * (times[idx + 1] - times[idx])

    def beat_duration(self, index: int) -> float:
        i = int(np.clip(index, 0, len(self.times) - 2))
        return float(self.times[i + 1] - self.times[i])


def _clean_beats(beats: Sequence[float]) -> np.ndarray:
    arr = np.array(sorted(float(b) for b in beats))
    if arr.size == 0:
        return arr
    keep = [arr[0]]
    for b in arr[1:]:
        if b - keep[-1] >= _MIN_BEAT_GAP:
            keep.append(b)
    return np.array(keep)


def regularize_beats(beats: np.ndarray, tolerance: float = 0.25) -> np.ndarray:
    """Füllt verpasste Beats auf und entfernt Doppelerkennungen.

    Ein Abstand von etwa n × Periode (n ≥ 2) bekommt n − 1 gleichmäßig verteilte Beats; ein
    Beat, der näher als gut die halbe Periode am vorigen liegt, wird verworfen.
    """
    if beats.size < 4:
        return beats
    period = float(np.median(np.diff(beats)))
    out = [float(beats[0])]
    for b in beats[1:]:
        gap = float(b) - out[-1]
        n = round(gap / period)
        if gap < 0.55 * period:
            continue
        if n >= 2 and abs(gap / n - period) <= tolerance * period:
            out.extend(out[-1] + gap * k / n for k in range(1, n))
        out.append(float(b))
    return np.array(out)


def smooth_beats(beats: np.ndarray, radius: int = 2, max_shift: float = 0.025) -> np.ndarray:
    """Gleitende lineare Glättung gegen den Frame-Jitter von beat_this (20-ms-Raster).

    Konstantes Tempo bleibt exakt erhalten. Die Korrektur ist auf ``max_shift`` begrenzt, damit
    echte Tempowechsel (z. B. ein Ritardando) nicht verwischt werden.
    """
    n = beats.size
    if n < 2 * radius + 1:
        return beats
    out = beats.copy()
    idx = np.arange(n)
    for i in range(n):
        lo, hi = max(0, i - radius), min(n, i + radius + 1)
        if hi - lo < 3:
            continue
        slope, intercept = np.polyfit(idx[lo:hi], beats[lo:hi], 1)
        out[i] = beats[i] + np.clip(slope * i + intercept - beats[i], -max_shift, max_shift)
    return out


def _extend(times: np.ndarray, start: float, end: float, edge: int = 4) -> tuple[np.ndarray, int]:
    """Verlängert die Beat-Liste nach vorn und hinten. Gibt (Beats, Anzahl vorn ergänzt)."""
    head = float(np.median(np.diff(times[: edge + 1])))
    tail = float(np.median(np.diff(times[-edge - 1 :])))
    before: list[float] = []
    t = times[0]
    while t > start:
        t -= head
        before.append(t)
    after: list[float] = []
    t = times[-1]
    while t < end:
        t += tail
        after.append(t)
    return np.concatenate([before[::-1], times, after]), len(before)


def _phase_from_downbeats(times: np.ndarray, downbeats: Sequence[float],
                          beats_per_bar: int) -> int | None:
    """Mehrheitsentscheid: welcher Beat-Rest (mod Schläge pro Takt) trägt die Downbeats?"""
    if not downbeats or len(times) < 2:
        return None
    period = float(np.median(np.diff(times)))
    votes: Counter[int] = Counter()
    first_seen: dict[int, int] = {}
    for d in downbeats:
        i = int(np.argmin(np.abs(times - d)))
        if abs(times[i] - d) <= 0.25 * period:
            residue = i % beats_per_bar
            votes[residue] += 1
            first_seen.setdefault(residue, i)
    if not votes:
        return None
    best = max(votes.items(), key=lambda kv: (kv[1], -first_seen[kv[0]]))
    return first_seen[best[0]]


def build_grid(beats: Sequence[float], downbeats: Sequence[float], ts: TimeSig,
               span: tuple[float, float], tempo_bpm: float | None = None,
               first_downbeat: float | None = None) -> BeatGrid:
    """Erzeugt das Beat-Raster.

    ``span`` ist (erster Onset, letztes Ende) der Noten in s; das Raster deckt diesen Bereich
    plus Reserve ab. ``first_downbeat`` bezieht sich wie ``span`` auf den getrimmten Ausschnitt.
    """
    bpb = ts.beats_per_bar
    start, end = span
    detected = smooth_beats(regularize_beats(_clean_beats(beats)))

    if tempo_bpm is not None:
        period = 60.0 / tempo_bpm
        if first_downbeat is not None:
            anchor, db_source = first_downbeat, "manual"
        else:
            auto = _auto_downbeat(detected, downbeats, bpb)
            anchor, db_source = (auto, "auto") if auto is not None else (start, "fallback")
        k0 = int(np.floor((start - anchor) / period)) - 2
        k1 = int(np.ceil((end - anchor) / period)) + bpb + 2
        times = anchor + period * np.arange(k0, k1 + 1)
        return BeatGrid(times, -k0, bpb, float(tempo_bpm), "manual", db_source)

    if detected.size >= 4:
        times, added = _extend(detected, start - 0.5, end + 60.0 / 40 * bpb)
        period = float(np.median(np.diff(detected)))
        tempo = 60.0 / period
        if first_downbeat is not None:
            bar_beat = int(np.argmin(np.abs(times - first_downbeat)))
            db_source = "manual"
        else:
            phase = _phase_from_downbeats(detected, downbeats, bpb)
            if phase is not None:
                bar_beat, db_source = phase + added, "auto"
            else:
                bar_beat = int(np.argmin(np.abs(times - start)))
                db_source = "fallback"
        return BeatGrid(times, bar_beat, bpb, round(tempo, 1), "auto", db_source)

    # Keine brauchbaren Beats: festes Raster mit Standardtempo.
    period = 60.0 / FALLBACK_BPM
    anchor = first_downbeat if first_downbeat is not None else start
    k0 = int(np.floor((start - anchor) / period)) - 2
    k1 = int(np.ceil((end - anchor) / period)) + bpb + 2
    times = anchor + period * np.arange(k0, k1 + 1)
    return BeatGrid(times, -k0, bpb, FALLBACK_BPM, "fallback",
                    "manual" if first_downbeat is not None else "fallback")


def _auto_downbeat(detected: np.ndarray, downbeats: Sequence[float], bpb: int) -> float | None:
    if detected.size >= 2:
        phase = _phase_from_downbeats(detected, downbeats, bpb)
        if phase is not None:
            return float(detected[phase])
    if downbeats:
        return float(downbeats[0])
    return None
