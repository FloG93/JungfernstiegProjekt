// Zeitgeber für Lobby und Runs (2.3): Systemuhr im Betrieb, manuelle Uhr in Tests.
export interface Clock {
  now(): number;
  /** Ruft fn alle ms Millisekunden auf und gibt eine Abbruchfunktion zurück. */
  every(ms: number, fn: () => void): () => void;
}

export function systemClock(now: () => number): Clock {
  return {
    now,
    every(ms, fn) {
      const h = setInterval(fn, ms);
      return () => clearInterval(h);
    },
  };
}
