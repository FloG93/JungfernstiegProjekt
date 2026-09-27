import { useCallback, useEffect, useRef } from "react";

/** Ruft ``fn`` erst auf, wenn ``delay`` ms lang kein neuer Aufruf kam. */
export function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  delay: number,
): (...args: A) => void {
  const timer = useRef<number | null>(null);
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  }, [fn]);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  return useCallback(
    (...args: A) => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => latest.current(...args), delay);
    },
    [delay],
  );
}

/** Tastenkürzel, außer während der Eingabe in Formularfeldern. */
export function useHotkeys(handlers: Record<string, (event: KeyboardEvent) => void>): void {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  }, [handlers]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const handler = latest.current[event.key === " " ? "Space" : event.key];
      if (handler) {
        event.preventDefault();
        handler(event);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
