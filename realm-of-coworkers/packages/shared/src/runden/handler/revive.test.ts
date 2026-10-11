// Wunder (4.5): belebt gefallene Verbündete mit einem Anteil ihres Lebens.
import { describe, expect, it } from 'vitest';
import { aktionAusfuehren } from '../aktionen';
import { heldVon, inhalt, testHeld, testKampf } from '../testhilfe';

describe('Handler revive', () => {
  it('holt gefallene Verbündete zurück', () => {
    const k = testKampf({ helden: [testHeld('kleriker'), testHeld('krieger', 10, 1)] });
    const kleriker = heldVon(k, 'kleriker');
    const krieger = heldVon(k, 'krieger');
    krieger.tot = true;
    krieger.lp = 0;
    kleriker.energie = inhalt.runden.energie.max;
    aktionAusfuehren(k, kleriker, { k: 'faehigkeit', id: 'kleriker_wunder' });
    expect(krieger.tot).toBe(false);
    expect(krieger.lp).toBeGreaterThan(0);
  });
});
