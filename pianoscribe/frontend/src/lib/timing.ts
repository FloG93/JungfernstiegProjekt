// Abbildung zwischen Audiozeit (s im Ausschnitt) und Partiturposition (Viertel, wie qstamp).
// Grundlage ist die Beat-Liste aus score.json; dazwischen linear, außerhalb extrapoliert.

export interface BeatPoint {
  q: number;
  t: number;
}

export class TimeMap {
  private readonly points: BeatPoint[];

  constructor(points: BeatPoint[]) {
    this.points = [...points].sort((a, b) => a.t - b.t);
  }

  get empty(): boolean {
    return this.points.length < 2;
  }

  private static interpolate(x: number, xs: number[], ys: number[]): number {
    const n = xs.length;
    if (n === 0) return x;
    if (n === 1) return ys[0]! + (x - xs[0]!);
    let i = 0;
    if (x >= xs[n - 1]!) i = n - 2;
    else if (x > xs[0]!) {
      let lo = 0;
      let hi = n - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (xs[mid]! <= x) lo = mid;
        else hi = mid;
      }
      i = lo;
    }
    const x0 = xs[i]!;
    const x1 = xs[i + 1]!;
    const y0 = ys[i]!;
    const y1 = ys[i + 1]!;
    return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
  }

  timeToQ(t: number): number {
    return TimeMap.interpolate(t, this.points.map((p) => p.t), this.points.map((p) => p.q));
  }

  qToTime(q: number): number {
    return TimeMap.interpolate(q, this.points.map((p) => p.q), this.points.map((p) => p.t));
  }
}

/** Dezimalzahl im deutschen Format, z. B. 20,4 */
export function formatDecimal(value: number, digits = 1): string {
  return value.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Formatiert Sekunden als m:ss,z */
export function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe - minutes * 60;
  const whole = Math.floor(rest);
  const tenth = Math.floor((rest - whole) * 10);
  return `${minutes}:${whole.toString().padStart(2, "0")},${tenth}`;
}
