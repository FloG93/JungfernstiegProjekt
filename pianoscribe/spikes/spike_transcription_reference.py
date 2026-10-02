"""Spike: Referenzlauf mit dem ORIGINALEN piano_transcription_inference (eigene venv).

Aufruf:  /tmp/.../spikevenv/bin/python spike_transcription_reference.py <audio> <checkpoint> <out.json>
Schreibt die Noten- und Pedal-Events als JSON, damit die gevendorte Fassung dagegen
verglichen werden kann.
"""

import json
import subprocess
import sys
import time

import numpy as np
import torch
from piano_transcription_inference import PianoTranscription, sample_rate


def load_audio(path: str, sr: int, mono: bool = True) -> tuple[np.ndarray, int]:
    # Das Paket nutzt librosa.core.audio, das es in librosa >= 0.10 nicht mehr gibt.
    cmd = ["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(sr), "-"]
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy(), sr


def main() -> None:
    audio_path, checkpoint, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    t0 = time.perf_counter()
    audio, _ = load_audio(audio_path, sr=sample_rate, mono=True)
    t_load = time.perf_counter() - t0
    t0 = time.perf_counter()
    transcriptor = PianoTranscription(device=torch.device("cpu"), checkpoint_path=checkpoint)
    t_model = time.perf_counter() - t0
    t0 = time.perf_counter()
    result = transcriptor.transcribe(audio, None)
    t_run = time.perf_counter() - t0
    notes = [
        {"onset": float(e["onset_time"]), "offset": float(e["offset_time"]),
         "pitch": int(e["midi_note"]), "velocity": int(e["velocity"])}
        for e in result["est_note_events"]
    ]
    pedals = [{"onset": float(e["onset_time"]), "offset": float(e["offset_time"])}
              for e in result["est_pedal_events"]]
    with open(out_path, "w") as f:
        json.dump({"notes": notes, "pedals": pedals,
                   "timing": {"load": t_load, "model": t_model, "transcribe": t_run,
                              "audio_s": len(audio) / sample_rate}}, f, indent=1)
    print(f"{len(notes)} Noten, {len(pedals)} Pedal-Events; Laden {t_load:.1f}s, "
          f"Modell {t_model:.1f}s, Transkription {t_run:.1f}s für {len(audio) / sample_rate:.1f}s")


if __name__ == "__main__":
    main()
