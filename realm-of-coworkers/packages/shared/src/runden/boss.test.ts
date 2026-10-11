// Abnahme R3: Bosse mit Ansagen (10.1 bis 10.6, ENTWURF-rundenkampf.md Abschnitt 3.2).
import { describe, expect, it } from 'vitest';
import { bossSchaden } from './boss';
import { reihenfolgeBestimmen, rundeAusfuehren } from './kampf';
import { statusSetzen } from './status';
import { rundenAusMs, rundenAusSekunden } from './umrechnung';
import { bossVon, inhalt as c, testBossKampf } from './testhilfe';
import type { Ereignis, Kampf } from './typen';

const ereignis = <T extends Ereignis['e']>(ev: Ereignis[], e: T) =>
  ev.filter((x): x is Extract<Ereignis, { e: T }> => x.e === e);

/** Spielt Runden, bis das gesuchte Ereignis fällt; gibt die Ereignisse dieser Runde zurück. */
function bisEreignis(k: Kampf, e: Ereignis['e'], maxRunden = 40): Ereignis[] {
  for (let i = 0; i < maxRunden; i++) {
    const ev = rundeAusfuehren(k);
    if (ev.some((x) => x.e === e)) return ev;
  }
  throw new Error(`Ereignis ${e} kam in ${maxRunden} Runden nicht`);
}

describe('Boss im Rundenkampf (10.1)', () => {
  it('handelt als Letzter, damit Verteidigen und Schilde noch greifen', () => {
    const k = testBossKampf('ignarch');
    const ordnung = reihenfolgeBestimmen(k);
    expect(ordnung[ordnung.length - 1]).toBe(bossVon(k).id);
  });

  it('hat Leben nach n und Kampfstufe, Schaden nach M(n) (10.1)', () => {
    const klein = bossVon(testBossKampf('ignarch', 1));
    const gross = bossVon(testBossKampf('ignarch', 6));
    const hart = bossVon(testBossKampf('ignarch', 6, 3, c.balance.boss.kampfstufeMax));
    expect(gross.maxLp).toBeGreaterThan(klein.maxLp);
    expect(hart.maxLp).toBeGreaterThan(gross.maxLp);
    expect(hart.boss!.schadenMult).toBeGreaterThan(gross.boss!.schadenMult);
  });

  it('ist gegen harte Kontrolle immun (10.3)', () => {
    const k = testBossKampf('ignarch');
    const boss = bossVon(k);
    expect(statusSetzen(k, boss, { id: 'betaeubung', ms: c.statusById['betaeubung']!.defaultMs })).toBe(false);
    expect(boss.status.some((s) => s.id === 'betaeubung')).toBe(false);
  });

  it('greift die Party jede Runde an', () => {
    const k = testBossKampf('glaciara');
    const ev = rundeAusfuehren(k);
    expect(ereignis(ev, 'bossAngriff').length).toBe(1);
  });
});

describe('Ansagen (ENTWURF 3.2)', () => {
  it('kündigt den Flächenangriff an und führt ihn in der nächsten Runde aus', () => {
    const k = testBossKampf('glaciara');
    const z = bossVon(k).boss!;
    z.teleRest = 1;
    const ansage = rundeAusfuehren(k);
    expect(ereignis(ansage, 'bossAnsage')[0]?.art).toBe('telegraph');
    expect(ereignis(ansage, 'bossAngriff').length).toBe(0);
    const ausfuehrung = rundeAusfuehren(k);
    expect(ereignis(ausfuehrung, 'bossAngriff')[0]?.art).toBe('telegraph');
  });

  it('die Ansage liegt genau die vereinbarte Zahl von Runden vor der Ausführung', () => {
    const k = testBossKampf('voltrax');
    const z = bossVon(k).boss!;
    z.teleRest = 1;
    const ev = rundeAusfuehren(k);
    const a = ereignis(ev, 'bossAnsage')[0]!;
    expect(a.runde).toBe(k.runde + c.runden.boss.ansageRunden);
  });

  it('der Signaturangriff kommt erst ab der vorgesehenen Phase (10.4)', () => {
    const k = testBossKampf('nyxhara');
    const boss = bossVon(k);
    const ab = c.bossById['nyxhara'].attacks.signature.fromPhase ?? 1;
    boss.boss!.sigRest = 1;
    boss.boss!.teleRest = 99;
    boss.boss!.pulsRest = 99;
    expect(boss.boss!.phase).toBeLessThan(ab);
    const ev = rundeAusfuehren(k);
    expect(ereignis(ev, 'bossAnsage').length).toBe(0);
    expect(boss.boss!.sigRest).toBe(1);
  });

  it('wer auf die Ansage hin verteidigt, nimmt die Hälfte des Schadens', () => {
    const k = testBossKampf('gorthul');
    const boss = bossVon(k);
    boss.boss!.sigRest = 1;
    boss.boss!.phase = c.bossById['gorthul'].attacks.signature.fromPhase ?? 1;
    const held = k.figuren.find((f) => f.seite === 'held')!;
    held.lp = held.maxLp;
    rundeAusfuehren(k); // Ansage
    const vorher = held.lp;
    const wahlen = new Map(k.figuren.filter((f) => f.seite === 'held').map((f) => [f.id, { k: 'verteidigen' } as const]));
    rundeAusfuehren(k, wahlen);
    const mitSchutz = vorher - held.lp;

    const k2 = testBossKampf('gorthul');
    const boss2 = bossVon(k2);
    boss2.boss!.sigRest = 1;
    boss2.boss!.phase = c.bossById['gorthul'].attacks.signature.fromPhase ?? 1;
    const held2 = k2.figuren.find((f) => f.seite === 'held')!;
    held2.lp = held2.maxLp;
    rundeAusfuehren(k2);
    const vorher2 = held2.lp;
    rundeAusfuehren(k2, new Map(k2.figuren.filter((f) => f.seite === 'held').map((f) => [f.id, { k: 'reihe' } as const])));
    const ohneSchutz = vorher2 - held2.lp;
    expect(mitSchutz).toBeGreaterThan(0);
    expect(mitSchutz).toBeLessThan(ohneSchutz);
  });
});

describe('Phasen (10.5)', () => {
  it('wechselt an der Schwelle, tauscht das Element und heilt die Party', () => {
    const k = testBossKampf('ignarch');
    const boss = bossVon(k);
    const def = c.bossById['ignarch'];
    const schwelle = (def.phases[1]!.fromPct / 100) * boss.maxLp;
    const held = k.figuren.find((f) => f.seite === 'held')!;
    const gefallen = k.figuren.filter((f) => f.seite === 'held')[1]!;
    held.lp = 1;
    gefallen.tot = true;
    gefallen.lp = 0;
    boss.lp = Math.round(schwelle) - 1;
    const ev = rundeAusfuehren(k);
    const phase = ereignis(ev, 'bossPhase')[0]!;
    expect(phase.phase).toBe(2);
    expect(phase.element).toBe(def.phases[1]!.element);
    expect(boss.element).toBe(def.phases[1]!.element);
    expect(held.lp).toBeGreaterThan(1);
    expect(gefallen.tot).toBe(false);
    expect(gefallen.lp).toBeGreaterThanOrEqual(
      Math.round((gefallen.maxLp * c.balance.boss.phaseTransition.revivePct) / 100),
    );
  });

  it('greift während des Übergangs nicht an und ist unverwundbar', () => {
    const k = testBossKampf('glaciara');
    const boss = bossVon(k);
    const def = c.bossById['glaciara'];
    boss.lp = Math.round((def.phases[1]!.fromPct / 100) * boss.maxLp) - 1;
    rundeAusfuehren(k);
    expect(boss.status.some((s) => s.id === 'unverwundbar')).toBe(true);
    const runden = Math.max(1, rundenAusMs(c, c.balance.boss.phaseTransition.invulnMs));
    expect(boss.boss!.uebergangBisRunde).toBe(k.runde + runden - 1);
    const ev = rundeAusfuehren(k);
    expect(ereignis(ev, 'bossAngriff').length).toBe(0);
  });

  it('räumt beim Phasenwechsel die Adds weg (10.4)', () => {
    const k = testBossKampf('voltrax');
    const boss = bossVon(k);
    bisEreignis(k, 'nachruecken');
    expect(k.figuren.some((f) => f.art === 'gegner' && !f.tot)).toBe(true);
    const def = c.bossById['voltrax'];
    const naechste = def.phases[boss.boss!.phase]!;
    boss.lp = Math.round((naechste.fromPct / 100) * boss.maxLp) - 1;
    rundeAusfuehren(k);
    expect(k.figuren.some((f) => f.art === 'gegner' && !f.tot)).toBe(false);
    expect(k.reserve.length).toBe(0);
  });
});

describe('Wutwechsel, Adds und Raserei (10.4)', () => {
  it('der Wutwechsel zwingt den Boss für die umgerechnete Dauer auf ein Ziel', () => {
    const k = testBossKampf('solaris');
    const ev = bisEreignis(k, 'wutwechsel');
    const w = ereignis(ev, 'wutwechsel')[0]!;
    const boss = bossVon(k);
    expect(boss.boss!.wutZielId).toBe(w.ziel);
    expect(boss.boss!.wutBisRunde).toBe(k.runde + Math.max(1, rundenAusMs(c, c.balance.boss.rage.ms)));
    const angriff = ereignis(ev, 'bossAngriff').find((x) => x.art === 'standard');
    if (angriff) expect(angriff.ziele).toEqual([w.ziel]);
  });

  it('die erste Add-Welle kommt nach der umgerechneten Zeit', () => {
    const k = testBossKampf('nyxhara');
    const def = c.bossById['nyxhara'];
    expect(bossVon(k).boss!.addsRest).toBe(rundenAusSekunden(c, def.adds.firstAtS));
    const ev = bisEreignis(k, 'nachruecken');
    expect(ereignis(ev, 'nachruecken')[0]?.typ).toBe(def.adds.enemy);
  });

  it('Raserei beginnt nach der eingestellten Runde und steigert den Schaden', () => {
    const k = testBossKampf('ignarch');
    const boss = bossVon(k);
    const vorher = bossSchaden(k, boss, c.bossById['ignarch'].attacks.standard.pctRefHp);
    boss.boss!.rasereiRest = 1;
    rundeAusfuehren(k);
    expect(boss.boss!.raserei).toBe(c.balance.boss.enrage.bonus);
    expect(bossSchaden(k, boss, c.bossById['ignarch'].attacks.standard.pctRefHp)).toBeGreaterThan(vorher);
  });
});
