// Fängt Fehler in Komponenten ab, damit nie die ganze Oberfläche verschwindet.

import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Oberflächenfehler", error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <main className="start-page">
        <div className="error-box" role="alert">
          <strong>Hier ist etwas schiefgelaufen.</strong>
          <p>{this.state.error.message}</p>
        </div>
        <button type="button" className="btn primary" onClick={() => window.location.reload()}>
          Neu laden
        </button>
      </main>
    );
  }
}
