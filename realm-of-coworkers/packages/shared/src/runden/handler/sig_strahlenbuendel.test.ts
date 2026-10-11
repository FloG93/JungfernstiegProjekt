import { describe, expect, it } from 'vitest';
import { sig_strahlenbuendel } from './sig_strahlenbuendel';
import { bossVon, inhalt as c, testBossKampf } from '../testhilfe';

describe('sig_strahlenbuendel', () => {
  it('trifft je Strahl einen Helden, bei genug Helden jeden nur einmal', () => {
    const k = testBossKampf('solaris');
    const boss = bossVon(k);
    const angriff = c.bossById['solaris'].attacks.signature;
    const getroffen = sig_strahlenbuendel.signatur!({ k, boss, params: { beams: 3, widthPx: 50 }, angriff });
    expect(getroffen.length).toBe(3);
    expect(new Set(getroffen.map((f) => f.id)).size).toBe(3);
  });

  it('trifft bei einem einzigen Helden diesen mehrfach', () => {
    const k = testBossKampf('solaris', 1);
    const boss = bossVon(k);
    const angriff = c.bossById['solaris'].attacks.signature;
    const held = k.figuren.find((f) => f.seite === 'held')!;
    held.maxLp = 1_000_000;
    held.lp = held.maxLp;
    sig_strahlenbuendel.signatur!({ k, boss, params: { beams: 3, widthPx: 50 }, angriff });
    expect(k.ereignisse.filter((e) => e.e === 'schaden' && e.an === held.id).length).toBe(3);
  });
});
