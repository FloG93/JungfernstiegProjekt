import { describe, expect, it } from 'vitest';
import { sig_beben } from './sig_beben';
import { bossVon, inhalt as c, testBossKampf } from '../testhilfe';

describe('sig_beben', () => {
  it('trifft die ganze Party und betäubt die Überlebenden', () => {
    const k = testBossKampf('gorthul');
    const boss = bossVon(k);
    const angriff = c.bossById['gorthul'].attacks.signature;
    const helden = k.figuren.filter((f) => f.seite === 'held');
    const getroffen = sig_beben.signatur!({ k, boss, params: { radiusPx: 300, stunMs: 1500 }, angriff });
    expect(getroffen.length).toBe(helden.length);
    for (const h of getroffen) {
      if (!h.tot) expect(h.status.some((s) => s.id === 'betaeubung')).toBe(true);
    }
  });
});
