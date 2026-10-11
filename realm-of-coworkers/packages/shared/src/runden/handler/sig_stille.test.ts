import { describe, expect, it } from 'vitest';
import { sig_stille } from './sig_stille';
import { bossVon, inhalt as c, testBossKampf } from '../testhilfe';

describe('sig_stille', () => {
  it('verschont, wer verteidigt oder einen Schild trägt, und setzt sonst Furcht', () => {
    const k = testBossKampf('nyxhara');
    const boss = bossVon(k);
    const angriff = c.bossById['nyxhara'].attacks.signature;
    const helden = k.figuren.filter((f) => f.seite === 'held');
    const sicher = helden[0]!;
    const geschildet = helden[1]!;
    sicher.verteidigt = true;
    geschildet.schilde.push({ menge: 10, runden: 2 });
    const getroffen = sig_stille.signatur!({ k, boss, params: { circles: 3, radiusPx: 120, delayMs: 3000, fearMs: 2000 }, angriff });
    expect(getroffen.some((f) => f.id === sicher.id)).toBe(false);
    expect(getroffen.some((f) => f.id === geschildet.id)).toBe(false);
    expect(getroffen.length).toBe(helden.length - 2);
    for (const h of getroffen) {
      if (!h.tot) expect(h.status.some((s) => s.id === 'furcht')).toBe(true);
    }
  });
});
