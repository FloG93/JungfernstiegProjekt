// Typisierter API-Client. Im Desktop-Betrieb kommt ein Sitzungs-Token per URL (?token=…),
// das jede Anfrage mitschickt; in der Entwicklung (Vite-Proxy) gibt es keines.

import type {
  Health,
  Job,
  ModelStatus,
  ProjectChanges,
  ProjectPayload,
  ProjectSummary,
  ScoreData,
  Settings,
  StageName,
  Waveform,
} from "./types";

const TOKEN_KEY = "pianoscribe-token";
let token: string | null = null;

export function initToken(): void {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("token");
  if (fromUrl) {
    token = fromUrl;
    try {
      sessionStorage.setItem(TOKEN_KEY, fromUrl);
    } catch {
      // Speicher gesperrt – Token bleibt im Speicher
    }
    params.delete("token");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (query ? `?${query}` : "") + window.location.hash,
    );
    return;
  }
  try {
    token = sessionStorage.getItem(TOKEN_KEY);
  } catch {
    token = null;
  }
}

export function setTokenForTests(value: string | null): void {
  token = value;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function withToken(url: string): string {
  if (!token) return url;
  return `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers["X-PianoScribe-Token"] = token;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, "Keine Verbindung zum PianoScribe-Dienst.");
  }
  if (!response.ok) {
    let message = `Fehler ${response.status}`;
    try {
      const data = (await response.json()) as { detail?: unknown };
      if (typeof data.detail === "string") message = data.detail;
      else if (Array.isArray(data.detail)) message = "Ungültige Eingabe.";
    } catch {
      // kein JSON
    }
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("json")) return (await response.json()) as T;
  return (await response.text()) as T;
}

async function blob(path: string): Promise<Blob> {
  const response = await fetch(withToken(`/api${path}`));
  if (!response.ok) throw new ApiError(response.status, "Datei nicht verfügbar.");
  return response.blob();
}

export const api = {
  health: () => request<Health>("GET", "/health"),
  models: () => request<ModelStatus[]>("GET", "/models"),
  downloadModels: () => request<Job>("POST", "/models/download"),
  settings: () => request<Settings>("GET", "/settings"),
  patchSettings: (changes: Partial<Settings>) => request<Settings>("PATCH", "/settings", changes),

  projects: () => request<ProjectSummary[]>("GET", "/projects"),
  createProject: (path: string, name?: string) =>
    request<ProjectPayload>("POST", "/projects", { path, name }),
  uploadProject: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<ProjectPayload>("POST", "/projects/upload", form);
  },
  project: (id: string) => request<ProjectPayload>("GET", `/projects/${id}`),
  patchProject: (id: string, changes: ProjectChanges) =>
    request<ProjectPayload>("PATCH", `/projects/${id}`, changes),
  deleteProject: (id: string) => request<undefined>("DELETE", `/projects/${id}`),
  run: (id: string, fromStage?: StageName) =>
    request<Job>("POST", `/projects/${id}/run`, fromStage ? { from_stage: fromStage } : {}),
  waveform: (id: string) => request<Waveform>("GET", `/projects/${id}/waveform`),
  scoreData: (id: string) => request<ScoreData>("GET", `/projects/${id}/score.json`),
  musicxml: (id: string) => request<string>("GET", `/projects/${id}/score.musicxml`),
  file: (id: string, name: "score.musicxml" | "score.mid" | "raw.mid") =>
    blob(`/projects/${id}/${name}`),

  jobs: () => request<Job[]>("GET", "/jobs"),
  job: (id: string) => request<Job>("GET", `/jobs/${id}`),
  cancelJob: (id: string) => request<Job>("POST", `/jobs/${id}/cancel`),
};

/** URL einer Audiospur; ``version`` erzwingt nach Neuberechnung frische Daten. */
export function audioUrl(id: string, kind: "source" | "trimmed" | "piano", version = ""): string {
  const base = `/api/projects/${id}/audio/${kind}${version ? `?v=${version}` : ""}`;
  return withToken(base);
}

export function websocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return withToken(`${protocol}//${window.location.host}/api/ws`);
}

export const SAMPLES_BASE_URL = "/samples/";
