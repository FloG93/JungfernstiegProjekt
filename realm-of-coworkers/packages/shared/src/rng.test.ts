import { describe, expect, it } from 'vitest';
import { RARITY_IDS } from './content/ids';
import { Rng, deriveSeed } from './rng';

describe('mulberry32 (2.3)', () => {
  it('ist deterministisch', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('liefert die Referenzfolge von mulberry32', () => {
    const r = new Rng(1);
    expect(r.next()).toBeCloseTo(0.6270739405881613, 15);
    expect(r.next()).toBeCloseTo(0.002735721180215478, 15);
  });

  it('verteilt gleichmäßig und gewichtet korrekt', () => {
    const r = new Rng(7);
    let sum = 0;
    for (let i = 0; i < 10_000; i++) sum += r.next();
    expect(sum / 10_000).toBeGreaterThan(0.49);
    expect(sum / 10_000).toBeLessThan(0.51);

    const counts: Record<string, number> = {};
    const w = { gewoehnlich: 60, ungewoehnlich: 30, selten: 10 };
    for (let i = 0; i < 10_000; i++) {
      const k = r.weighted(w, RARITY_IDS);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    expect(Math.abs((counts['gewoehnlich'] ?? 0) / 100 - 60)).toBeLessThan(2);
    expect(Math.abs((counts['selten'] ?? 0) / 100 - 10)).toBeLessThan(2);
    expect(counts['episch']).toBeUndefined();
  });

  it('leitet unterschiedliche Seeds ab', () => {
    expect(deriveSeed(5, 1)).not.toBe(deriveSeed(5, 2));
    expect(deriveSeed(5, 1)).toBe(deriveSeed(5, 1));
  });
});
