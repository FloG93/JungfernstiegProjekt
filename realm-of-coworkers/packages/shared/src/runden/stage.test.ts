// Abnahme R2: Stage als Folge von Rundenkämpfen (9.1 bis 9.7, ENTWURF 3.1).
import { describe, expect, it } from 'vitest';
import { enemyDps, introFactor } from '../formulas';
import { planEncounter } from '../spawn';
import { Rng } from '../rng';
import { reserveNachruecken } from './kampf';
import { begegnungGegner, bossBeginnen, laufAnlegen, laufAufgeben, laufDurchspielen, laufRunde } from './stage';
import type { Lauf } from './stage';
import { inhalt as c, testHeld } from './testhilfe';
import type { LaufEreignis } from './stage';
import type { Ereignis } from './typen';

const party = (anzahl: number, stufe: number) =>
  (['krieger', 'magier', 'waldlaeufer', 'schurke', 'kleriker', 'runenweber'] as const)
    .slice(0, anzahl)
    .map((klasse, i) => testHeld(klasse, stufe, i, true));

function lauf(stage: number, anzahl = 6, seed = 5): Lauf {
  return laufAnlegen({ content: c, seed, stage, helden: party(anzahl, c.stages[stage - 1]!.recommendedLevel) });
}

const laufEv = (ev: (Ereignis | LaufEreignis)[]) => ev.filter((e): e is LaufEreignis => 'index' in e || e.e === 'tor');

describe('Begegnungen aus dem Spawn-Budget (9.5 bis 9.7)', () => {
  it('nimmt Gegner aus dem geplanten Budget, aber nur den vereinbarten Anteil (OPEN-056)', () => {
    const def = c.stages[9]!;
    const plan = planEncounter(c, new Rng(3), def, 0, 6);
    const geplant = plan.groups.flatMap((g) => g.enemies.map((e) => e.type));
    const gegner = begegnungGegner(c, new Rng(3), def, 0, 6);
    expect(gegner.length).toBe(Math.round(geplant.length * c.runden.begegnung.gegnerMult));
    for (const g of gegner) expect(geplant).toContain(g.typ);
  });

  it('gleicht die kleinere Gegnerzahl über den Schaden aus (OPEN-056)', () => {
    const l = lauf(10);
    const gegner = l.kampf.figuren.find((f) => f.seite === 'gegner')!;
    const def = c.enemyById[gegner.typ as 'scherge'];
    const roh = enemyDps(c.balance, l.def.stage) * def.dmgMult * c.runden.rundeSekunden
      * introFactor(c.balance, l.def.stage);
    expect(gegner.schadenJeAktion).toBeCloseTo(roh * c.runden.begegnung.schadenMult, 5);
  });

  it('eine Begegnung dauert zwischen 3 und 16 Runden', () => {
    for (const stage of [3, 10, 20]) {
      const l = lauf(stage, 6, stage);
      let runden = 0;
      while (l.phase === 'kampf' && l.index === 0 && runden < 40) {
        laufRunde(l);
        runden++;
      }
      expect(runden).toBeGreaterThanOrEqual(3);
      expect(runden).toBeLessThanOrEqual(16);
    }
  });

  it('wartende Gegner rücken nach, sobald ein Platz frei wird', () => {
    const l = lauf(28);
    // Reserve künstlich füllen, falls die Begegnung das Feld nicht ausreizt
    if (l.kampf.reserve.length === 0) {
      const vorlage = l.kampf.figuren.find((f) => f.seite === 'gegner')!;
      l.kampf.reserve.push({ ...vorlage, id: 9999, bedrohung: new Map(), status: [], schilde: [] });
    }
    const wartend = l.kampf.reserve[0]!.id;
    while (l.kampf.figuren.filter((f) => f.seite === 'gegner' && !f.tot).length >= c.runden.gegnerMax) {
      l.kampf.figuren.find((f) => f.seite === 'gegner' && !f.tot)!.tot = true;
    }
    reserveNachruecken(l.kampf);
    expect(l.kampf.figuren.some((f) => f.id === wartend)).toBe(true);
    expect(l.kampf.figuren.filter((f) => f.seite === 'gegner' && !f.tot).length)
      .toBeLessThanOrEqual(c.runden.gegnerMax);
  });
});

describe('Ablauf einer Stage', () => {
  it('spielt alle Begegnungen der Reihe nach und endet mit Sieg', () => {
    const l = lauf(10);
    const runden = laufDurchspielen(l);
    expect(l.phase).toBe('tor'); // Stage 10 ist eine Boss-Stage: Ende am Tor
    expect([...l.erledigt].sort()).toEqual(l.def.encounters.map((_, i) => i));
    expect(runden).toBeGreaterThan(l.def.encounters.length);
  });

  it('eine gewöhnliche Stage endet gewonnen', () => {
    const l = lauf(3);
    laufDurchspielen(l);
    expect(l.phase).toBe('gewonnen');
    expect(l.protokoll.some((e) => 'e' in e && e.e === 'stageEnde')).toBe(true);
  });

  it('jede Begegnung zahlt genau einmal ihren vollen Anteil (12.3)', () => {
    const l = lauf(3);
    laufDurchspielen(l);
    const enden = l.protokoll.filter((e): e is LaufEreignis => 'e' in e && e.e === 'begegnungEnde');
    expect(enden.length).toBe(l.def.encounters.length);
    for (const e of enden) expect(e.anteil).toBe(1);
    expect(new Set(enden.map((e) => e.index)).size).toBe(l.def.encounters.length);
  });

  it('Checkpoints werden in der richtigen Reihenfolge erreicht', () => {
    const l = lauf(3);
    laufDurchspielen(l);
    const cps = l.protokoll.filter((e): e is LaufEreignis => 'e' in e && e.e === 'checkpoint').map((e) => e.index);
    expect(cps).toEqual([0, 1]);
  });

  it('Schaden bleibt zwischen den Begegnungen, Gefallene stehen danach wieder auf', () => {
    const l = lauf(3, 2);
    laufRunde(l);
    const held = l.kampf.figuren.find((f) => f.seite === 'held')!;
    held.lp = Math.max(1, Math.round(held.maxLp * 0.2));
    while (l.phase === 'kampf' && l.index === 0) laufRunde(l);
    const anteil = l.anteile.get(held.dbId!)!;
    expect(anteil).toBeLessThan(100);
    expect(anteil).toBeGreaterThan(0);
  });
});

describe('Wipe und Checkpoint (9.2)', () => {
  it('nach einem Wipe geht es am letzten Checkpoint weiter, davor bleibt alles erledigt', () => {
    const l = lauf(3, 1);
    // Bis über den ersten Checkpoint spielen
    while (l.phase === 'kampf' && l.checkpoint < 0) laufRunde(l);
    expect(l.checkpoint).toBe(0);
    const erledigtVorher = [...l.erledigt].sort();
    const indexVorher = l.index;
    for (const f of l.kampf.figuren) {
      if (f.seite === 'held') {
        f.lp = 1;
        f.tot = false;
      }
    }
    // Gegner übermächtig machen, damit der nächste Zug die Party auslöscht
    for (const f of l.kampf.figuren) if (f.seite === 'gegner') f.schadenJeAktion = 1_000_000;
    while (l.phase === 'kampf' && l.wipes === 0) laufRunde(l);
    expect(l.wipes).toBe(1);
    expect(l.index).toBeLessThanOrEqual(indexVorher);
    expect([...l.erledigt].sort()).toEqual(erledigtVorher.filter((i) => i < l.index));
    expect(l.protokoll.some((e) => 'e' in e && e.e === 'wipe')).toBe(true);
  });

  it('Aufgeben beendet den Lauf', () => {
    const l = lauf(3);
    laufAufgeben(l);
    expect(l.phase).toBe('verloren');
  });
});

describe('Wiederholbarkeit', () => {
  it('gleicher Seed, gleicher Verlauf', () => {
    const spiel = () => {
      const l = lauf(7, 4, 11);
      laufDurchspielen(l);
      return JSON.stringify(l.protokoll);
    };
    expect(spiel()).toBe(spiel());
  });

  it('andere Seeds führen zu anderen Gegnern', () => {
    const typen = (seed: number) => lauf(7, 4, seed).kampf.figuren.filter((f) => f.seite === 'gegner').map((f) => f.typ).join(',');
    const a = typen(1);
    const verschieden = [2, 3, 4, 5, 6].some((s) => typen(s) !== a);
    expect(verschieden).toBe(true);
  });
});

describe('Laufereignisse', () => {
  it('melden Beginn und Ende jeder Begegnung', () => {
    const l = lauf(3, 3);
    const ev = laufRunde(l);
    expect(ev.some((e) => 'e' in e && e.e === 'rundeStart')).toBe(true);
    laufDurchspielen(l);
    const starts = laufEv(l.protokoll).filter((e) => e.e === 'begegnungStart');
    expect(starts.length).toBeGreaterThanOrEqual(l.def.encounters.length);
  });
});

describe('Bosskampf hinter dem Tor (10.1, R3)', () => {
  it('startet erst auf Ansage und endet gewonnen', () => {
    const l = lauf(10);
    laufDurchspielen(l);
    expect(l.phase).toBe('tor');
    bossBeginnen(l);
    expect(l.phase).toBe('boss');
    expect(l.kampf.figuren.some((f) => f.art === 'boss')).toBe(true);
    expect(l.kampf.gegenBoss).toBe(true);
    expect(l.protokoll.some((e) => 'e' in e && e.e === 'bossStart')).toBe(true);
    laufDurchspielen(l);
    expect(l.phase).toBe('gewonnen');
  });

  it('die Party geht mit ihrem Zustand aus der Stage in den Bosskampf', () => {
    const l = lauf(10);
    laufDurchspielen(l);
    const held = l.helden[0]!;
    l.anteile.set(held.dbId, 40);
    bossBeginnen(l);
    const figur = l.kampf.figuren.find((f) => f.dbId === held.dbId)!;
    expect(figur.lp).toBeLessThan(figur.maxLp);
  });

  it('ein Wipe im Bosskampf setzt am Tor neu an, der Lauf bleibt offen', () => {
    const l = lauf(10, 1);
    laufDurchspielen(l);
    bossBeginnen(l);
    const vorher = l.wipes;
    const boss = l.kampf.figuren.find((f) => f.art === 'boss')!;
    boss.schadenJeAktion = 0;
    for (const f of l.kampf.figuren) {
      if (f.seite === 'held') {
        f.lp = 1;
        f.tot = true;
      }
    }
    laufRunde(l);
    expect(l.wipes).toBe(vorher + 1);
    expect(l.phase).toBe('boss');
    expect(l.kampf.figuren.filter((f) => f.seite === 'held' && !f.tot).length).toBeGreaterThan(0);
  });

  it('Aufgeben beendet auch den Bosskampf', () => {
    const l = lauf(10);
    laufDurchspielen(l);
    bossBeginnen(l);
    laufAufgeben(l);
    expect(l.phase).toBe('verloren');
  });
});
