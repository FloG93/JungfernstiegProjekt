// Spott (4.1): zwingt gewöhnliche Gegner, erhöht beim Boss nur die Bedrohung.
import { describe, expect, it } from 'vitest';
import { aktionAusfuehren } from '../aktionen';
import { gegnerVon, heldVon, inhalt, testHeld, testKampf } from '../testhilfe';
import { rundenAusMs } from '../umrechnung';

describe('Handler taunt', () => {
  it('bindet gewöhnliche Gegner für die umgerechnete Dauer an den Spötter', () => {
    const k = testKampf({ helden: [testHeld('krieger'), testHeld('magier', 10, 1)] });
    const krieger = heldVon(k, 'krieger');
    const magier = heldVon(k, 'magier');
    const gegner = gegnerVon(k);
    gegner.bedrohung.set(magier.id, 99_999);
    aktionAusfuehren(k, krieger, { k: 'faehigkeit', id: 'krieger_spott' });
    expect(gegner.spottVon).toBe(krieger.id);
    expect(gegner.spottBisRunde).toBe(k.runde + rundenAusMs(inhalt, 4000));
  });

  it('zwingt Bosse nicht, hebt aber ihre Bedrohung über die bisher höchste', () => {
    const k = testKampf({ helden: [testHeld('krieger'), testHeld('magier', 10, 1)] });
    const krieger = heldVon(k, 'krieger');
    const magier = heldVon(k, 'magier');
    const boss = gegnerVon(k);
    boss.art = 'boss';
    boss.bedrohung.set(magier.id, 1000);
    aktionAusfuehren(k, krieger, { k: 'faehigkeit', id: 'krieger_spott' });
    expect(boss.spottVon).toBeNull();
    expect(boss.bedrohung.get(krieger.id)!).toBeGreaterThan(1000);
  });
});
