"""Spike: Demucs htdemucs_6s programmatisch (ohne demucs.api/torchaudio.save).

Aufruf (aus backend/):  uv run python ../spikes/spike_demucs.py <mix.wav> <models_dir> <out_dir> [ref_piano.wav]
"""

import resource
import shutil
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from demucs.apply import apply_model
from demucs.pretrained import get_model


def sdr(ref: np.ndarray, est: np.ndarray) -> float:
    """Skaleninvariantes SDR (die Pegel von Mix und Referenz unterscheiden sich)."""
    n = min(len(ref), len(est))
    ref, est = ref[:n].ravel().astype(np.float64), est[:n].ravel().astype(np.float64)
    target = (est @ ref) / (ref @ ref) * ref
    return float(10 * np.log10(np.sum(target**2) / max(np.sum((est - target) ** 2), 1e-12)))


def main() -> None:
    mix_path, models_dir, out_dir = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    ref_path = Path(sys.argv[4]) if len(sys.argv) > 4 else None
    repo = models_dir / "demucs"
    repo.mkdir(parents=True, exist_ok=True)
    import demucs

    shutil.copy(Path(demucs.__file__).parent / "remote" / "htdemucs_6s.yaml", repo)
    weights = models_dir / "5c90dfd2-34c22ccb.th"
    if not (repo / weights.name).exists():
        shutil.copy(weights, repo / weights.name)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    t0 = time.perf_counter()
    model = get_model("htdemucs_6s", repo=repo)
    model.to(device)
    print(f"Modell geladen in {time.perf_counter() - t0:.1f}s; sources={model.sources}, "
          f"samplerate={model.samplerate}, channels={model.audio_channels}, segment={getattr(model, 'segment', None)}")

    audio, sr = sf.read(str(mix_path), dtype="float32", always_2d=True)
    assert sr == model.samplerate, sr
    wav = torch.from_numpy(audio.T.copy())
    ref = wav.mean(0)
    wav = (wav - ref.mean()) / ref.std()
    events: list[dict] = []

    def callback(d: dict) -> None:
        events.append(dict(d))

    t0 = time.perf_counter()
    with torch.no_grad():
        sources = apply_model(model, wav[None], device=device, split=True, overlap=0.25,
                              shifts=0, progress=False, callback=callback)[0]
    elapsed = time.perf_counter() - t0
    sources = sources * ref.std() + ref.mean()
    dur = audio.shape[0] / sr
    print(f"Separation: {elapsed:.1f}s für {dur:.1f}s Audio (RTF {elapsed / dur:.2f}) auf {device}")
    print(f"Callback-Events: {len(events)}; Beispiel: {events[:2]}")
    if device == "cuda":
        print(f"VRAM peak: {torch.cuda.max_memory_allocated() / 2**20:.0f} MiB")
    print(f"RAM peak (ru_maxrss): {resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024:.0f} MiB")

    out_dir.mkdir(parents=True, exist_ok=True)
    for name, src in zip(model.sources, sources, strict=True):
        sf.write(str(out_dir / f"{name}.wav"), src.numpy().T, sr, subtype="PCM_16")
    if ref_path:
        ref_audio, _ = sf.read(str(ref_path), dtype="float32", always_2d=True)
        piano = sources[model.sources.index("piano")].numpy().T
        print(f"SDR piano-Stem vs. Klavier-Referenz: {sdr(ref_audio, piano):.2f} dB")
        print(f"SDR Mix vs. Klavier-Referenz (Baseline): {sdr(ref_audio, audio):.2f} dB")


if __name__ == "__main__":
    main()
