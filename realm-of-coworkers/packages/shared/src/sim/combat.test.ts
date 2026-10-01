// Kampfformeln (5.6, 6.1, 6.6): Element, Krit, Mitigation, Schilde, Mindestschaden, Bedrohung.
import { describe, expect, it } from 'vitest';
import { heroMitigation } from '../formulas';
import { autocastOff, cast, muteAuto, testContent, testHero, trainingWorld } from '../testing';
import { addShield, foeHit, healUnit, heroHit } from './combat';
import { elementFactor, heroStats } from './effstats';
import { applyStatus } from './status';

const c = testContent();

describe('Elemente (6.1)', () => {
  it('×1,5 vom Gegenelement, ×0,5 vom eigenen, Physisch und neutrale Ziele 1,0', () => {
    const { w, dummies } = trainingWorld({ heroes: [], dummies: [{ x: 0, element: 'feuer' }, { x: 0 }] });
    expect(elementFactor(w, 'eis', dummies[0]!)).toBe(1.5);
    expect(elementFactor(w, 'feuer', dummies[0]!)).toBe(0.5);
    expect(elementFactor(w, 'blitz', dummies[0]!)).toBe(1);
    expect(elementFactor(w, 'physisch', dummies[0]!)).toBe(1);
    expect(elementFactor(w, 'eis', dummies[1]!)).toBe(1);
  });
});

describe('Schaden (5.6)', () => {
  it('Rüstung mindert Physisch, Resistenz mindert Elementar', () => {
    const setup = testHero(c, 'magier', { element: 'eis', noCrit: true });
    const { w, heroes, dummies } = trainingWorld({ heroes: [setup], dummies: [{ x: 300, armorMit: 0.5, resMit: 0.2 }] });
    const h = heroes[0]!;
    const k = heroStats(w, h).kra;
    expect(heroHit(w, h, dummies[0]!, { coef: 1, element: 'eis' })).toBe(Math.round(k * 0.8));
    expect(heroHit(w, h, dummies[0]!, { coef: 1, element: 'physisch' })).toBe(Math.round(k * 0.5));
  });

  it('Krit multipliziert mit Krit-Schaden ÷ 100, Krit-Chance höchstens 60 % (5.1)', () => {
    const setup = testHero(c, 'schurke');
    setup.sets.A.stats.krt = 1000;
    const { w, heroes, dummies } = trainingWorld({ heroes: [setup], dummies: [{ x: 60 }] });
    const st = heroStats(w, heroes[0]!);
    expect(st.krt).toBe(60);
    const seen = new Set<number>();
    let crits = 0;
    for (let i = 0; i < 1000; i++) {
      const d = heroHit(w, heroes[0]!, dummies[0]!, { coef: 1, element: 'physisch' });
      seen.add(d);
      if (d === Math.round(st.kra * 1.5)) crits++;
    }
    expect([...seen].sort()).toEqual([Math.round(st.kra), Math.round(st.kra * 1.5)].sort());
    expect(crits / 1000).toBeGreaterThan(0.55);
    expect(crits / 1000).toBeLessThan(0.65);
  });

  it('Helden-Mitigation mit Angreiferstufe, Mindestschaden 1, Unverwundbarkeit', () => {
    const { w, heroes } = trainingWorld({ heroes: ['krieger'] });
    const h = heroes[0]!;
    const st = heroStats(w, h);
    const m = heroMitigation(c.balance, st.rue, 30);
    expect(foeHit(w, null, h, { amount: 100, physical: true, element: 'physisch', attackerLevel: 30 })).toBe(Math.round(100 * (1 - m)));
    expect(foeHit(w, null, h, { amount: 0.01, physical: true, element: 'physisch', attackerLevel: 30 })).toBe(1);
    applyStatus(w, h, h, 'unverwundbar', { ms: 500 });
    expect(foeHit(w, null, h, { amount: 100, physical: true, element: 'physisch', attackerLevel: 30 })).toBe(0);
  });

  it('Schilde absorbieren vor Leben, das jüngste zuerst', () => {
    const { w, heroes } = trainingWorld({ heroes: ['krieger'] });
    const h = heroes[0]!;
    addShield(w, null, h, 50, 6000);
    w.t += 50;
    addShield(w, null, h, 30, 6000);
    const hp = h.hp;
    const st = heroStats(w, h);
    const raw = 40 / (1 - heroMitigation(c.balance, st.rue, 1));
    foeHit(w, null, h, { amount: raw, physical: true, element: 'physisch', attackerLevel: 1 });
    expect(h.hp).toBe(hp);
    expect(h.shields.map((s) => s.amount)).toEqual([40]);
  });

  it('Gift senkt erhaltene Heilung um 30 %', () => {
    const { w, heroes } = trainingWorld({ heroes: ['krieger'] });
    const h = heroes[0]!;
    h.hp = 10;
    applyStatus(w, null, h, 'gift');
    expect(healUnit(w, null, h, 100, {})).toBe(70);
  });
});

describe('Bedrohung (6.6)', () => {
  it('Schaden × Bedrohungsfaktor der Klasse, Heilung 0,5 × geheilte Menge', () => {
    const { w, heroes, dummies } = trainingWorld({ heroes: ['krieger', 'kleriker'], dummies: [{ x: 60 }] });
    const [kr, kl] = heroes;
    autocastOff(kr!);
    muteAuto(kr!);
    const d = heroHit(w, kr!, dummies[0]!, { coef: 1, element: 'physisch' });
    expect(dummies[0]!.foe!.threat.get(kr!.id)).toBe(d * 3);
    kr!.hp = Math.round(kr!.maxHp / 2);
    w.events = [];
    cast(w, kl!, 'kleriker_heilendes_licht', { targetId: kr!.id });
    const healed = w.events.find((e) => e.e === 'heal');
    expect(healed && healed.e === 'heal' ? dummies[0]!.foe!.threat.get(kl!.id) : 0).toBe(healed && healed.e === 'heal' ? healed.amount * 0.5 : -1);
  });
});
