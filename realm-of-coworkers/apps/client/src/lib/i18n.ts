// Texte aus content/i18n/de.json (14.10), deutsches Zahlenformat.
import type { Content } from '@aethra/shared';

let dict: Record<string, Record<string, string>> = {};
const nf = new Intl.NumberFormat('de-DE');
const nf1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

export function setTexts(c: Content): void {
  dict = c.i18n;
}

export function fmt(v: number, digits = 0): string {
  return digits > 0 ? nf1.format(v) : nf.format(Math.round(v));
}

/** Text zu „gruppe.schluessel“ mit Platzhaltern {name}. Fehlt er, erscheint der Schlüssel. */
export function t(key: string, p?: Record<string, string | number>): string {
  const dot = key.indexOf('.');
  const s = dot > 0 ? dict[key.slice(0, dot)]?.[key.slice(dot + 1)] : undefined;
  const text = s ?? key;
  if (!p) return text;
  return text.replace(/\{(\w+)\}/g, (m, n: string) => {
    const v = p[n];
    if (v === undefined) return m;
    return typeof v === 'number' ? fmt(v) : v;
  });
}

/** Dauer als m:ss bzw. h:mm:ss. */
export function fmtTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
