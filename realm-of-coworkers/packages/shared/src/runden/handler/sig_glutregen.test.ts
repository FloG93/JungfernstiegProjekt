import { describe, expect, it } from 'vitest';
import { sig_glutregen } from './sig_glutregen';
import { bossVon, inhalt as c, testBossKampf } from '../testhilfe';

describe('sig_glutregen', () => {
  it('schlägt so oft ein, wie es Säulen gibt', () => {
    const k = testBossKampf('ignarch');
    const boss = bossVon(k);
    const angriff = c.bossById['ignarch'].attacks.signature;
    const vorher = k.figuren.filter((f) => f.seite === 'held').map((f) => f.lp);
    const getroffen = sig_glutregen.signatur!({ k, boss, params: { pillars: 8, radiusPx: 90 }, angriff });
    const treffer = k.ereignisse.filter((e) => e.e === 'schaden' && e.von === boss.id);
    expect(treffer.length).toBe(8);
    expect(getroffen.length).toBeGreaterThan(0);
    const nachher = k.figuren.filter((f) => f.seite === 'held').map((f) => f.lp);
    expect(nachher.some((lp, i) => lp < vorher[i]!)).toBe(true);
  });
});
