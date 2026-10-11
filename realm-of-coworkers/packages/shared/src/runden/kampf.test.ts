// Abnahme des Rundenkerns (ENTWURF-rundenkampf.md, Abschnitt 1).
import { describe, expect, it } from 'vitest';
import { aktionAusfuehren } from './aktionen';
import { rundeAusfuehren, reihenfolgeBestimmen } from './kampf';
import { statusSetzen } from './status';
import { inhalt as c, testHeld as held, testKampf as aufbau } from './testhilfe';
import { lebende } from './typen';
import type { Figur, Kampf } from './typen';
import { rundenAusMs, rundenAusSekunden } from './umrechnung';
import { erreichbareZiele, istNahkampf, reihe } from './ziele';

const vonSeite = (k: Kampf, seite: 'held' | 'gegner') => k.figuren.filter((f) => f.seite === seite);

describe('Aufstellung und Reihen (ENTWURF 1.1)', () => {
  it('Nahkämpfer stehen vorn, Fernkämpfer hinten', () => {
    const k = aufbau({
      helden: [held('krieger', 10, 0), held('magier', 10, 1), held('schurke', 10, 2), held('kleriker', 10, 3)],
      gegner: [{ typ: 'scherge', stufe: 10, n: 4, kapitel: 2 }, { typ: 'schuetze', stufe: 10, n: 4, kapitel: 2 }],
    });
    const platz = (name: string) => k.figuren.find((f) => f.name.startsWith(name))!.reihe;
    expect(platz('krieger')).toBe('vorn');
    expect(platz('schurke')).toBe('vorn');
    expect(platz('magier')).toBe('hinten');
    expect(platz('kleriker')).toBe('hinten');
    expect(k.figuren.find((f) => f.typ === 'scherge')!.reihe).toBe('vorn');
    expect(k.figuren.find((f) => f.typ === 'schuetze')!.reihe).toBe('hinten');
  });

  it('Nahkampf erreicht nur die vordere Gegnerreihe, Fernkampf alle', () => {
    const k = aufbau({
      helden: [held('krieger'), held('magier', 10, 1)],
      gegner: [{ typ: 'scherge', stufe: 10, n: 2, kapitel: 2 }, { typ: 'schuetze', stufe: 10, n: 2, kapitel: 2 }],
    });
    const krieger = k.figuren.find((f) => f.klasse === 'krieger')!;
    const magier = k.figuren.find((f) => f.klasse === 'magier')!;
    expect(istNahkampf(c, krieger)).toBe(true);
    expect(erreichbareZiele(k, krieger).map((f) => f.typ)).toEqual(['scherge']);
    expect(erreichbareZiele(k, magier).map((f) => f.typ).sort()).toEqual(['scherge', 'schuetze']);
  });

  it('fällt die vordere Reihe, rückt die hintere nach', () => {
    const k = aufbau({
      helden: [held('krieger')],
      gegner: [{ typ: 'scherge', stufe: 10, n: 2, kapitel: 2 }, { typ: 'schuetze', stufe: 10, n: 2, kapitel: 2 }],
    });
    const scherge = k.figuren.find((f) => f.typ === 'scherge')!;
    const krieger = k.figuren.find((f) => f.klasse === 'krieger')!;
    expect(erreichbareZiele(k, krieger).map((f) => f.id)).toEqual([scherge.id]);
    scherge.lp = 1;
    rundeAusfuehren(k);
    expect(k.figuren.find((f) => f.typ === 'schuetze')!.reihe).toBe('vorn');
  });
});

describe('Initiative (ENTWURF 1.2)', () => {
  it('ordnet nach Tempo, bei Gleichstand nach der kleineren Nummer', () => {
    const k = aufbau({ helden: [held('krieger'), held('schurke', 10, 1)] });
    const tempo = (id: number) => k.figuren.find((f) => f.id === id)!.grundwerte.tmp;
    const folge = reihenfolgeBestimmen(k);
    for (let i = 1; i < folge.length; i++) {
      const a = tempo(folge[i - 1]!);
      const b = tempo(folge[i]!);
      expect(a === b ? folge[i - 1]! < folge[i]! : a > b).toBe(true);
    }
  });

  it('tote Figuren stehen nicht mehr in der Reihenfolge', () => {
    const k = aufbau({ helden: [held('krieger'), held('magier', 10, 1)] });
    const magier = k.figuren.find((f) => f.klasse === 'magier')!;
    magier.tot = true;
    expect(reihenfolgeBestimmen(k)).not.toContain(magier.id);
  });
});

describe('Umrechnung der Daten (ENTWURF 2.1)', () => {
  it('Sekunden und Millisekunden werden zu Runden', () => {
    expect(rundenAusSekunden(c, 6)).toBe(2);
    expect(rundenAusSekunden(c, 8)).toBe(3);
    expect(rundenAusSekunden(c, 12)).toBe(4);
    expect(rundenAusSekunden(c, 20)).toBe(7);
    expect(rundenAusMs(c, 1500)).toBe(1);
    expect(rundenAusMs(c, 6000)).toBe(2);
    expect(rundenAusMs(c, 8000)).toBe(3);
  });

  it('Abklingzeiten zählen in eigenen Runden herunter', () => {
    const k = aufbau({ helden: [held('krieger')] });
    const krieger = k.figuren.find((f) => f.klasse === 'krieger')!;
    const ziel = vonSeite(k, 'gegner')[0]!;
    ziel.maxLp = 1_000_000;
    ziel.lp = 1_000_000;
    rundeAusfuehren(k, new Map([[krieger.id, { k: 'faehigkeit', id: 'krieger_schildstoss', ziel: ziel.id }]]));
    expect(krieger.abkling['krieger_schildstoss']).toBe(rundenAusSekunden(c, 8) - 1);
    rundeAusfuehren(k, new Map([[krieger.id, { k: 'verteidigen' }]]));
    expect(krieger.abkling['krieger_schildstoss']).toBe(rundenAusSekunden(c, 8) - 2);
  });
});

describe('Handlungen (ENTWURF 1.3)', () => {
  it('Verteidigen halbiert den erlittenen Schaden', () => {
    const bauen = () => aufbau({ helden: [held('krieger')], gegner: [{ typ: 'brecher', stufe: 20, n: 1, kapitel: 2 }] });
    const ohne = bauen();
    const held1 = ohne.figuren.find((f) => f.klasse === 'krieger')!;
    const gegner1 = vonSeite(ohne, 'gegner')[0]!;
    const vorher = held1.lp;
    aktionAusfuehren(ohne, gegner1, { k: 'angriff', ziel: held1.id });
    const voll = vorher - held1.lp;

    const mit = bauen();
    const held2 = mit.figuren.find((f) => f.klasse === 'krieger')!;
    const gegner2 = vonSeite(mit, 'gegner')[0]!;
    aktionAusfuehren(mit, held2, { k: 'verteidigen' });
    const vorher2 = held2.lp;
    aktionAusfuehren(mit, gegner2, { k: 'angriff', ziel: held2.id });
    const halb = vorher2 - held2.lp;
    expect(halb).toBeLessThan(voll);
    expect(halb / voll).toBeCloseTo(c.runden.verteidigen.schadenMult, 1);
  });

  it('Reihe wechseln bringt den Helden nach hinten', () => {
    const k = aufbau({ helden: [held('krieger'), held('magier', 10, 1)] });
    const krieger = k.figuren.find((f) => f.klasse === 'krieger')!;
    aktionAusfuehren(k, krieger, { k: 'reihe' });
    expect(krieger.reihe).toBe('hinten');
    expect(k.ereignisse.some((e) => e.e === 'reihe' && e.id === krieger.id)).toBe(true);
  });

  it('Trank heilt, verbraucht eine Ladung und hat danach Abklingzeit', () => {
    const k = aufbau({ helden: [held('krieger')] });
    const krieger = k.figuren.find((f) => f.klasse === 'krieger')!;
    krieger.lp = Math.round(krieger.maxLp / 2);
    const vorher = krieger.lp;
    aktionAusfuehren(k, krieger, { k: 'trank' });
    expect(krieger.lp).toBeGreaterThan(vorher);
    expect(krieger.traenke).toBe(c.balance.combat.potion.charges - 1);
    const nochmal = krieger.lp;
    aktionAusfuehren(k, krieger, { k: 'trank' });
    expect(krieger.lp).toBe(nochmal);
  });

  it('Betäubung nimmt die Handlung der nächsten Runde', () => {
    const k = aufbau({ helden: [held('krieger')] });
    const gegner = vonSeite(k, 'gegner')[0]!;
    const krieger = k.figuren.find((f) => f.klasse === 'krieger')!;
    statusSetzen(k, gegner, { id: 'betaeubung', ms: 1500 });
    const vorher = krieger.lp;
    rundeAusfuehren(k, new Map([[krieger.id, { k: 'verteidigen' }]]));
    expect(krieger.lp).toBe(vorher);
    expect(k.ereignisse.some((e) => e.e === 'verfehlt' && e.von === gegner.id && e.grund === 'blockiert')).toBe(true);
  });
});

describe('Energie und Ultimate (ENTWURF 1.5)', () => {
  it('Energie wächst je Handlung, die Ultimate verbraucht sie ganz', () => {
    const k = aufbau({ helden: [held('krieger')], gegner: [{ typ: 'scherge', stufe: 40, n: 1, kapitel: 2 }] });
    const krieger = k.figuren.find((f) => f.klasse === 'krieger')!;
    expect(krieger.energie).toBe(c.runden.energie.start);
    aktionAusfuehren(k, krieger, { k: 'verteidigen' });
    expect(krieger.energie).toBe(c.runden.energie.jeAktion);
    krieger.energie = c.runden.energie.max;
    aktionAusfuehren(k, krieger, { k: 'faehigkeit', id: 'krieger_bollwerk' });
    expect(krieger.energie).toBe(0);
    expect(krieger.schilde.length).toBeGreaterThan(0);
  });

  it('ohne volle Energie geht die Ultimate nicht', () => {
    const k = aufbau({ helden: [held('krieger')] });
    const krieger = k.figuren.find((f) => f.klasse === 'krieger')!;
    krieger.energie = 0;
    aktionAusfuehren(k, krieger, { k: 'faehigkeit', id: 'krieger_bollwerk' });
    expect(k.ereignisse.some((e) => e.e === 'verfehlt' && e.grund === 'nichtBereit')).toBe(true);
    expect(krieger.schilde.length).toBe(0);
  });

  it('gegen Bosse startet die Energie höher', () => {
    const k = aufbau({ helden: [held('krieger')], gegenBoss: true });
    expect(k.figuren.find((f) => f.klasse === 'krieger')!.energie).toBe(c.runden.energie.startBoss);
  });
});

describe('Bedrohung (6.6)', () => {
  it('Gegner greifen den Helden mit der höchsten Bedrohung an', () => {
    const k = aufbau({ helden: [held('krieger'), held('magier', 10, 1)] });
    const gegner = vonSeite(k, 'gegner')[0]!;
    const krieger = k.figuren.find((f) => f.klasse === 'krieger')!;
    const magier = k.figuren.find((f) => f.klasse === 'magier')!;
    gegner.bedrohung.set(magier.id, 100);
    gegner.bedrohung.set(krieger.id, 500);
    aktionAusfuehren(k, gegner, { k: 'angriff', ziel: (gegner.zielId = krieger.id) });
    expect(gegner.zielId).toBe(krieger.id);
  });

  it('Spott zwingt den Gegner für die umgerechnete Dauer auf den Spötter', () => {
    const k = aufbau({ helden: [held('krieger'), held('magier', 10, 1)] });
    const gegner = vonSeite(k, 'gegner')[0]!;
    const krieger = k.figuren.find((f) => f.klasse === 'krieger')!;
    const magier = k.figuren.find((f) => f.klasse === 'magier')!;
    gegner.bedrohung.set(magier.id, 10_000);
    aktionAusfuehren(k, krieger, { k: 'faehigkeit', id: 'krieger_spott' });
    expect(gegner.spottVon).toBe(krieger.id);
    expect(gegner.spottBisRunde).toBe(k.runde + rundenAusMs(c, 4000));
  });

  it('Verteidigen erhöht die eigene Bedrohung', () => {
    const k = aufbau({ helden: [held('krieger')] });
    const gegner = vonSeite(k, 'gegner')[0]!;
    const krieger = k.figuren.find((f) => f.klasse === 'krieger')!;
    gegner.bedrohung.set(krieger.id, 100);
    aktionAusfuehren(k, krieger, { k: 'verteidigen' });
    expect(gegner.bedrohung.get(krieger.id)).toBeCloseTo(100 * c.runden.verteidigen.bedrohungMult, 5);
  });
});

describe('Kampfverlauf', () => {
  it('eine Party schlägt eine kleine Gruppe und der Kampf endet mit Sieg', () => {
    const k = aufbau({
      helden: [held('krieger'), held('magier', 10, 1), held('kleriker', 10, 2)],
      gegner: [
        { typ: 'scherge', stufe: 8, n: 3, kapitel: 2 },
        { typ: 'scherge', stufe: 8, n: 3, kapitel: 2 },
        { typ: 'schuetze', stufe: 8, n: 3, kapitel: 2 },
      ],
    });
    let runden = 0;
    while (k.ergebnis === 'laeuft' && runden < 60) {
      rundeAusfuehren(k);
      runden++;
    }
    expect(k.ergebnis).toBe('sieg');
    expect(lebende(k, 'held').length).toBeGreaterThan(0);
    expect(runden).toBeGreaterThan(1);
  });

  it('gleicher Seed, gleicher Ablauf (2.3)', () => {
    const lauf = () => {
      const k = aufbau({
        helden: [held('krieger'), held('waldlaeufer', 10, 1)],
        gegner: [{ typ: 'scherge', stufe: 10, n: 2, kapitel: 2 }, { typ: 'hetzer', stufe: 10, n: 2, kapitel: 2 }],
      });
      const alle: string[] = [];
      while (k.ergebnis === 'laeuft' && k.runde < 40) alle.push(JSON.stringify(rundeAusfuehren(k)));
      return alle.join('|');
    };
    expect(lauf()).toBe(lauf());
  });

  it('eine übermächtige Gruppe führt zur Niederlage', () => {
    const k = aufbau({
      helden: [held('magier', 1)],
      gegner: [{ typ: 'brecher', stufe: 30, n: 1, kapitel: 2 }, { typ: 'brecher', stufe: 30, n: 1, kapitel: 2 }],
    });
    while (k.ergebnis === 'laeuft' && k.runde < 60) rundeAusfuehren(k);
    expect(k.ergebnis).toBe('niederlage');
  });
});

describe('Rundenprotokoll', () => {
  it('beginnt mit der Reihenfolge und endet mit dem Rundenende', () => {
    const k = aufbau({ helden: [held('krieger')] });
    const ev = rundeAusfuehren(k);
    expect(ev[0]).toMatchObject({ e: 'rundeStart', runde: 1 });
    expect(ev.at(-1)).toMatchObject({ e: 'rundeEnde', runde: 1 });
    expect(ev.some((e) => e.e === 'aktion')).toBe(true);
  });

  it('meldet Tod und Kampfende', () => {
    const k = aufbau({ helden: [held('krieger')] });
    const gegner = vonSeite(k, 'gegner')[0]!;
    gegner.lp = 1;
    const ev = rundeAusfuehren(k);
    expect(ev.some((e) => e.e === 'tod' && e.id === gegner.id)).toBe(true);
    expect(ev.some((e) => e.e === 'kampfEnde' && e.ergebnis === 'sieg')).toBe(true);
  });
});

describe('Status über Zeit', () => {
  it('Gift zieht am Rundenende Leben ab und läuft nach der umgerechneten Dauer aus', () => {
    const k = aufbau({ helden: [held('schurke')], gegner: [{ typ: 'brecher', stufe: 10, n: 1, kapitel: 2 }] });
    const schurke = k.figuren.find((f) => f.klasse === 'schurke')!;
    const gegner = vonSeite(k, 'gegner')[0]!;
    gegner.maxLp = 1_000_000;
    gegner.lp = 1_000_000;
    statusSetzen(k, gegner, { id: 'gift', ms: 6000, wert: 0.35, quelleId: schurke.id });
    const vorher = gegner.lp;
    rundeAusfuehren(k, new Map([[schurke.id, { k: 'verteidigen' }]]));
    expect(gegner.lp).toBeLessThan(vorher);
    expect(k.ereignisse.some((e) => e.e === 'schaden' && e.dot === true)).toBe(true);
    rundeAusfuehren(k, new Map([[schurke.id, { k: 'verteidigen' }]]));
    expect(gegner.status.some((s) => s.id === 'gift')).toBe(false);
  });
});

describe('Reihen füllen sich nicht über die Plätze hinaus', () => {
  it('höchstens so viele Gegner je Reihe wie Plätze', () => {
    const viele = Array.from({ length: 8 }, () => ({ typ: 'scherge' as const, stufe: 5, n: 8, kapitel: 2 }));
    const k = aufbau({ helden: [held('krieger')], gegner: viele });
    expect(reihe(k, 'gegner', 'vorn').length).toBeLessThanOrEqual(c.runden.reihe.plaetze);
    expect(k.figuren.filter((f: Figur) => f.seite === 'gegner').length).toBeLessThanOrEqual(c.runden.gegnerMax);
  });
});
