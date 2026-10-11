// Durchschlag (4.3): trifft das Ziel voll und die Figur in der anderen Reihe anteilig.
import { describe, expect, it } from 'vitest';
import { aktionAusfuehren } from '../aktionen';
import { dickes, gegnerVon, heldVon, testHeld, testKampf } from '../testhilfe';

describe('Handler pierce', () => {
  it('schlägt durch auf die Figur dahinter', () => {
    const k = testKampf({
      helden: [testHeld('waldlaeufer')],
      gegner: [{ typ: 'scherge', stufe: 10, n: 2, kapitel: 2 }, { typ: 'schuetze', stufe: 10, n: 2, kapitel: 2 }],
    });
    const vorn = gegnerVon(k, 0);
    const hinten = gegnerVon(k, 1);
    dickes(vorn);
    dickes(hinten);
    aktionAusfuehren(k, heldVon(k, 'waldlaeufer'), {
      k: 'faehigkeit', id: 'waldlaeufer_gezielter_schuss', ziel: vorn.id,
    });
    const schadenVorn = vorn.maxLp - vorn.lp;
    const schadenHinten = hinten.maxLp - hinten.lp;
    expect(schadenVorn).toBeGreaterThan(0);
    expect(schadenHinten).toBeGreaterThan(0);
    expect(schadenHinten).toBeLessThan(schadenVorn);
  });
});
