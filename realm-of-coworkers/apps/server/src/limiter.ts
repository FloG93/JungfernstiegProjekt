// Rate-Limits (2.3, 11.9): gleitendes Fenster je Schlüssel. Überschreitung → RATE_LIMITED.
import { fail } from './http/errors';

export interface LimitRule {
  max: number;
  windowMs: number;
}

export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private readonly rules: Record<string, LimitRule>, private readonly now: () => number) {}

  /** true, wenn erlaubt; zählt den Treffer. */
  allow(key: string, rule: string): boolean {
    const r = this.rules[rule];
    if (!r) return true;
    const t = this.now();
    const list = (this.hits.get(key) ?? []).filter((x) => t - x < r.windowMs);
    if (list.length >= r.max) {
      this.hits.set(key, list);
      return false;
    }
    list.push(t);
    this.hits.set(key, list);
    return true;
  }

  check(key: string, rule: string): void {
    if (!this.allow(key, rule)) fail('RATE_LIMITED', 'Zu viele Anfragen, bitte kurz warten.');
  }

  /** Alte Einträge entfernen (regelmäßig aufrufen). */
  sweep(): void {
    const t = this.now();
    let maxWindow = 0;
    for (const r of Object.values(this.rules)) maxWindow = Math.max(maxWindow, r.windowMs);
    for (const [k, v] of this.hits) if (v.every((x) => t - x >= maxWindow)) this.hits.delete(k);
  }
}
