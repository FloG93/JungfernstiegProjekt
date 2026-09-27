"""Synthetisches Test-Audio mit bekannter Ground Truth.

Klavier wird aus MIDI über die Salamander-Samples gerendert (``assets/samples``), dazu
lassen sich Schlagzeug, Bass und ein Pad mischen. Das Modul ist kein Teil der App; es dient
Spikes, Integrationstests und der Evaluation.
"""

from __future__ import annotations

import math
import subprocess
from collections import defaultdict
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import mido
import numpy as np
import soundfile as sf
from scipy import signal as sps

SAMPLE_DIR = Path(__file__).resolve().parents[2] / "assets" / "samples" / "salamander"
_PITCH_CLASS = {"C": 0, "Ds": 3, "Fs": 6, "A": 9}


@dataclass(frozen=True)
class SynthNote:
    pitch: int
    start: float
    end: float
    velocity: int = 80


@dataclass(frozen=True)
class SynthPedal:
    start: float
    end: float


@dataclass
class Piece:
    """Ein Testschnipsel mit Ground Truth (Zeiten in Sekunden)."""

    notes: list[SynthNote]
    pedals: list[SynthPedal]
    bpm: float
    beats_per_bar: int
    beats: list[float]
    downbeats: list[float]
    key: str
    pickup_beats: int = 0
    bass: list[SynthNote] = field(default_factory=list)
    pad: list[SynthNote] = field(default_factory=list)

    @property
    def duration(self) -> float:
        return max(n.end for n in self.notes)


def _sample_midi(name: str) -> int:
    letters = name.rstrip("0123456789")
    octave = int(name[len(letters) :])
    return 12 * (octave + 1) + _PITCH_CLASS[letters]


def decode_audio(path: Path, sr: int, channels: int = 2) -> np.ndarray:
    """Dekodiert eine Audiodatei per ffmpeg zu float32 (n, channels)."""
    cmd = ["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le",
           "-ac", str(channels), "-ar", str(sr), "-"]
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, channels).copy()


@lru_cache(maxsize=4)
def load_samples(sr: int = 44100) -> dict[int, np.ndarray]:
    """Lädt alle Samples; führende Stille wird entfernt, damit Onsets exakt stimmen."""
    samples: dict[int, np.ndarray] = {}
    for path in sorted(SAMPLE_DIR.glob("*.mp3")):
        audio = decode_audio(path, sr)
        level = np.abs(audio).max(axis=1)
        onset = int(np.argmax(level > level.max() * 0.01))
        samples[_sample_midi(path.stem)] = audio[max(0, onset - int(0.001 * sr)) :]
    if not samples:
        raise FileNotFoundError(
            f"Keine Samples in {SAMPLE_DIR}. Erst 'uv run python ../scripts/fetch_assets.py'."
        )
    return samples


def _sounding_end(note: SynthNote, pedals: list[SynthPedal], next_same: float) -> float:
    stop = note.end
    for pedal in pedals:
        if pedal.start <= stop < pedal.end:
            stop = pedal.end
    return min(stop, next_same)


def render_piano(notes: list[SynthNote], pedals: list[SynthPedal] | None = None,
                 sr: int = 44100, release_tau: float = 0.08) -> np.ndarray:
    """Rendert Klaviernoten zu Stereo-Audio (n, 2)."""
    pedals = pedals or []
    samples = load_samples(sr)
    keys = np.array(sorted(samples))
    total = max(n.end for n in notes) + 4.0
    out = np.zeros((int(total * sr) + 1, 2), dtype=np.float64)

    starts_by_pitch: dict[int, list[float]] = defaultdict(list)
    for n in notes:
        starts_by_pitch[n.pitch].append(n.start)

    for note in notes:
        later = [s for s in starts_by_pitch[note.pitch] if s > note.start]
        stop = _sounding_end(note, pedals, min(later, default=math.inf))
        base = int(keys[np.argmin(np.abs(keys - note.pitch))])
        sample = samples[base]
        ratio = 2.0 ** ((note.pitch - base) / 12.0)
        length = stop - note.start + 6 * release_tau
        n_out = min(int(length * sr), int((len(sample) - 2) / ratio))
        pos = np.arange(n_out) * ratio
        idx = pos.astype(np.int64)
        frac = (pos - idx)[:, None]
        chunk = sample[idx] * (1.0 - frac) + sample[idx + 1] * frac
        t = np.arange(n_out) / sr
        rel = stop - note.start
        env = np.where(t > rel, np.exp(-(t - rel) / release_tau), 1.0)
        amp = (note.velocity / 127.0) ** 1.7
        i0 = round(note.start * sr)
        out[i0 : i0 + n_out] += chunk * (env * amp)[:, None]
    return out.astype(np.float32)


def _env(n: int, sr: int, attack: float, tau: float) -> np.ndarray:
    t = np.arange(n) / sr
    return np.minimum(t / max(attack, 1e-4), 1.0) * np.exp(-t / tau)


def render_drums(beats: list[float], beats_per_bar: int, first_downbeat: float,
                 total: float, sr: int = 44100, seed: int = 1) -> np.ndarray:
    """Kick auf 1/3, Snare auf 2/4, Hi-Hat in Achteln (mono)."""
    rng = np.random.default_rng(seed)
    out = np.zeros(int(total * sr) + sr, dtype=np.float64)
    kick_n, snare_n, hat_n = int(0.35 * sr), int(0.25 * sr), int(0.06 * sr)
    t = np.arange(kick_n) / sr
    freq = 48 + 110 * np.exp(-t / 0.035)
    kick = np.sin(2 * np.pi * np.cumsum(freq) / sr) * _env(kick_n, sr, 0.002, 0.12)
    hp_b, hp_a = sps.butter(2, 6000, "highpass", fs=sr)
    bp_b, bp_a = sps.butter(2, [1200, 6000], "bandpass", fs=sr)
    beat_period = float(np.median(np.diff(beats)))

    def add(x: np.ndarray, at: float, gain: float) -> None:
        i0 = round(at * sr)
        if 0 <= i0 < len(out):
            out[i0 : i0 + len(x)] += gain * x[: len(out) - i0]

    for b in beats:
        if b < first_downbeat - 1e-6:
            continue
        idx = round((b - first_downbeat) / beat_period) % beats_per_bar
        if idx % 2 == 0:
            add(kick, b, 0.9)
        else:
            noise = rng.standard_normal(snare_n)
            ts = np.arange(snare_n) / sr
            snare = sps.lfilter(bp_b, bp_a, noise) * _env(snare_n, sr, 0.001, 0.07)
            snare += 0.6 * np.sin(2 * np.pi * 185 * ts) * _env(snare_n, sr, 0.001, 0.05)
            add(snare, b, 0.7)
        for half in (0.0, 0.5):
            hat = sps.lfilter(hp_b, hp_a, rng.standard_normal(hat_n))
            hat *= _env(hat_n, sr, 0.0005, 0.015)
            add(hat, b + half * beat_period, 0.35)
    return out.astype(np.float32)


def render_synth(notes: list[SynthNote], total: float, sr: int = 44100, cutoff: float = 900.0,
                 detune: float = 0.0, attack: float = 0.005, release: float = 0.06) -> np.ndarray:
    """Einfacher Sägezahn-Synth mit Tiefpass (für Bass und Pad), mono."""
    out = np.zeros(int(total * sr) + sr, dtype=np.float64)
    b, a = sps.butter(2, cutoff, "lowpass", fs=sr)
    for note in notes:
        dur = note.end - note.start
        n = int((dur + 5 * release) * sr)
        t = np.arange(n) / sr
        f = 440.0 * 2 ** ((note.pitch - 69) / 12)
        wave = np.zeros(n)
        for d in ((0.0,) if detune == 0 else (-detune, detune)):
            ph = (f * (1 + d) * t) % 1.0
            wave += 2 * ph - 1
        env = np.minimum(t / attack, 1.0) * np.where(t > dur, np.exp(-(t - dur) / release), 1.0)
        tone = sps.lfilter(b, a, wave) * env * (note.velocity / 127.0)
        i0 = round(note.start * sr)
        out[i0 : i0 + n] += tone[: len(out) - i0]
    return out.astype(np.float32)


def mix(parts: list[tuple[np.ndarray, float]], peak: float = 0.89) -> np.ndarray:
    """Mischt (Audio, Pegel)-Paare (mono oder stereo) zu Stereo und normalisiert."""
    length = max(len(p) for p, _ in parts)
    out = np.zeros((length, 2), dtype=np.float64)
    for audio, gain in parts:
        stereo = audio[:, None].repeat(2, axis=1) if audio.ndim == 1 else audio
        out[: len(stereo)] += gain * stereo
    return (out * (peak / max(np.abs(out).max(), 1e-9))).astype(np.float32)


def write_wav(path: Path, audio: np.ndarray, sr: int = 44100) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), audio, sr, subtype="PCM_16")


def write_midi(path: Path, notes: list[SynthNote], pedals: list[SynthPedal],
               bpm: float = 120.0, ticks_per_beat: int = 480) -> None:
    """Schreibt Noten und Pedal als MIDI mit konstantem Tempo."""
    mid = mido.MidiFile(ticks_per_beat=ticks_per_beat)
    track = mido.MidiTrack()
    mid.tracks.append(track)
    track.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(bpm), time=0))
    events: list[tuple[float, int, mido.Message]] = []
    for n in notes:
        events.append((n.start, 1, mido.Message("note_on", note=n.pitch, velocity=n.velocity)))
        events.append((n.end, 0, mido.Message("note_off", note=n.pitch, velocity=0)))
    for p in pedals:
        events.append((p.start, 2, mido.Message("control_change", control=64, value=127)))
        events.append((p.end, 0, mido.Message("control_change", control=64, value=0)))
    events.sort(key=lambda e: (e[0], e[1]))
    last_tick = 0
    for seconds, _, msg in events:
        tick = round(seconds * bpm / 60.0 * ticks_per_beat)
        track.append(msg.copy(time=max(0, tick - last_tick)))
        last_tick = max(last_tick, tick)
    mid.save(str(path))


def read_midi(path: Path) -> tuple[list[SynthNote], list[SynthPedal]]:
    """Liest Noten und Sustain-Pedal (CC64) aus einer MIDI-Datei (Zeiten in Sekunden)."""
    now = 0.0
    active: dict[int, tuple[float, int]] = {}
    notes: list[SynthNote] = []
    pedals: list[SynthPedal] = []
    pedal_start: float | None = None
    for msg in mido.MidiFile(str(path)):
        now += msg.time
        if msg.type == "note_on" and msg.velocity > 0:
            if msg.note in active:
                s, v = active.pop(msg.note)
                notes.append(SynthNote(msg.note, s, now, v))
            active[msg.note] = (now, msg.velocity)
        elif msg.type in ("note_off", "note_on") and msg.note in active:
            s, v = active.pop(msg.note)
            notes.append(SynthNote(msg.note, s, now, v))
        elif msg.type == "control_change" and msg.control == 64:
            if msg.value >= 64 and pedal_start is None:
                pedal_start = now
            elif msg.value < 64 and pedal_start is not None:
                pedals.append(SynthPedal(pedal_start, now))
                pedal_start = None
    for pitch, (s, v) in active.items():
        notes.append(SynthNote(pitch, s, now, v))
    if pedal_start is not None:
        pedals.append(SynthPedal(pedal_start, now))
    notes.sort(key=lambda n: (n.start, n.pitch))
    return notes, pedals


# --------------------------------------------------------------------------------------------
# Demo-Stück: Ballade in Es-Dur, 4/4, 96 BPM, ein Viertel Auftakt, 8 Takte.
# Die linke Hand reicht bis D4 hinauf (Test für die automatische Händetrennung),
# die rechte Hand enthält Triolen, Synkopen, Sechzehntel und Akkorde.
# --------------------------------------------------------------------------------------------

# (Beat im Takt, Dauer in Beats, Tonhöhen) je Takt; Takt 0 ist der Auftakt.
DEMO_RH: dict[int, list[tuple[float, float, tuple[int, ...]]]] = {
    0: [(3, 1, (70,))],
    1: [(0, 1.5, (67, 75)), (1.5, 0.5, (74,)), (2, 1, (75,)), (3, 1, (79,))],
    2: [(0, 2, (75, 79)), (2, 0.5, (77,)), (2.5, 0.5, (75,)), (3, 0.5, (74,)), (3.5, 0.5, (72,))],
    3: [(0, 1, (72, 75)), (1, 1 / 3, (68,)), (4 / 3, 1 / 3, (72,)), (5 / 3, 1 / 3, (75,)),
        (2, 2, (80,))],
    4: [(0, 1.5, (77,)), (1.5, 0.5, (75,)), (2, 1, (74,)), (3, 1, (70,))],
    5: [(0, 1, (75,)), (1, 0.5, (79,)), (1.5, 1, (82,)), (2.5, 0.5, (79,)), (3, 1, (75,))],
    6: [(0, 2, (77, 80)), (2, 0.5, (79,)), (2.5, 0.5, (77,)), (3, 0.5, (75,)),
        (3.5, 0.25, (74,)), (3.75, 0.25, (75,))],
    7: [(0, 1, (72, 75)), (1, 1, (68,)), (2, 1, (74, 77)), (3, 1, (70,))],
    8: [(0, 4, (67, 70, 75))],
}
# Akkordgrundtöne (MIDI, Oktave 2) je Halbtakt für die gebrochenen Achtel der linken Hand.
DEMO_LH_ROOTS: dict[int, tuple[int, int]] = {
    1: (39, 39), 2: (36, 36), 3: (44, 44), 4: (46, 46),
    5: (39, 39), 6: (41, 41), 7: (44, 46),
}
DEMO_LH_THIRD = {39: 4, 36: 3, 44: 4, 46: 4, 41: 3}  # große/kleine Terz je Grundton


def demo_piece(bpm: float = 96.0, start: float = 1.0, seed: int = 7,
               jitter_ms: float = 8.0) -> Piece:
    """Erzeugt das Demo-Stück mit leichter menschlicher Ungenauigkeit."""
    rng = np.random.default_rng(seed)
    beat = 60.0 / bpm
    bar0 = start - 3 * beat  # fiktiver Beginn von Takt 0 (Auftakt = Beat 4)

    def at(bar: int, pos: float) -> float:
        return bar0 + (bar * 4 + pos) * beat

    def jit() -> float:
        return float(np.clip(rng.normal(0, jitter_ms / 1000), -2.5 * jitter_ms / 1000,
                             2.5 * jitter_ms / 1000))

    notes: list[SynthNote] = []
    for bar, events in DEMO_RH.items():
        for pos, dur, pitches in events:
            t0 = at(bar, pos) + jit()
            for p in pitches:
                vel = int(np.clip(rng.normal(84, 6), 50, 115))
                notes.append(SynthNote(p, t0 + jit() * 0.3, t0 + dur * beat * 0.92, vel))
    for bar, (root_a, root_b) in DEMO_LH_ROOTS.items():
        for eighth in range(8):
            root = root_a if eighth < 4 else root_b
            third = DEMO_LH_THIRD[root]
            pattern = [root, root + 7, root + 12 + third, root + 7]
            t0 = at(bar, eighth * 0.5) + jit()
            vel = int(np.clip(rng.normal(64 if eighth % 4 else 74, 5), 40, 100))
            notes.append(SynthNote(pattern[eighth % 4], t0, t0 + 0.5 * beat * 0.95, vel))
    for p in (39, 51):  # Schlussakkord links
        t0 = at(8, 0) + jit()
        notes.append(SynthNote(p, t0, t0 + 4 * beat * 0.95, 70))
    notes.sort(key=lambda n: (n.start, n.pitch))

    pedals: list[SynthPedal] = []
    for bar in range(1, 9):
        changes = [0.0, 2.0] if bar == 7 else [0.0]
        for i, pos in enumerate(changes):
            end_pos = changes[i + 1] if i + 1 < len(changes) else 4.0
            end = at(bar, end_pos) - 0.03 if bar < 8 else at(bar, 4.0) + 0.5
            pedals.append(SynthPedal(at(bar, pos) + 0.09, end))

    beats = [at(0, 3) + i * beat for i in range(0, 8 * 4 + 2)]
    downbeats = [at(bar, 0) for bar in range(1, 10)]
    bass = [SynthNote(DEMO_LH_ROOTS.get(bar, (39, 39))[half] - 12,
                      at(bar, half * 2) + 0.005, at(bar, half * 2 + 2) - 0.05, 100)
            for bar in range(1, 9) for half in (0, 1)]
    pad_chords = {1: (63, 67, 70), 2: (63, 67, 72), 3: (63, 68, 72), 4: (62, 65, 70),
                  5: (63, 67, 70), 6: (65, 68, 72), 7: (63, 68, 72), 8: (63, 67, 70)}
    pad = [SynthNote(p, at(bar, 0), at(bar, 4) - 0.02, 70)
           for bar, chord in pad_chords.items() for p in chord]
    return Piece(notes=notes, pedals=pedals, bpm=bpm, beats_per_bar=4, beats=beats,
                 downbeats=downbeats, key="E- major", pickup_beats=1, bass=bass, pad=pad)


def render_demo(out_dir: Path, sr: int = 44100, with_pad: bool = True) -> dict[str, Path]:
    """Rendert das Demo-Stück: Klavier solo, Mix (Klavier+Drums+Bass+Pad) und Ground Truth."""
    piece = demo_piece()
    total = piece.duration + 3.0
    piano = render_piano(piece.notes, piece.pedals, sr)
    drums = render_drums(piece.beats, piece.beats_per_bar, piece.downbeats[0], total, sr)
    bass = render_synth(piece.bass, total, sr, cutoff=700)
    parts: list[tuple[np.ndarray, float]] = [(piano, 1.0), (drums, 0.55), (bass, 0.35)]
    if with_pad:
        parts.append((render_synth(piece.pad, total, sr, cutoff=1400, detune=0.004,
                                   attack=0.25, release=0.3), 0.08))
    paths = {
        "piano": out_dir / "demo_piano.wav",
        "mix": out_dir / "demo_mix.wav",
        "midi": out_dir / "demo_truth.mid",
    }
    write_wav(paths["piano"], mix([(piano, 1.0)]), sr)
    write_wav(paths["mix"], mix(parts), sr)
    write_midi(paths["midi"], piece.notes, piece.pedals, piece.bpm)
    return paths


if __name__ == "__main__":
    import sys

    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("testdata")
    for kind, p in render_demo(target).items():
        print(kind, p)
