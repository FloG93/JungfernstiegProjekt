// Abnahme M2: ein Test je Fähigkeit (Abschnitt 4, 15.5).
import { describe, expect, it } from 'vitest';
import {
  autocastOff, cast, collect, damageTo, hitsTo, muteAuto, testContent, testHero, trainingWorld,
} from '../testing';
import { doSwap } from './actions';
import { heroStats, moveMult } from './effstats';
import { killUnit } from './combat';
import { applyStatus } from './status';
import type { Unit, World } from './types';
import { addHero } from './heroes';

const c = testContent();
const kra = (w: World, h: Unit) => heroStats(w, h).kra;
const status = (u: Unit, id: string) => u.statuses.find((s) => s.id === id);

function setup(cls: Parameters<typeof trainingWorld>[0]['heroes'][number], dummies: Parameters<typeof trainingWorld>[0]['dummies']) {
  const r = trainingWorld({ heroes: [cls], dummies });
  const h = r.heroes[0]!;
  autocastOff(h);
  muteAuto(h);
  return { ...r, h };
}

describe('Krieger (4.5)', () => {
  it('Schwerthieb: 0,78 × Kraft', () => {
    const { w, h, dummies } = setup('krieger', [{ x: 60 }]);
    h.hero!.skills[0]!.cdLeft = 0;
    expect(cast(w, h, 'krieger_schwerthieb')).toBe(true);
    expect(damageTo(w.events, dummies[0]!.id)).toBe(Math.round(0.78 * kra(w, h)));
  });

  it('Spott: Gegner im Radius 300 greifen 4 s den Krieger an, 0,30 × Kraft, 30 % weniger Schaden', () => {
    const { w, h, dummies } = setup('krieger', [{ x: 100 }, { x: 250 }, { x: 400 }]);
    cast(w, h, 'krieger_spott');
    expect(dummies[0]!.foe!.tauntById).toBe(h.id);
    expect(dummies[1]!.foe!.tauntUntil).toBe(w.t + 4000);
    expect(dummies[2]!.foe!.tauntById).toBeNull();
    expect(damageTo(w.events, dummies[1]!.id)).toBe(Math.round(0.3 * kra(w, h)));
    expect(damageTo(w.events, dummies[2]!.id)).toBe(0);
    expect(status(h, 'spott_schutz')?.mods?.[0]).toEqual({ stat: 'dmgTaken', mult: 0.7 });
  });

  it('Schildstoß: 1,60 × Kraft und Betäubung 1,5 s, Elite 0,75 s, Boss −20 % Angriffstempo', () => {
    const { w, h, dummies } = setup('krieger', [{ x: 60 }, { x: 60, elite: true }, { x: 60, kind: 'boss' }]);
    h.hero!.level = 2;
    cast(w, h, 'krieger_schildstoss', { targetId: dummies[0]!.id });
    expect(damageTo(w.events, dummies[0]!.id)).toBe(Math.round(1.6 * kra(w, h)));
    expect(status(dummies[0]!, 'betaeubung')!.endsAt - w.t).toBe(1500);
    h.hero!.skills[2]!.cdLeft = 0;
    cast(w, h, 'krieger_schildstoss', { targetId: dummies[1]!.id });
    expect(status(dummies[1]!, 'betaeubung')!.endsAt - w.t).toBe(750);
    h.hero!.skills[2]!.cdLeft = 0;
    cast(w, h, 'krieger_schildstoss', { targetId: dummies[2]!.id });
    expect(status(dummies[2]!, 'betaeubung')).toBeUndefined();
    expect(status(dummies[2]!, 'angriffstempo_malus')?.value).toBe(20);
  });

  it('Wirbelhieb: 1,20 × Kraft auf alle Gegner im Radius 120', () => {
    const { w, h, dummies } = setup('krieger', [{ x: 50 }, { x: 110 }, { x: 200 }]);
    cast(w, h, 'krieger_wirbelhieb');
    const d = Math.round(1.2 * kra(w, h));
    expect([0, 1, 2].map((i) => damageTo(w.events, dummies[i]!.id))).toEqual([d, d, 0]);
  });

  it('Bollwerk: Schild 15 % des Krieger-Lebens für alle, Krieger erleidet 40 % weniger', () => {
    const { w, heroes } = trainingWorld({ heroes: ['krieger', 'magier'] });
    const [kr, mg] = heroes as [Unit, Unit];
    kr.hero!.level = 5;
    cast(w, kr, 'krieger_bollwerk');
    const s = Math.round(kr.maxHp * 0.15);
    expect(kr.shields[0]!.amount).toBe(s);
    expect(mg.shields[0]!.amount).toBe(s);
    expect(mg.shields[0]!.endsAt - w.t).toBe(6000);
    expect(status(kr, 'bollwerk')?.mods?.[0]).toEqual({ stat: 'dmgTaken', mult: 0.6 });
  });

  it('Standhaft: +15 % Rüstung (Passiv)', () => {
    const { w, h } = setup('krieger', []);
    const plain = testHero(c, 'krieger', { level: 10 }).sets.A.stats.rue;
    expect(heroStats(w, h).rue).toBeCloseTo(plain);
    expect(c.classById.krieger.threat).toBe(3);
  });
});

describe('Magier (4.6)', () => {
  it('Arkanblitz: 0,75 × Kraft', () => {
    const { w, h, dummies } = setup('magier', [{ x: 300 }]);
    h.hero!.skills[0]!.cdLeft = 0;
    cast(w, h, 'magier_arkanblitz');
    expect(damageTo(w.events, dummies[0]!.id)).toBe(Math.round(0.75 * kra(w, h)));
  });

  it('Elementarkugel: 2,40 × Kraft, 60 % davon im Radius 100', () => {
    const { w, h, dummies } = setup('magier', [{ x: 300 }, { x: 380 }, { x: 450 }]);
    cast(w, h, 'magier_elementarkugel', { targetId: dummies[0]!.id });
    expect(damageTo(w.events, dummies[0]!.id)).toBe(Math.round(2.4 * kra(w, h)));
    expect(damageTo(w.events, dummies[1]!.id)).toBe(Math.round(2.4 * 0.6 * kra(w, h)));
    expect(damageTo(w.events, dummies[2]!.id)).toBe(0);
  });

  it('Elementarnova: 2,60 × Kraft auf Ziel und alle im Radius 220 um das Ziel', () => {
    const { w, h, dummies } = setup('magier', [{ x: 300 }, { x: 500 }, { x: 560 }]);
    h.hero!.level = 2;
    cast(w, h, 'magier_elementarnova', { targetId: dummies[0]!.id });
    const d = Math.round(2.6 * kra(w, h));
    expect([0, 1, 2].map((i) => damageTo(w.events, dummies[i]!.id))).toEqual([d, d, 0]);
  });

  it('Arkane Barriere: Schild 20 % des eigenen Lebens für 6 s', () => {
    const { w, h } = setup('magier', []);
    h.hero!.level = 3;
    cast(w, h, 'magier_arkane_barriere');
    expect(h.shields[0]!.amount).toBe(Math.round(h.maxHp * 0.2));
    expect(h.shields[0]!.endsAt - w.t).toBe(6000);
  });

  it('Kataklysmus: nach 1,0 s 12,0 × Kraft auf alle Gegner im Radius 300', () => {
    const { w, h, dummies } = setup('magier', [{ x: 400 }, { x: 650 }, { x: 900 }]);
    h.hero!.level = 5;
    cast(w, h, 'magier_kataklysmus', { targetId: dummies[0]!.id });
    expect(damageTo(collect(w, 950), dummies[0]!.id)).toBe(0);
    const ev = collect(w, 100);
    const d = Math.round(12 * kra(w, h));
    expect([0, 1, 2].map((i) => damageTo(ev, dummies[i]!.id))).toEqual([d, d, 0]);
  });

  it('Elementarfluss: Waffenwechsel setzt Elementarkugel zurück, höchstens alle 20 s', () => {
    const r = trainingWorld({ heroes: [testHero(c, 'magier', { elementB: 'eis', noCrit: true })], dummies: [{ x: 300 }] });
    const h = r.heroes[0]!;
    autocastOff(h);
    cast(r.w, h, 'magier_elementarkugel');
    expect(h.hero!.skills[1]!.cdLeft).toBe(6000);
    expect(doSwap(r.w, h)).toBe(true);
    expect(h.hero!.skills[1]!.cdLeft).toBe(0);
    expect(h.element).toBe('eis');
    expect(cast(r.w, h, 'magier_elementarkugel')).toBe(false); // 0,5 s Wechsel ohne Angriff (8.6)
    collect(r.w, 500);
    expect(cast(r.w, h, 'magier_elementarkugel')).toBe(true);
    collect(r.w, 4500);
    expect(doSwap(r.w, h)).toBe(true);
    expect(h.hero!.skills[1]!.cdLeft).toBeGreaterThan(0);
  });
});

describe('Waldläufer (4.7)', () => {
  it('Pfeilschuss: 0,70 × Kraft', () => {
    const { w, h, dummies } = setup('waldlaeufer', [{ x: 400 }]);
    h.hero!.skills[0]!.cdLeft = 0;
    cast(w, h, 'waldlaeufer_pfeilschuss');
    expect(damageTo(w.events, dummies[0]!.id)).toBe(Math.round(0.7 * kra(w, h)));
  });

  it('Gezielter Schuss: 2,60 × Kraft, durchbohrt den ersten Gegner dahinter mit 50 %', () => {
    const { w, h, dummies } = setup('waldlaeufer', [{ x: 200, y: 120 }, { x: 450, y: 125 }, { x: 300, y: 200 }]);
    cast(w, h, 'waldlaeufer_gezielter_schuss', { targetId: dummies[0]!.id });
    expect(damageTo(w.events, dummies[0]!.id)).toBe(Math.round(2.6 * kra(w, h)));
    expect(damageTo(w.events, dummies[1]!.id)).toBe(Math.round(1.3 * kra(w, h)));
    expect(damageTo(w.events, dummies[2]!.id)).toBe(0);
  });

  it('Fallensteller: 1,60 × Kraft und Wurzel 2 s, Boss −30 % Bewegung', () => {
    const { w, h, dummies } = setup('waldlaeufer', [{ x: 300 }, { x: 310, kind: 'boss' }]);
    h.hero!.level = 2;
    cast(w, h, 'waldlaeufer_fallensteller', { targetId: dummies[0]!.id });
    const ev = collect(w, 100);
    expect(damageTo(ev, dummies[0]!.id)).toBe(Math.round(1.6 * kra(w, h)));
    expect(status(dummies[0]!, 'wurzel')).toBeDefined();
    expect(status(dummies[1]!, 'bewegung_malus')?.value).toBe(30);
  });

  it('Pfeilhagel: 5 Pfeile à 0,70 × Kraft in 1,5 s, ein Gegner kann alle 5 abbekommen', () => {
    const { w, h, dummies } = setup('waldlaeufer', [{ x: 400 }]);
    h.hero!.level = 3;
    cast(w, h, 'waldlaeufer_pfeilhagel', { targetId: dummies[0]!.id });
    const hits = hitsTo(collect(w, 1500), dummies[0]!.id);
    expect(hits).toEqual(Array(5).fill(Math.round(0.7 * kra(w, h))));
  });

  it('Adlerauge: 10 s lang +30 % Schaden und +100 px Reichweite', () => {
    const { w, h, dummies } = setup('waldlaeufer', [{ x: 620 }]);
    h.hero!.level = 5;
    cast(w, h, 'waldlaeufer_adlerauge');
    expect(status(h, 'adlerauge')!.endsAt - w.t).toBe(10000);
    h.hero!.skills[0]!.cdLeft = 0;
    expect(cast(w, h, 'waldlaeufer_pfeilschuss')).toBe(true);
    expect(damageTo(w.events, dummies[0]!.id)).toBe(Math.round(0.7 * 1.3 * kra(w, h)));
  });

  it('Fährtenleser: +10 % Bewegung, Ausweichrolle 7 s', () => {
    const { w, h } = setup('waldlaeufer', []);
    expect(moveMult(w, h)).toBeCloseTo(1.1);
    expect(h.hero!.rollCooldownS).toBe(7);
  });
});

describe('Schurke (4.8)', () => {
  it('Doppelstich: 0,65 × Kraft', () => {
    const { w, h, dummies } = setup('schurke', [{ x: 60 }]);
    h.hero!.skills[0]!.cdLeft = 0;
    cast(w, h, 'schurke_doppelstich');
    expect(damageTo(w.events, dummies[0]!.id)).toBe(Math.round(0.65 * kra(w, h)));
  });

  it('Meucheln: 2,80 × Kraft, ×1,5 gegen vergiftete Ziele', () => {
    const { w, h, dummies } = setup('schurke', [{ x: 60 }]);
    cast(w, h, 'schurke_meucheln');
    expect(damageTo(w.events, dummies[0]!.id)).toBe(Math.round(2.8 * kra(w, h)));
    applyStatus(w, h, dummies[0]!, 'gift', { ms: 6000 });
    h.hero!.skills[1]!.cdLeft = 0;
    w.events = [];
    cast(w, h, 'schurke_meucheln');
    expect(damageTo(w.events, dummies[0]!.id)).toBe(Math.round(2.8 * 1.5 * kra(w, h)));
  });

  it('Giftklinge: Gift 6 s, 0,35 × Kraft pro Sekunde, Ziel wird 30 % weniger geheilt', () => {
    const { w, h, dummies } = setup('schurke', [{ x: 60 }]);
    h.hero!.level = 2;
    cast(w, h, 'schurke_giftklinge');
    const g = status(dummies[0]!, 'gift')!;
    expect(g.endsAt - w.t).toBe(6000);
    const hits = hitsTo(collect(w, 6000), dummies[0]!.id);
    expect(hits).toEqual(Array(6).fill(Math.round(0.35 * kra(w, h))));
    expect(c.statusById.gift.params['healingReceivedMalusPct']).toBe(30);
  });

  it('Schattenschritt: Teleport hinter das Ziel, 1,00 × Kraft, nächster Treffer +25 %', () => {
    const { w, h, dummies } = setup('schurke', [{ x: 80 }]);
    h.hero!.level = 3;
    cast(w, h, 'schurke_schattenschritt');
    expect(h.x).toBeGreaterThan(dummies[0]!.x);
    expect(damageTo(w.events, dummies[0]!.id)).toBe(Math.round(1.0 * kra(w, h)));
    expect(status(h, 'tarnung')).toBeDefined();
    w.events = [];
    cast(w, h, 'schurke_meucheln');
    expect(damageTo(w.events, dummies[0]!.id)).toBe(Math.round(2.8 * 1.25 * kra(w, h)));
    expect(status(h, 'tarnung')).toBeUndefined();
  });

  it('Klingentanz: 6 Treffer à 0,90 × Kraft in 1,5 s, Radius 90, unverwundbar', () => {
    const { w, h, dummies } = setup('schurke', [{ x: 60 }, { x: 0, y: 200 }, { x: 200 }]);
    h.hero!.level = 5;
    cast(w, h, 'schurke_klingentanz');
    expect(status(h, 'unverwundbar')).toBeDefined();
    const ev = collect(w, 1500);
    const d = Math.round(0.9 * kra(w, h));
    expect(hitsTo(ev, dummies[0]!.id)).toEqual(Array(6).fill(d));
    expect(hitsTo(ev, dummies[1]!.id)).toEqual(Array(6).fill(d));
    expect(damageTo(ev, dummies[2]!.id)).toBe(0);
    expect(damageTo(ev, h.id)).toBe(0);
  });

  it('Blutdurst: +10 Prozentpunkte Krit-Chance (Passiv)', () => {
    const { w, heroes } = trainingWorld({ heroes: ['schurke'], noCrit: false });
    expect(heroStats(w, heroes[0]!).krt).toBe(15);
  });
});

describe('Kleriker (4.9)', () => {
  it('Heiliger Schlag: 0,60 × Kraft', () => {
    const { w, h, dummies } = setup('kleriker', [{ x: 200 }]);
    h.hero!.skills[0]!.cdLeft = 0;
    cast(w, h, 'kleriker_heiliger_schlag');
    expect(damageTo(w.events, dummies[0]!.id)).toBe(Math.round(0.6 * kra(w, h)));
  });

  it('Heilendes Licht: heilt den Verbündeten mit dem niedrigsten Lebensanteil um 2,00 × Kraft', () => {
    const { w, heroes } = trainingWorld({ heroes: ['kleriker', 'krieger', 'magier'] });
    const [kl, kr, mg] = heroes as [Unit, Unit, Unit];
    kr.hp = Math.round(kr.maxHp * 0.5);
    mg.hp = Math.round(mg.maxHp * 0.3);
    const before = mg.hp;
    cast(w, kl, 'kleriker_heilendes_licht');
    expect(mg.hp - before).toBe(Math.round(2 * kra(w, kl)));
  });

  it('Segensaura: Regeneration 8 s für die 3 schwächsten, 0,25 × Kraft pro Sekunde', () => {
    const { w, heroes } = trainingWorld({ heroes: ['kleriker', 'krieger', 'magier', 'schurke'] });
    for (const u of heroes) u.hp = Math.round(u.maxHp * 0.5);
    heroes[0]!.hp = heroes[0]!.maxHp;
    heroes[0]!.hero!.level = 2;
    autocastOff(heroes[0]!);
    cast(w, heroes[0]!, 'kleriker_segensaura');
    expect(heroes.filter((u) => status(u, 'regeneration')).map((u) => u.hero!.classId)).toEqual(['krieger', 'magier', 'schurke']);
    const before = heroes[1]!.hp;
    collect(w, 8000);
    expect(heroes[1]!.hp - before).toBe(8 * Math.round(0.25 * kra(w, heroes[0]!)));
  });

  it('Läuterung: entfernt je Verbündetem 1 Debuff, heilt alle um 1,20 × Kraft, 0,80 × Kraft im Radius 300', () => {
    const r = trainingWorld({ heroes: ['kleriker', 'krieger'], dummies: [{ x: 200 }, { x: 600 }] });
    const [kl, kr] = r.heroes as [Unit, Unit];
    autocastOff(kl);
    kl.hero!.level = 3;
    applyStatus(r.w, null, kr, 'frost', { ms: 5000 });
    applyStatus(r.w, null, kr, 'betaeubung', { ms: 1000 });
    kr.hp = Math.round(kr.maxHp / 2);
    const before = kr.hp;
    cast(r.w, kl, 'kleriker_laeuterung');
    expect(kr.statuses.map((s) => s.id)).toEqual(['frost']);
    expect(kr.hp - before).toBe(Math.round(1.2 * kra(r.w, kl)));
    expect(damageTo(r.w.events, r.dummies[0]!.id)).toBe(Math.round(0.8 * kra(r.w, kl)));
    expect(damageTo(r.w.events, r.dummies[1]!.id)).toBe(0);
  });

  it('Wunder: heilt alle um 60 % Max-Leben und belebt Gefallene mit 30 %', () => {
    const { w, heroes } = trainingWorld({ heroes: ['kleriker', 'krieger', 'magier'] });
    const [kl, kr, mg] = heroes as [Unit, Unit, Unit];
    kl.hero!.level = 5;
    kr.hp = 1;
    killUnit(w, mg, null);
    cast(w, kl, 'kleriker_wunder');
    expect(kr.hp).toBe(1 + Math.round(kr.maxHp * 0.6));
    expect(mg.dead).toBe(false);
    expect(mg.hp).toBe(Math.round(mg.maxHp * 0.3));
  });

  it('Gnade: Überheilung wird zum Schild, höchstens 10 % Max-Leben, 6 s', () => {
    const { w, heroes } = trainingWorld({ heroes: ['kleriker', 'magier'] });
    const [kl, mg] = heroes as [Unit, Unit];
    mg.hp = mg.maxHp - 5;
    cast(w, kl, 'kleriker_heilendes_licht', { targetId: mg.id });
    const sh = mg.shields.find((s) => s.tag === 'gnade')!;
    expect(sh.amount).toBe(Math.min(Math.round(mg.maxHp * 0.1), Math.round(2 * kra(w, kl)) - 5));
    expect(sh.endsAt - w.t).toBe(6000);
  });
});

describe('Runenweber (4.10)', () => {
  it('Runenstrahl: 0,73 × Kraft', () => {
    const { w, h, dummies } = setup('runenweber', [{ x: 300 }]);
    h.hero!.skills[0]!.cdLeft = 0;
    cast(w, h, 'runenweber_runenstrahl');
    expect(damageTo(w.events, dummies[0]!.id)).toBe(Math.round(0.73 * kra(w, h)));
  });

  it('Rune der Kraft: 8 s lang alle Verbündeten +15 % Kraft (auch der Runenweber)', () => {
    const { w, heroes } = trainingWorld({ heroes: ['runenweber', 'krieger'] });
    const before = heroes.map((u) => heroStats(w, u).kra);
    cast(w, heroes[0]!, 'runenweber_rune_der_kraft');
    heroes.forEach((u, i) => expect(heroStats(w, u).kra).toBeCloseTo(before[i]! * 1.15));
    expect(status(heroes[1]!, 'kraftrune')!.endsAt - w.t).toBe(8000);
  });

  it('Runenbruch: Ziel ignoriert Elementarresistenz und erleidet +10 %, dazu 1,00 × Kraft', () => {
    const r = trainingWorld({ heroes: [testHero(c, 'runenweber', { element: 'feuer', noCrit: true })], dummies: [{ x: 300, element: 'feuer' }] });
    const h = r.heroes[0]!;
    autocastOff(h);
    muteAuto(h);
    h.hero!.level = 2;
    cast(r.w, h, 'runenweber_runenbruch');
    // Reihenfolge der Effekte (E-017): erst der Status, dann der Schaden, also schon ohne Resistenz und mit +10 %
    expect(damageTo(r.w.events, r.dummies[0]!.id)).toBe(Math.round(1.0 * kra(r.w, h) * 1.1));
    h.hero!.skills[0]!.cdLeft = 0;
    r.w.events = [];
    cast(r.w, h, 'runenweber_runenstrahl');
    expect(damageTo(r.w.events, r.dummies[0]!.id)).toBe(Math.round(0.73 * kra(r.w, h) * 1.0 * 1.1));
  });

  it('Rune des Schutzes: 8 s lang +20 % Rüstung und Resistenz für alle', () => {
    const { w, heroes } = trainingWorld({ heroes: ['runenweber', 'magier'] });
    const before = heroStats(w, heroes[1]!);
    heroes[0]!.hero!.level = 3;
    cast(w, heroes[0]!, 'runenweber_rune_des_schutzes');
    const after = heroStats(w, heroes[1]!);
    expect(after.rue).toBeCloseTo(before.rue * 1.2);
    expect(after.res).toBeCloseTo(before.res * 1.2);
  });

  it('Runensturm: 12 s lang +25 Tempo und +20 Prozentpunkte Krit für alle', () => {
    const { w, heroes } = trainingWorld({ heroes: ['runenweber', 'magier'], noCrit: false });
    heroes[0]!.hero!.level = 5;
    const before = heroStats(w, heroes[1]!);
    cast(w, heroes[0]!, 'runenweber_runensturm');
    const after = heroStats(w, heroes[1]!);
    expect(after.tmp - before.tmp).toBeCloseTo(25);
    expect(after.krt - before.krt).toBeCloseTo(20);
    expect(status(heroes[1]!, 'runensturm')!.endsAt - w.t).toBe(12000);
  });

  it('Resonanz: Verbündete unter einem Buff erleiden 5 % weniger Schaden', async () => {
    const { w, heroes } = trainingWorld({ heroes: ['runenweber', 'krieger'] });
    const { dmgTakenMult } = await import('./effstats');
    expect(dmgTakenMult(w, heroes[1]!)).toBe(1);
    cast(w, heroes[0]!, 'runenweber_rune_der_kraft');
    expect(dmgTakenMult(w, heroes[1]!)).toBeCloseTo(0.95);
  });
});

describe('Freischaltung (4.3)', () => {
  it('Fähigkeit 2 ab Stufe 2, Fähigkeit 3 ab Stufe 3, Ultimate ab Stufe 5', () => {
    const r = trainingWorld({ heroes: [testHero(c, 'magier', { level: 1, noCrit: true })], dummies: [{ x: 300 }] });
    const h = r.heroes[0]!;
    expect(cast(r.w, h, 'magier_elementarkugel')).toBe(true);
    expect(cast(r.w, h, 'magier_elementarnova')).toBe(false);
    expect(cast(r.w, h, 'magier_arkane_barriere')).toBe(false);
    expect(cast(r.w, h, 'magier_kataklysmus')).toBe(false);
    void addHero;
  });
});
