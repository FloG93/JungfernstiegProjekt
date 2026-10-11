import { describe, expect, it } from 'vitest';
import { sig_frostnova } from './sig_frostnova';
import { bossVon, inhalt as c, testBossKampf } from '../testhilfe';
import { reihe } from '../ziele';

describe('sig_frostnova', () => {
  it('trifft die vordere Reihe und setzt Frost, die hintere bleibt verschont', () => {
    const k = testBossKampf('glaciara');
    const boss = bossVon(k);
    const angriff = c.bossById['glaciara'].attacks.signature;
    const vorn = reihe(k, 'held', 'vorn');
    const hinten = reihe(k, 'held', 'hinten');
    const getroffen = sig_frostnova.signatur!({ k, boss, params: { radiusPx: 260, frostStacks: 2 }, angriff });
    expect(getroffen.map((f) => f.id).sort()).toEqual(vorn.map((f) => f.id).sort());
    for (const h of getroffen) expect(h.status.find((s) => s.id === 'frost')?.stapel).toBe(2);
    for (const h of hinten) expect(h.status.some((s) => s.id === 'frost')).toBe(false);
  });
});
