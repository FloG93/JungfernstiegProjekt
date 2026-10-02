// Typen der Backend-API (spiegeln pianoscribe/project.py und api/routes.py).

export type StageName = "trim" | "separate" | "transcribe" | "rhythm" | "notate";
export const STAGES: StageName[] = ["trim", "separate", "transcribe", "rhythm", "notate"];

export type GridMode = "auto" | "1/8" | "1/16" | "1/16+triplets";

export interface HandSplit {
  mode: "auto" | "fixed";
  pitch: number;
}

export interface NotationParams {
  tempo_bpm: number | null;
  time_signature: string;
  first_downbeat_s: number | null;
  key: string | null;
  grid: GridMode;
  hand_split: HandSplit;
  min_note_ms: number;
  min_velocity: number;
  transpose: number;
  pedal: boolean;
  title: string;
  composer: string;
}

export interface StageState {
  hash: string | null;
  done: boolean;
  skipped: boolean;
  finished: string | null;
  duration_s: number | null;
}

export interface Trim {
  start_s: number;
  end_s: number;
}

export interface Manifest {
  id: string;
  name: string;
  created: string;
  source: { file: string; original_name: string; duration_s: number; sha256: string };
  trim: Trim | null;
  options: { separate: boolean; separator: string; transcriber: string };
  notation: NotationParams;
  stages: Record<StageName, StageState>;
}

export interface ScoreInfo {
  tempo_bpm: number;
  tempo_source: "auto" | "manual" | "fallback";
  time_signature: string;
  key: string;
  key_source: "auto" | "manual";
  key_name: string;
  pickup_quarters: number;
  measures: number;
  grid: GridMode;
  first_downbeat_s: number;
  notes: number;
  warnings: string[];
  trim_start_s: number;
}

export interface ProjectPayload {
  manifest: Manifest;
  pending: StageName[];
  has_score: boolean;
  has_piano: boolean;
  score_info: ScoreInfo | null;
}

export interface ProjectSummary {
  id: string;
  name: string;
  created: string;
  source: string;
  duration_s: number;
  trim: Trim;
  has_score: boolean;
}

export interface JobError {
  code: string;
  message: string;
  hint: string;
}

export type JobStatus = "queued" | "running" | "done" | "error" | "cancelled";

export interface Job {
  id: string;
  kind: "pipeline" | "models";
  project_id: string | null;
  status: JobStatus;
  stage: string | null;
  stage_progress: number;
  progress: number;
  stages: Record<string, string>;
  message: string | null;
  log: string[];
  error: JobError | null;
  created: number;
  started: number | null;
  finished: number | null;
}

export interface GpuInfo {
  torch: string;
  cuda_build: string | null;
  cuda_available: boolean;
  name: string | null;
  vram_total_mb: number | null;
  vram_free_mb: number | null;
}

export interface Settings {
  device: "auto" | "cuda" | "cpu";
  setup_done: boolean;
}

export interface Health {
  status: string;
  version: string;
  gpu: GpuInfo;
  ffmpeg: boolean;
  models: { installed: boolean; missing: string[] };
  settings: Settings;
}

export interface ModelStatus {
  key: string;
  title: string;
  installed: boolean;
  size: number;
  path: string;
  license: string;
}

export interface ScoreNote {
  p: number; // MIDI-Tonhöhe
  v: number; // Velocity
  h: 0 | 1; // 0 = rechte, 1 = linke Hand
  q0: number; // Viertelposition (wie Verovios qstamp)
  q1: number;
  t0: number; // Sekunden im getrimmten Ausschnitt
  t1: number;
}

export interface ScoreData {
  format: 1;
  info: ScoreInfo;
  notes: ScoreNote[];
  pedals: { q0: number; q1: number; t0: number; t1: number }[];
  beats: { q: number; t: number }[];
  measures: { n: number; q: number; t: number }[];
}

export interface Waveform {
  duration_s: number;
  per_second: number;
  peaks: number[];
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export interface ProjectChanges {
  name?: string;
  trim?: Trim;
  options?: Partial<Manifest["options"]>;
  notation?: DeepPartial<NotationParams>;
}
