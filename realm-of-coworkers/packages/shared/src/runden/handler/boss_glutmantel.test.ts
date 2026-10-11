import { describe, expect, it } from 'vitest';
import { boss_glutmantel } from './boss_glutmantel';
import { bossVon, inhalt as c, testBossKampf } from '../testhilfe';
import { reihe } from '../ziele';

describe('boss_glutmantel', () => {
  it('setzt Verbrennung bei allen Helden der vorderen Reihe', () => {
    const k = testBossKampf('ignarch');
    const boss = bossVon(k);
    const vorn = reihe(k, 'held', 'vorn');
    const hinten = reihe(k, 'held', 'hinten');
    expect(vorn.length).toBeGreaterThan(0);
    boss_glutmantel.runde!({ k, boss, params: { radiusPx: 120, everyS: 3, stacks: 1 } });
    for (const h of vorn) expect(h.status.some((s) => s.id === 'verbrennung')).toBe(true);
    for (const h of hinten) expect(h.status.some((s) => s.id === 'verbrennung')).toBe(false);
    expect(c.statusById['verbrennung']!.defaultMs).toBeGreaterThan(0);
  });
});
