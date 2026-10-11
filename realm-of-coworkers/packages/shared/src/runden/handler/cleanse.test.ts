// Läuterung (4.5): nimmt je Verbündetem einen schwächenden Effekt.
import { describe, expect, it } from 'vitest';
import { aktionAusfuehren } from '../aktionen';
import { statusSetzen } from '../status';
import { heldVon, testHeld, testKampf } from '../testhilfe';

describe('Handler cleanse', () => {
  it('entfernt einen schwächenden Effekt je Verbündetem', () => {
    const k = testKampf({ helden: [testHeld('kleriker'), testHeld('krieger', 10, 1)] });
    const kleriker = heldVon(k, 'kleriker');
    const krieger = heldVon(k, 'krieger');
    statusSetzen(k, krieger, { id: 'gift', ms: 6000, wert: 0.35 });
    statusSetzen(k, kleriker, { id: 'blutung', ms: 5000, wert: 0.3 });
    aktionAusfuehren(k, kleriker, { k: 'faehigkeit', id: 'kleriker_laeuterung' });
    expect(krieger.status.some((s) => s.id === 'gift')).toBe(false);
    expect(kleriker.status.some((s) => s.id === 'blutung')).toBe(false);
  });
});
