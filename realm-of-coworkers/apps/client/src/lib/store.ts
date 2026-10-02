// Kleiner Zustandsspeicher mit Abonnement für Preact (ohne zusätzliche Abhängigkeit).
import { useEffect, useState } from 'preact/hooks';

export class Store<T> {
  private readonly subs = new Set<() => void>();

  constructor(private value: T) {}

  get(): T {
    return this.value;
  }

  set(v: T | ((old: T) => T)): void {
    const next = typeof v === 'function' ? (v as (old: T) => T)(this.value) : v;
    if (Object.is(next, this.value)) return;
    this.value = next;
    for (const f of [...this.subs]) f();
  }

  /** Teil-Aktualisierung eines Objekts. */
  patch(p: Partial<T>): void {
    this.set((old) => ({ ...old, ...p }));
  }

  subscribe(f: () => void): () => void {
    this.subs.add(f);
    return () => this.subs.delete(f);
  }
}

export function useStore<T>(s: Store<T>): T {
  const [, setN] = useState(0);
  useEffect(() => s.subscribe(() => setN((n) => n + 1)), [s]);
  return s.get();
}
