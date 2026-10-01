// Run-Zufallsgenerator mulberry32 (2.3). Einzige Zufallsquelle der Simulation.

const MULBERRY_INC = 0x6d2b79f5;
const SHIFT_A = 15;
const SHIFT_B = 7;
const SHIFT_C = 14;
const OR_B = 61;
const UINT32_RANGE = 4294967296;

export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** Innerer Zustand (für Wiederholung und Fehlersuche). */
  get state(): number {
    return this.s;
  }

  /** Gleichverteilt in [0, 1). */
  next(): number {
    this.s = (this.s + MULBERRY_INC) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> SHIFT_A), t | 1);
    t ^= t + Math.imul(t ^ (t >>> SHIFT_B), t | OR_B);
    return ((t ^ (t >>> SHIFT_C)) >>> 0) / UINT32_RANGE;
  }

  /** true mit Wahrscheinlichkeit p (0 bis 1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Gleichverteilt in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Ganze Zahl in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick: leere Liste');
    return items[this.int(items.length)] as T;
  }

  /**
   * Gewichtete Auswahl. Die Reihenfolge der Schlüssel kommt aus `order`, nie aus dem Objekt selbst
   * (CLAUDE.md, Regel 3).
   */
  weighted<K extends string>(weights: Partial<Record<K, number>>, order: readonly K[]): K {
    let total = 0;
    for (const k of order) total += Math.max(0, weights[k] ?? 0);
    if (total <= 0) throw new Error('weighted: Summe der Gewichte ist 0');
    let r = this.next() * total;
    let last: K | undefined;
    for (const k of order) {
      const w = Math.max(0, weights[k] ?? 0);
      if (w <= 0) continue;
      last = k;
      if (r < w) return k;
      r -= w;
    }
    return last as K;
  }

  /** Auswahl nach einer Liste von Wahrscheinlichkeiten (Index). */
  weightedIndex(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += Math.max(0, w);
    if (total <= 0) throw new Error('weightedIndex: Summe der Gewichte ist 0');
    let r = this.next() * total;
    let last = 0;
    for (let i = 0; i < weights.length; i++) {
      const w = Math.max(0, weights[i] ?? 0);
      if (w <= 0) continue;
      last = i;
      if (r < w) return i;
      r -= w;
    }
    return last;
  }
}

/** Abgeleiteter Seed aus einem Grund-Seed und einer Zahl (zum Beispiel je Spieler bei der Beute). */
export function deriveSeed(seed: number, salt: number): number {
  const r = new Rng((seed ^ Math.imul(salt + 1, MULBERRY_INC)) >>> 0);
  return Math.floor(r.next() * UINT32_RANGE) >>> 0;
}
