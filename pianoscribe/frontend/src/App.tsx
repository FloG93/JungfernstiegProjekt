import { useEffect, useState } from "react";

import { api } from "./api/client";
import type { Health } from "./api/types";
import { AboutDialog, SetupDialog } from "./components/Dialogs";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { EditorPage } from "./pages/EditorPage";
import { StartPage } from "./pages/StartPage";

type Route = { page: "start" } | { page: "editor"; id: string };

function parseHash(): Route {
  const match = /^#\/projekt\/([0-9a-f]+)/.exec(window.location.hash);
  return match ? { page: "editor", id: match[1]! } : { page: "start" };
}

export function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    api.health()
      .then((h) => {
        setHealth(h);
        setShowSetup(!h.models.installed || !h.settings.setup_done);
      })
      .catch((e: Error) => setHealthError(e.message));
  }, []);

  const go = (target: Route) => {
    window.location.hash = target.page === "editor" ? `#/projekt/${target.id}` : "#/";
  };

  return (
    <div className="app">
      <header className="app-header">
        <button type="button" className="brand" onClick={() => go({ page: "start" })}>
          <span className="logo" aria-hidden>𝄞</span> PianoScribe
        </button>
        <span className="spacer" />
        {health && (
          <span className={`device ${health.gpu.cuda_available && health.settings.device !== "cpu" ? "gpu" : "cpu"}`}
            title={health.gpu.name ?? "keine NVIDIA-GPU"}>
            {health.gpu.cuda_available && health.settings.device !== "cpu" ? `GPU: ${health.gpu.name}` : "CPU-Modus"}
          </span>
        )}
        <button type="button" className="btn subtle" onClick={() => setShowSetup(true)} disabled={!health}>
          Einrichtung
        </button>
        <button type="button" className="btn subtle" onClick={() => setShowAbout(true)}>Über</button>
      </header>
      {healthError && <div className="error-box">{healthError}</div>}
      <ErrorBoundary key={route.page === "editor" ? route.id : "start"}>
        {route.page === "start" ? (
          <StartPage onOpen={(id) => go({ page: "editor", id })} />
        ) : (
          <EditorPage projectId={route.id} onBack={() => go({ page: "start" })} />
        )}
      </ErrorBoundary>
      {showSetup && health && (
        <SetupDialog health={health} onDone={() => {
          setShowSetup(false);
          void api.health().then(setHealth);
        }} />
      )}
      {showAbout && <AboutDialog version={health?.version ?? "?"} onClose={() => setShowAbout(false)} />}
    </div>
  );
}
