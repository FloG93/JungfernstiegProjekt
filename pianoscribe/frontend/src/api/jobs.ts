// Job-Fortschritt: WebSocket-Push mit automatischem Wiederverbinden, Polling als Fallback.

import { api, websocketUrl } from "./client";
import type { Job } from "./types";

type Listener = (job: Job) => void;

const listeners = new Set<Listener>();
let socket: WebSocket | null = null;
let retry = 0;
let lastMessage = 0;

function connect(): void {
  if (socket || listeners.size === 0) return;
  try {
    socket = new WebSocket(websocketUrl());
  } catch {
    scheduleReconnect();
    return;
  }
  socket.onopen = () => {
    retry = 0;
  };
  socket.onmessage = (event: MessageEvent<string>) => {
    lastMessage = Date.now();
    try {
      const data = JSON.parse(event.data) as { type: string; job?: Job };
      if (data.type === "job" && data.job) listeners.forEach((l) => l(data.job!));
    } catch {
      // ungültige Nachricht ignorieren
    }
  };
  socket.onclose = () => {
    socket = null;
    scheduleReconnect();
  };
  socket.onerror = () => socket?.close();
}

function scheduleReconnect(): void {
  if (listeners.size === 0) return;
  retry = Math.min(retry + 1, 6);
  window.setTimeout(connect, 250 * 2 ** retry);
}

export function subscribeJobs(listener: Listener): () => void {
  listeners.add(listener);
  connect();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && socket) {
      socket.onclose = null;
      socket.close();
      socket = null;
    }
  };
}

const FINAL = new Set(["done", "error", "cancelled"]);

/** Beobachtet einen Job bis zum Ende; fragt per Polling nach, wenn der Push ausbleibt. */
export function watchJob(initial: Job, onUpdate: Listener): () => void {
  let stopped = false;
  let current = initial;
  onUpdate(initial);
  if (FINAL.has(initial.status)) return () => undefined;
  const unsubscribe = subscribeJobs((job) => {
    if (job.id !== current.id || stopped) return;
    current = job;
    onUpdate(job);
  });
  const poll = window.setInterval(async () => {
    if (stopped || FINAL.has(current.status)) return;
    if (Date.now() - lastMessage < 1500) return; // Push kommt an
    try {
      const job = await api.job(current.id);
      if (!stopped) {
        current = job;
        onUpdate(job);
      }
    } catch {
      // nächster Versuch
    }
  }, 1000);
  return () => {
    stopped = true;
    unsubscribe();
    window.clearInterval(poll);
  };
}

export function isFinal(job: Job): boolean {
  return FINAL.has(job.status);
}
