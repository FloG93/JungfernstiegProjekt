// Statusregeln (6.3, 6.4).
import { describe, expect, it } from 'vitest';
import { collect, trainingWorld } from '../testing';
import { applyStatus } from './status';

describe('Stapel, Dauer, Höchstzahl und Immunitäten (6.4)', () => {
  it('Stapel steigen bis zum Maximum, die Dauer wird auf den längeren Wert erneuert', () => {
    const { w, dummies } = trainingWorld({ heroes: [], dummies: [{ x: 0 }] });
    const d = dummies[0]!;
    applyStatus(w, null, d, 'verderbnis', { ms: 6000 });
    collect(w, 1000);
    applyStatus(w, null, d, 'verderbnis', { ms: 2000 });
    applyStatus(w, null, d, 'verderbnis', { ms: 6000 });
    applyStatus(w, null, d, 'verderbnis', { ms: 6000 });
    const s = d.statuses.find((x) => x.id === 'verderbnis')!;
    expect(s.stacks).toBe(3);
    expect(s.endsAt).toBe(w.t + 6000);
  });

  it('höchstens 8 verschiedene Effekte, bei Überlauf wird der älteste Debuff ersetzt', () => {
    const { w, dummies } = trainingWorld({ heroes: [], dummies: [{ x: 0 }] });
    const d = dummies[0]!;
    const ids = ['verbrennung', 'frost', 'schock', 'ruestungsbruch', 'blendung', 'verderbnis', 'gift', 'blutung'] as const;
    ids.forEach((id, i) => {
      w.t = i;
      applyStatus(w, null, d, id, { ms: 60000 });
    });
    expect(d.statuses).toHaveLength(8);
    applyStatus(w, null, d, 'wurzel', { ms: 1000 });
    expect(d.statuses).toHaveLength(8);
    expect(d.statuses.some((s) => s.id === 'verbrennung')).toBe(false);
    expect(d.statuses.some((s) => s.id === 'wurzel')).toBe(true);
  });

  it('Bosse sind immun gegen Betäubung, Wurzel, Furcht und Einfrieren; Elite halbiert die Dauer', () => {
    const { w, dummies } = trainingWorld({ heroes: [], dummies: [{ x: 0, kind: 'boss' }, { x: 0, elite: true }] });
    for (const id of ['betaeubung', 'wurzel', 'furcht', 'eingefroren'] as const) {
      expect(applyStatus(w, null, dummies[0]!, id)).toBe(false);
    }
    applyStatus(w, null, dummies[1]!, 'wurzel', { ms: 2000 });
    expect(dummies[1]!.statuses[0]!.endsAt - w.t).toBe(1000);
  });

  it('Frost bei 3 Stapeln friert ein, Bosse werden stattdessen um 40 % verlangsamt', () => {
    const { w, dummies } = trainingWorld({ heroes: [], dummies: [{ x: 0 }, { x: 0, kind: 'boss' }] });
    for (let i = 0; i < 3; i++) {
      applyStatus(w, null, dummies[0]!, 'frost');
      applyStatus(w, null, dummies[1]!, 'frost');
    }
    expect(dummies[0]!.statuses.map((s) => s.id)).toEqual(['eingefroren']);
    expect(dummies[0]!.statuses[0]!.endsAt - w.t).toBe(1500);
    expect(dummies[1]!.statuses.find((s) => s.id === 'angriffstempo_malus')?.value).toBe(40);
  });

  it('Schaden über Zeit aus Gegnerquellen: Prozent von RefLeben je Sekunde und Stapel', () => {
    const { w, heroes } = trainingWorld({ heroes: ['krieger'], training: { chapter: 3, attackerLevel: 15 } });
    const h = heroes[0]!;
    const before = h.hp;
    applyStatus(w, null, h, 'verbrennung', { ms: 5000, stacks: 2 });
    collect(w, 5000);
    // 5 Ticks × 2 Stapel × 1 % × 815, gemindert durch Resistenz
    expect(before - h.hp).toBeGreaterThan(40);
    expect(before - h.hp).toBeLessThan(5 * 2 * 8.15);
  });
});
