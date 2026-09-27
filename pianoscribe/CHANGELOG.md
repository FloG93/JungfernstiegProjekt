# Changelog

## Phase 0 – Setup & Spikes

- Projektstruktur `pianoscribe/` (Backend, Frontend, Packaging, Skripte, Spikes), `CLAUDE.md`,
  `.gitignore`.
- uv-Projekt mit Python 3.11; torch/torchaudio 2.11.0 mit CUDA 13.0 unter Windows und CPU-Wheels
  unter Linux, universelles `uv.lock`.
- Spikes für Demucs, ByteDance-Transkription, beat_this und music21 → MusicXML (mit Verovio-Prüfung).
  Ergebnisse, Versionen, Laufzeiten und Prüfsummen stehen in `spikes/RESULTS.md`.
- Abweichungen vom Plan: demucs 4.1.0 statt 4.0.x; beat_this von PyPI;
  piano_transcription_inference gevendort (Originalpaket mit aktuellem librosa defekt), bitgenau
  gegen das Original verifiziert; torch bleibt auf 2.11, weil torchaudio nicht mehr erscheint.
- `scripts/fetch_assets.py` lädt Salamander-Samples und unter Windows ffmpeg.
- `backend/evaluation/`: synthetisches Test-Audio mit Ground Truth (Salamander-Sampler, Drums,
  Bass, Pad) und Metriken (mir_eval).
