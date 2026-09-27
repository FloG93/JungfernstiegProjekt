"""Tonarten: Parsen, Erkennung (Krumhansl-Schmuckler), Transposition und Schreibweise.

Tonarten werden im music21-Format geschrieben, z. B. ``"E- major"`` oder ``"c# minor"``.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass

import numpy as np

LETTERS = "CDEFGAB"
LETTER_PC = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
_FIFTHS_MAJOR = {"F": -1, "C": 0, "G": 1, "D": 2, "A": 3, "E": 4, "B": 5}

# Krumhansl-Kessler-Profile (wie music21 analysis.discrete.KrumhanslSchmuckler)
_KS_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_KS_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

# Halbtonabstand zum Grundton → Skalenstufe (0–6) für die Schreibweise.
# Dur: #1, b3, #4, #5, b7 als Alterationen; Moll: natürliches Moll plus erhöhte 6./7. Stufe,
# dazu b2 (Neapolitaner), #3 und #4.
_DEGREE_MAJOR = (0, 0, 1, 2, 2, 3, 3, 4, 4, 5, 6, 6)
_DEGREE_MINOR = (0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6)

_KEY_RE = re.compile(
    r"^\s*([A-Ga-g])\s*(#{1,2}|-{1,2}|b{1,2}|is|es|s)?\s*"
    r"(major|minor|dur|moll|maj|min|m)?\s*$", re.IGNORECASE)

_DE_MODE = {"major": "Dur", "minor": "Moll"}


@dataclass(frozen=True)
class Key:
    letter: str  # Großbuchstabe C–B
    alter: int  # -2 … +2
    mode: str  # "major" | "minor"

    @property
    def tonic_pc(self) -> int:
        return (LETTER_PC[self.letter] + self.alter) % 12

    @property
    def sharps(self) -> int:
        """Anzahl Kreuze (negativ: B-Vorzeichen) der Tonart."""
        base = _FIFTHS_MAJOR[self.letter] + 7 * self.alter
        return base - 3 if self.mode == "minor" else base

    @property
    def tonic_name(self) -> str:
        acc = "#" * self.alter if self.alter > 0 else "-" * -self.alter
        return self.letter + acc

    def __str__(self) -> str:
        tonic = self.tonic_name if self.mode == "major" else self.tonic_name.lower()
        return f"{tonic} {self.mode}"

    @property
    def german(self) -> str:
        """Deutscher Name, z. B. „Es-Dur“, „cis-Moll“."""
        name = {"B": "H"}.get(self.letter, self.letter)
        if self.alter > 0:
            name += "is" * self.alter
        elif self.alter < 0:
            if self.letter == "B":
                name = "B" if self.alter == -1 else "Heses"
            elif self.letter in "AE":
                name += "s" + "es" * (-self.alter - 1)
            else:
                name += "es" * -self.alter
        if self.mode == "minor":
            name = name.lower()
        return f"{name}-{_DE_MODE[self.mode]}"


def parse_key(text: str) -> Key:
    match = _KEY_RE.match(text or "")
    if not match:
        raise ValueError(f"Ungültige Tonart: {text!r} (erwartet z. B. 'E- major')")
    letter_raw, acc, mode_raw = match.groups()
    letter = letter_raw.upper()
    acc = (acc or "").lower()
    if acc in ("#", "##", "is"):
        alter = 1 if acc in ("#", "is") else 2
    elif acc in ("-", "--", "b", "bb", "es", "s"):
        alter = -2 if acc in ("--", "bb") else -1
    else:
        alter = 0
    if mode_raw:
        mode = "minor" if mode_raw.lower() in ("minor", "moll", "min", "m") else "major"
    else:
        mode = "minor" if letter_raw.islower() else "major"
    return Key(letter, alter, mode)


def _spell_tonic(pc: int, mode: str) -> Key:
    """Wählt für einen Grundton die Schreibweise mit den wenigsten Vorzeichen."""
    candidates = []
    for letter in LETTERS:
        for alter in (-1, 0, 1):
            if (LETTER_PC[letter] + alter) % 12 == pc:
                key = Key(letter, alter, mode)
                candidates.append((abs(key.sharps), -key.sharps, key))
    candidates.sort(key=lambda c: (c[0], c[1]))
    return candidates[0][2]


def transpose_key(key: Key, semitones: int) -> Key:
    return _spell_tonic((key.tonic_pc + semitones) % 12, key.mode)


def detect_key(pitches: Iterable[int], weights: Iterable[float] | None = None) -> Key:
    """Krumhansl-Schmuckler: Korrelation des (gewichteten) Tonklassen-Histogramms."""
    hist = np.zeros(12)
    weights_list = list(weights) if weights is not None else None
    for i, p in enumerate(pitches):
        hist[p % 12] += weights_list[i] if weights_list is not None else 1.0
    if hist.sum() == 0:
        return Key("C", 0, "major")
    best: tuple[float, int, str] = (-2.0, 0, "major")
    for mode, profile in (("major", _KS_MAJOR), ("minor", _KS_MINOR)):
        for tonic in range(12):
            r = float(np.corrcoef(hist, np.roll(profile, tonic))[0, 1])
            if r > best[0]:
                best = (r, tonic, mode)
    return _spell_tonic(best[1], best[2])


@dataclass(frozen=True)
class Spelling:
    step: str
    alter: int
    octave: int

    @property
    def name(self) -> str:
        acc = "#" * self.alter if self.alter > 0 else "-" * -self.alter
        return f"{self.step}{acc}{self.octave}"


def spell(midi: int, key: Key) -> Spelling:
    """Schreibweise einer MIDI-Tonhöhe passend zur Tonart (Fis vs. Ges)."""
    offset = (midi - key.tonic_pc) % 12
    degree = (_DEGREE_MAJOR if key.mode == "major" else _DEGREE_MINOR)[offset]
    step = LETTERS[(LETTERS.index(key.letter) + degree) % 7]
    alter = (midi % 12 - LETTER_PC[step]) % 12
    if alter > 6:
        alter -= 12
    if abs(alter) > 2:  # sollte nicht vorkommen; zur Sicherheit neutral schreiben
        return spell(midi, Key("C", 0, "major"))
    octave = (midi - alter) // 12 - 1
    return Spelling(step, alter, octave)
