import { describe, expect, it } from 'vitest';
import { trainingWorld } from '../../testing';
import { applyStatus, cleanse } from '../status';

describe('Handler cleanse', () => {
  it('entfernt Debuffs in der Reihenfolge aus 6.4', () => {
    const { w, heroes } = trainingWorld({ heroes: ['krieger'] });
    const h = heroes[0]!;
    for (const id of ['verbrennung', 'gift', 'schock', 'frost', 'blendung', 'ruestungsbruch', 'verderbnis', 'wurzel'] as const) {
      applyStatus(w, null, h, id);
    }
    const order: string[] = [];
    for (;;) {
      const before = h.statuses.map((s) => s.id);
      if (cleanse(w, h, 1) === 0) break;
      const after = new Set(h.statuses.map((s) => s.id));
      order.push(before.find((id) => !after.has(id))!);
    }
    expect(order).toEqual(['wurzel', 'verderbnis', 'ruestungsbruch', 'blendung', 'frost', 'schock', 'gift', 'verbrennung']);
  });
});
