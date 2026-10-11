import { describe, expect, it } from 'vitest';
import { sig_kettenblitz } from './sig_kettenblitz';
import { bossVon, inhalt as c, testBossKampf } from '../testhilfe';

describe('sig_kettenblitz', () => {
  it('springt so oft, wie die Daten erlauben, und setzt Schock', () => {
    const k = testBossKampf('voltrax');
    const boss = bossVon(k);
    const angriff = c.bossById['voltrax'].attacks.signature;
    const params = { jumps: 5, jumpRadiusPx: 300, shockMs: 6000 };
    const getroffen = sig_kettenblitz.signatur!({ k, boss, params, angriff });
    expect(getroffen.length).toBe(Math.min(params.jumps, k.figuren.filter((f) => f.seite === 'held').length));
    for (const h of getroffen) {
      if (!h.tot) expect(h.status.some((s) => s.id === 'schock')).toBe(true);
    }
  });

  it('bleibt bei weniger Helden als Sprüngen bei den vorhandenen', () => {
    const k = testBossKampf('voltrax', 2);
    const boss = bossVon(k);
    const angriff = c.bossById['voltrax'].attacks.signature;
    const getroffen = sig_kettenblitz.signatur!({ k, boss, params: { jumps: 5, shockMs: 6000 }, angriff });
    expect(getroffen.length).toBeLessThanOrEqual(2);
  });
});
