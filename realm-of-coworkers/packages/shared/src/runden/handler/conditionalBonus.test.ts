// Meucheln (4.4): mehr Schaden gegen bereits geschwächte Ziele.
import { describe, expect, it } from 'vitest';
import { aktionAusfuehren } from '../aktionen';
import { statusSetzen } from '../status';
import { dickes, gegnerVon, heldVon, testHeld, testKampf } from '../testhilfe';

function schaden(mitGift: boolean): number {
  const k = testKampf({ helden: [testHeld('schurke')] });
  const ziel = gegnerVon(k);
  dickes(ziel);
  if (mitGift) statusSetzen(k, ziel, { id: 'gift', ms: 6000, wert: 0.35 });
  aktionAusfuehren(k, heldVon(k, 'schurke'), { k: 'faehigkeit', id: 'schurke_meucheln', ziel: ziel.id });
  return ziel.maxLp - ziel.lp;
}

describe('Handler conditionalBonus', () => {
  it('trifft ein vergiftetes Ziel härter als ein unversehrtes', () => {
    expect(schaden(true)).toBeGreaterThan(schaden(false));
  });
});
