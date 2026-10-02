// Notenanzeige mit Verovio: seitenweise oder als Endlos-Ansicht, Zoom, mitlaufende
// Hervorhebung der klingenden Noten (über die Timemap) und Klick auf eine Note zum Springen.

import { useEffect, useMemo, useRef, useState } from "react";

import { createToolkit, type TimemapEntry, type Toolkit } from "../lib/verovio";

interface Props {
  musicxml: string | null;
  currentQ: number | null; // Viertelposition der Wiedergabe (null = keine Hervorhebung)
  onSeekQ(q: number): void;
}

type Mode = "scroll" | "pages";

interface NoteSpan {
  id: string;
  on: number;
  off: number;
}

function buildSpans(timemap: TimemapEntry[]): NoteSpan[] {
  const open = new Map<string, number>();
  const spans: NoteSpan[] = [];
  for (const entry of timemap) {
    for (const id of entry.off ?? []) {
      const start = open.get(id);
      if (start !== undefined) {
        spans.push({ id, on: start, off: entry.qstamp });
        open.delete(id);
      }
    }
    for (const id of entry.on ?? []) open.set(id, entry.qstamp);
  }
  for (const [id, on] of open) spans.push({ id, on, off: on + 4 });
  return spans.sort((a, b) => a.on - b.on);
}

export function ScoreView({ musicxml, currentQ, onSeekQ }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const toolkit = useRef<Toolkit | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("scroll");
  const [zoom, setZoom] = useState(40);
  const [width, setWidth] = useState(800);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [spans, setSpans] = useState<NoteSpan[]>([]);
  const [svg, setSvg] = useState("");
  const [layoutVersion, setLayoutVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    createToolkit()
      .then((tk) => {
        if (cancelled) return;
        toolkit.current = tk;
        setReady(true);
      })
      .catch(() => setError("Die Notenanzeige (Verovio) konnte nicht geladen werden."));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0]?.contentRect.width ?? 800);
      setWidth((old) => (Math.abs(old - w) > 8 ? w : old));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Laden und Layout: bei neuen Noten, Größe, Zoom oder Modus.
  useEffect(() => {
    const tk = toolkit.current;
    if (!ready || !tk || !musicxml) return;
    const pageWidth = Math.max(600, Math.round(((width - 24) * 100) / zoom));
    tk.setOptions({
      pageWidth,
      pageHeight: mode === "scroll" ? 60000 : Math.round(pageWidth * 1.414),
      scale: zoom,
      adjustPageHeight: true,
      breaks: "auto",
      header: "auto",
      footer: "none",
      pageMarginTop: 40,
      pageMarginBottom: 40,
      pageMarginLeft: 40,
      pageMarginRight: 40,
      svgHtml5: false,
    });
    if (!tk.loadData(musicxml)) {
      setError("Die Noten konnten nicht gesetzt werden.");
      return;
    }
    setError(null);
    setPageCount(tk.getPageCount());
    setPage((p) => Math.min(p, tk.getPageCount()));
    setSpans(buildSpans(tk.renderToTimemap({ includeMeasures: false })));
    setLayoutVersion((v) => v + 1);
  }, [ready, musicxml, width, zoom, mode]);

  useEffect(() => {
    const tk = toolkit.current;
    if (!ready || !tk || !musicxml || layoutVersion === 0) return;
    setSvg(tk.renderToSVG(Math.min(page, tk.getPageCount())));
  }, [ready, musicxml, page, layoutVersion]);

  const active = useMemo(() => {
    if (currentQ === null) return [];
    return spans.filter((s) => s.on <= currentQ + 1e-6 && currentQ < s.off - 1e-6).map((s) => s.id);
  }, [spans, currentQ]);

  // Hervorhebung und Mitlaufen.
  useEffect(() => {
    const root = host.current;
    if (!root) return;
    root.querySelectorAll(".ps-playing").forEach((el) => el.classList.remove("ps-playing"));
    if (active.length === 0) return;
    let first: Element | null = null;
    for (const id of active) {
      const el = root.querySelector(`#${CSS.escape(id)}`);
      if (el) {
        el.classList.add("ps-playing");
        first ??= el;
      }
    }
    if (!first && mode === "pages" && toolkit.current) {
      const target = toolkit.current.getPageWithElement(active[0]!);
      if (target > 0 && target !== page) setPage(target);
      return;
    }
    const box = scroller.current;
    if (first && box) {
      const rect = first.getBoundingClientRect();
      const view = box.getBoundingClientRect();
      if (rect.top < view.top + 40 || rect.bottom > view.bottom - 40) {
        box.scrollBy({ top: rect.top - view.top - view.height / 3, behavior: "smooth" });
      }
    }
  }, [active, svg, mode, page]);

  const onClick = (event: React.MouseEvent) => {
    let el = event.target as Element | null;
    while (el && el !== host.current) {
      if (el.classList.contains("note") || el.classList.contains("chord")) {
        const id = el.id;
        const span = spans.find((s) => s.id === id)
          ?? spans.find((s) => el!.querySelector(`#${CSS.escape(s.id)}`));
        if (span) onSeekQ(span.on);
        return;
      }
      el = el.parentElement;
    }
  };

  return (
    <section className="panel score-panel" aria-label="Noten">
      <div className="score-toolbar">
        <div className="segmented" role="group" aria-label="Ansicht">
          <button type="button" className={mode === "scroll" ? "active" : ""} onClick={() => setMode("scroll")}>
            Endlos
          </button>
          <button type="button" className={mode === "pages" ? "active" : ""} onClick={() => setMode("pages")}>
            Seiten
          </button>
        </div>
        {mode === "pages" && (
          <div className="pager">
            <button type="button" className="btn subtle" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
            <span>Seite {page} / {pageCount}</span>
            <button type="button" className="btn subtle" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>›</button>
          </div>
        )}
        <span className="spacer" />
        <label className="zoom">
          Größe
          <input type="range" min={25} max={80} step={5} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))} />
        </label>
      </div>
      <div ref={scroller} className="score-scroller">
        {!musicxml && !error && (
          <div className="empty">Noch keine Noten. Ausschnitt wählen und „Transkribieren“ starten.</div>
        )}
        {error && <div className="error-box">{error}</div>}
        {musicxml && !ready && !error && <div className="empty">Notensatz wird geladen …</div>}
        <div ref={host} className="score-svg" onClick={onClick} dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
    </section>
  );
}
