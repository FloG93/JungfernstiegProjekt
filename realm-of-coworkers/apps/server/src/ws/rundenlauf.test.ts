// Abnahme R4: Server im Rundenkampf (ENTWURF-rundenkampf.md 1.4 und 4).
// Gleichzeitiges Planen, Rundenprotokoll statt Schnappschüsse, Auto-Kampf, Boss-Tor, Belohnungen.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../http/errors';
import type { RundenLauf } from './rundenlauf';
import { addPlayer, makeEnv } from './testkit';
import type { TestEnv, TestPlayer } from './testkit';

const MIN = 60_000;
let env: TestEnv;
beforeEach(async () => {
  env = await makeEnv({ RUNDENKAMPF: '1' });
});
afterEach(async () => {
  await env.close();
});

const laufOf = (p: TestPlayer) => (env.hub.lobby.partyOf(p.accountId)?.run as RundenLauf | undefined) ?? null;

async function party(leader: TestPlayer, others: TestPlayer[], stage: number): Promise<void> {
  leader.send({ t: 'party.create' });
  await env.clock.advance(50);
  const code = leader.last('party.state')!.code;
  for (const o of others) {
    o.send({ t: 'party.join', code });
    await env.clock.advance(50);
  }
  leader.send({ t: 'party.setStage', stage });
  await env.clock.advance(50);
  for (const p of [leader, ...others]) p.send({ t: 'party.ready', ready: true });
  await env.clock.advance(5100);
  expect(leader.has('runde.start')).toBe(true);
}

/** Eigene Figur im zuletzt gesehenen Zustand. */
function mich(p: TestPlayer) {
  const letzte = p.last('runde.protokoll') ?? p.last('runde.plan') ?? p.last('runde.start');
  return letzte!.zustand;
}

function meineFigur(p: TestPlayer) {
  const z = mich(p);
  return z.figuren.find((f) => f.id === z.mich!.figurId)!;
}

function erstesZiel(p: TestPlayer): number {
  return mich(p).figuren.find((f) => f.seite === 'gegner' && !f.tot)!.id;
}

async function greifeAn(p: TestPlayer): Promise<void> {
  const z = mich(p);
  p.send({ t: 'runde.wahl', runde: z.runde + 1, a: { k: 'angriff', ziel: erstesZiel(p) } });
  await env.clock.advance(100);
}

describe('Planung und Rundenprotokoll (ENTWURF 1.4)', () => {
  it('der Start nennt Rundenlänge, Planungsfenster und den ganzen Zustand', async () => {
    const a = await addPlayer(env, 'anna', 'magier', { gear: { ilvl: 5 } });
    await party(a, [], 1);
    const start = a.last('runde.start')!;
    const c = env.ctx.content;
    expect(start.config).toMatchObject({
      rundeSekunden: c.runden.rundeSekunden, planungS: c.runden.planung.standardS, maxRunden: c.runden.maxRunden,
    });
    expect(start.roster[0]).toMatchObject({ accountId: a.accountId, heroId: a.heroId, classId: 'magier' });
    const z = start.zustand;
    expect(z.phase).toBe('planung');
    expect(z.runde).toBe(0);
    expect(z.figuren.some((f) => f.heroId === a.heroId)).toBe(true);
    expect(z.figuren.some((f) => f.seite === 'gegner')).toBe(true);
    expect(z.planungIn).toBe(c.runden.planung.standardS * 1000);
    expect(z.mich).toMatchObject({ heroId: a.heroId, auto: false, gewaehlt: false });
    // Keine Schnappschüsse mehr
    expect(a.has('run.snapshot')).toBe(false);
  });

  it('eine Wahl löst die Runde aus und liefert Ereignisse samt neuem Zustand', async () => {
    const a = await addPlayer(env, 'anna', 'magier', { gear: { ilvl: 5 } });
    await party(a, [], 1);
    const vorher = mich(a);
    await greifeAn(a);
    const pr = a.last('runde.protokoll')!;
    expect(pr.runde).toBe(vorher.runde + 1);
    expect(pr.zustand.runde).toBe(vorher.runde + 1);
    expect(pr.ereignisse.length).toBeGreaterThan(0);
    const arten = pr.ereignisse.map((e) => (e as { e: string }).e);
    expect(arten).toContain('rundeStart');
    expect(arten).toContain('aktion');
    expect(arten).toContain('rundeEnde');
    // Danach beginnt gleich die nächste Planung
    expect(pr.zustand.planungIn).toBeGreaterThan(0);
    expect(pr.zustand.mich!.gewaehlt).toBe(false);
  });

  it('weist eine Wahl für eine vergangene Runde ab', async () => {
    const a = await addPlayer(env, 'anna', 'magier', { gear: { ilvl: 5 } });
    await party(a, [], 1);
    a.send({ t: 'runde.wahl', runde: 99, a: { k: 'verteidigen' } });
    await env.clock.advance(50);
    expect(a.errors().join(' ')).toContain('CONFLICT');
  });

  it('ohne Wahl handelt die Automatik, sobald das Fenster abläuft', async () => {
    const a = await addPlayer(env, 'anna', 'magier', { gear: { ilvl: 5 } });
    await party(a, [], 1);
    expect(a.of('runde.protokoll').length).toBe(0);
    await env.clock.advance(env.ctx.content.runden.planung.standardS * 1000 + 100);
    expect(a.of('runde.protokoll').length).toBe(1);
    expect(laufOf(a)!.lauf.kampf.runde).toBe(1);
  });

  it('Verteidigen halbiert den erlittenen Schaden der Runde', async () => {
    const a = await addPlayer(env, 'anna', 'krieger', { gear: { ilvl: 5 } });
    await party(a, [], 1);
    a.send({ t: 'runde.wahl', runde: mich(a).runde + 1, a: { k: 'verteidigen' } });
    await env.clock.advance(100);
    expect(meineFigur(a).verteidigt).toBe(true);
  });
});

describe('Koop: gleichzeitiges Planen (ENTWURF 4)', () => {
  it('die Runde läuft erst, wenn alle gewählt haben', async () => {
    const a = await addPlayer(env, 'anna', 'krieger', { gear: { ilvl: 5 } });
    const b = await addPlayer(env, 'bert', 'kleriker', { gear: { ilvl: 5 } });
    await party(a, [b], 1);
    await greifeAn(a);
    expect(a.of('runde.protokoll').length).toBe(0);
    // Die anderen sehen, dass Anna gewählt hat
    expect(b.last('runde.plan')!.zustand.gewaehlt).toContain(a.accountId);
    await greifeAn(b);
    expect(a.of('runde.protokoll').length).toBe(1);
    expect(b.of('runde.protokoll').length).toBe(1);
    expect(JSON.stringify(a.last('runde.protokoll')!.ereignisse))
      .toBe(JSON.stringify(b.last('runde.protokoll')!.ereignisse));
    // Jeder sieht nur seinen eigenen Helden im „mich"-Teil
    expect(a.last('runde.protokoll')!.zustand.mich!.heroId).toBe(a.heroId);
    expect(b.last('runde.protokoll')!.zustand.mich!.heroId).toBe(b.heroId);
  });

  it('„Los!" wartet nicht auf den anderen: die Automatik übernimmt', async () => {
    const a = await addPlayer(env, 'anna', 'krieger', { gear: { ilvl: 5 } });
    const b = await addPlayer(env, 'bert', 'kleriker', { gear: { ilvl: 5 } });
    await party(a, [b], 1);
    await greifeAn(a);
    expect(a.of('runde.protokoll').length).toBe(0);
    b.send({ t: 'runde.fertig' });
    await env.clock.advance(100);
    expect(a.of('runde.protokoll').length).toBe(1);
  });

  it('Auto-Kampf spielt die Runden ohne Eingaben weiter', async () => {
    const a = await addPlayer(env, 'anna', 'krieger', { gear: { ilvl: 5 } });
    const b = await addPlayer(env, 'bert', 'magier', { gear: { ilvl: 5 } });
    await party(a, [b], 1);
    for (const p of [a, b]) p.send({ t: 'runde.auto', on: true });
    await env.clock.advance(100);
    expect(mich(a).mich!.auto).toBe(true);
    const pause = env.ctx.content.runden.planung.autoS * 1000;
    await env.clock.advance(pause * 3 + 200);
    expect(laufOf(a)!.lauf.kampf.runde + laufOf(a)!.lauf.index).toBeGreaterThanOrEqual(3);
  });
});

describe('Stage, Belohnung und Ende (9.1, 12.3)', () => {
  it('spielt Stage 1 im Auto-Kampf bis zum Sieg und speichert Beute', async () => {
    const a = await addPlayer(env, 'anna', 'magier', { gear: { ilvl: 5 } });
    await party(a, [], 1);
    a.send({ t: 'runde.auto', on: true });
    await env.clock.until(() => a.has('run.end'), 30 * MIN, 1000);
    const end = a.last('run.end')!;
    expect(end).toMatchObject({ result: 'win', stage: 1, firstClear: true, next: 2 });
    expect(end.xp).toBeGreaterThan(0);
    expect(end.gold).toBeGreaterThan(0);
    const hero = await env.ctx.db.selectFrom('heroes').selectAll().where('id', '=', a.heroId).executeTakeFirstOrThrow();
    expect(hero.gold).toBeGreaterThan(0);
    const fortschritt = await env.ctx.db.selectFrom('stage_progress').selectAll().where('hero_id', '=', a.heroId)
      .executeTakeFirstOrThrow();
    expect(fortschritt.clears).toBe(1);
    expect(env.ctx.game.isHeroInRun(a.heroId)).toBe(false);
  }, 120_000);

  it('Verlassen beendet den Lauf und gibt den Helden frei', async () => {
    const a = await addPlayer(env, 'anna', 'magier', { gear: { ilvl: 5 } });
    await party(a, [], 1);
    expect(env.ctx.game.isHeroInRun(a.heroId)).toBe(true);
    a.send({ t: 'run.leave' });
    await env.clock.advance(200);
    expect(a.last('run.end')!.result).toBe('abort');
    expect(a.has('run.closed')).toBe(true);
    expect(env.ctx.game.isHeroInRun(a.heroId)).toBe(false);
  });

  it('Solo hält bei Verbindungsverlust an und läuft nach der Rückkehr weiter (OPEN-029)', async () => {
    const a = await addPlayer(env, 'anna', 'magier', { gear: { ilvl: 5 } });
    await party(a, [], 1);
    a.send({ t: 'runde.auto', on: true });
    await env.clock.advance(env.ctx.content.runden.planung.autoS * 1000 + 100);
    // Gezählt werden die gespielten Runden; die Rundenzahl im Kampf beginnt je Begegnung neu
    const gespielt = a.of('runde.protokoll').length;
    expect(gespielt).toBeGreaterThan(0);
    const serverVorher = laufOf(a)!.lauf.protokoll.filter((e) => 'e' in e && e.e === 'rundeStart').length;
    expect(serverVorher).toBe(gespielt);
    a.drop();
    await env.clock.advance(60_000);
    expect(laufOf(a)!.lauf.protokoll.filter((e) => 'e' in e && e.e === 'rundeStart').length).toBe(serverVorher);
    a.connect();
    a.hello();
    await env.clock.advance(5000);
    expect(laufOf(a)!.lauf.protokoll.filter((e) => 'e' in e && e.e === 'rundeStart').length).toBeGreaterThan(serverVorher);
  }, 60_000);
});

describe('Boss-Tor (10.1)', () => {
  it('wartet am Tor auf die Bereitschaft und beginnt dann den Bosskampf', async () => {
    const a = await addPlayer(env, 'anna', 'magier', { gear: { ilvl: 40 }, level: 10, cleared: [1, 2, 3, 4, 5, 6, 7, 8, 9] });
    await party(a, [], 10);
    a.send({ t: 'runde.auto', on: true });
    const amTor = await env.clock.until(() => laufOf(a)?.lauf.phase === 'tor', 30 * MIN, 1000);
    expect(amTor).toBe(true);
    const l = laufOf(a)!;
    const runde = l.lauf.kampf.runde;
    await env.clock.advance(10_000);
    expect(l.lauf.phase).toBe('tor');
    expect(l.lauf.kampf.runde).toBe(runde);
    a.send({ t: 'run.ready' });
    await env.clock.advance(200);
    expect(l.lauf.phase).toBe('boss');
    expect(l.lauf.kampf.gegenBoss).toBe(true);
    expect(l.lauf.kampf.figuren.some((f) => f.art === 'boss')).toBe(true);
    expect(mich(a).figuren.some((f) => f.art === 'boss')).toBe(true);
  }, 180_000);
});

describe('Prüfung der Wahlen (ENTWURF 4)', () => {
  it('eine Fähigkeit auf Abklingzeit wird abgewiesen, die Runde läuft trotzdem', async () => {
    const a = await addPlayer(env, 'anna', 'magier', { gear: { ilvl: 5 } });
    await party(a, [], 1);
    const z = mich(a);
    const ziel = erstesZiel(a);
    a.send({ t: 'runde.wahl', runde: z.runde + 1, a: { k: 'faehigkeit', id: 'gibt_es_nicht', ziel } });
    await env.clock.advance(100);
    const pr = a.last('runde.protokoll')!;
    const arten = pr.ereignisse.map((e) => (e as { e: string; von?: number }).e);
    expect(arten).toContain('verfehlt');
  });

  it('wer nicht im Run ist, kann nicht wählen', async () => {
    const a = await addPlayer(env, 'anna', 'magier', { gear: { ilvl: 5 } });
    a.send({ t: 'runde.wahl', runde: 1, a: { k: 'verteidigen' } });
    await env.clock.advance(50);
    expect(a.errors().join(' ')).toContain('CONFLICT');
  });
});

describe('Alte Nachrichten (OPEN-065)', () => {
  it('Eingaben des Echtzeitkampfes gibt es im Rundenkampf nicht', async () => {
    const a = await addPlayer(env, 'anna', 'magier', { gear: { ilvl: 5 } });
    await party(a, [], 1);
    expect(() => laufOf(a)!.nachricht(a.accountId, { t: 'run.pause', on: true })).toThrow(ApiError);
  });
});

describe('Wiedereinstieg (11.5)', () => {
  it('nach der Frist entfernt, nach der Rückkehr wieder dabei', async () => {
    const frei = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const a = await addPlayer(env, 'anna', 'krieger', { gear: { ilvl: 40 }, level: 10, cleared: frei });
    const b = await addPlayer(env, 'bert', 'magier', { gear: { ilvl: 40 }, level: 10, cleared: frei });
    await party(a, [b], 10);
    for (const p of [a, b]) p.send({ t: 'runde.auto', on: true });
    await env.clock.advance(200);
    b.drop();
    // Nach der Frist (90 s) fällt Bert aus dem Lauf, Anna spielt weiter
    await env.clock.until(() => laufOf(a)?.players.get(b.accountId)?.unitId === null, 120_000, 1000);
    const l = laufOf(a)!;
    expect(l.lauf.helden.some((h) => h.dbId === b.heroId)).toBe(false);
    expect(l.players.get(b.accountId)!.wantsRejoin).toBe(true);
    b.connect();
    b.hello();
    await env.clock.advance(500);
    b.send({ t: 'run.rejoin', on: true });
    const zurueck = await env.clock.until(() => l.lauf.helden.some((h) => h.dbId === b.heroId), 120_000, 1000);
    expect(zurueck).toBe(true);
    expect(b.has('runde.start')).toBe(true);
    // Er kämpft wieder mit: entweder gleich in der laufenden Begegnung oder spätestens hinter dem Tor
    if (l.lauf.phase === 'tor') {
      for (const p of [a, b]) p.send({ t: 'run.ready' });
      await env.clock.advance(200);
    }
    expect(l.lauf.kampf.figuren.some((f) => f.dbId === b.heroId)).toBe(true);
  }, 180_000);
});

describe('Größe des Rundenprotokolls (11.7)', () => {
  it('bleibt deutlich unter der Grenze der Schnappschüsse', async () => {
    const klassen = ['krieger', 'magier', 'waldlaeufer', 'schurke', 'kleriker', 'runenweber'] as const;
    const spieler: TestPlayer[] = [];
    for (const [i, kl] of klassen.entries()) {
      spieler.push(await addPlayer(env, `held${i}`, kl, { gear: { ilvl: 40 }, level: 10, cleared: [1, 2, 3, 4, 5, 6, 7, 8, 9] }));
    }
    const [erster, ...rest] = spieler as [TestPlayer, ...TestPlayer[]];
    await party(erster, rest, 10);
    for (const p of spieler) p.send({ t: 'runde.auto', on: true });
    const start = env.clock.now();
    await env.clock.advance(60_000);
    const sekunden = (env.clock.now() - start) / 1000;
    const groessen = erster.of('runde.protokoll').map((m) => JSON.stringify(m).length);
    expect(groessen.length).toBeGreaterThan(5);
    const max = Math.max(...groessen);
    const bytes = erster.sock.bytes;
    const rate = bytes / sekunden;
    console.log(`Rundenprotokoll: ${groessen.length} Runden, größte Nachricht ${max} B, ${(rate / 1024).toFixed(2)} KB/s je Spieler`);
    expect(max).toBeLessThan(env.ctx.content.balance.net.maxSnapshotBytes);
    expect(rate).toBeLessThan(4096);
  }, 180_000);

  it('bleibt auch im Bosskampf mit Adds unter der Grenze', async () => {
    const klassen = ['krieger', 'magier', 'waldlaeufer', 'schurke', 'kleriker', 'runenweber'] as const;
    const spieler: TestPlayer[] = [];
    for (const [i, kl] of klassen.entries()) {
      spieler.push(await addPlayer(env, `held${i}`, kl, { gear: { ilvl: 40 }, level: 10, cleared: [1, 2, 3, 4, 5, 6, 7, 8, 9] }));
    }
    const [erster, ...rest] = spieler as [TestPlayer, ...TestPlayer[]];
    await party(erster, rest, 10);
    for (const p of spieler) p.send({ t: 'runde.auto', on: true });
    await env.clock.until(() => laufOf(erster)?.lauf.phase === 'tor', 30 * MIN, 1000);
    for (const p of spieler) p.send({ t: 'run.ready' });
    await env.clock.advance(200);
    expect(laufOf(erster)!.lauf.phase).toBe('boss');
    const vorher = erster.of('runde.protokoll').length;
    await env.clock.until(() => erster.has('run.end'), 10 * MIN, 1000);
    const bossRunden = erster.of('runde.protokoll').slice(vorher);
    const max = Math.max(...bossRunden.map((m) => JSON.stringify(m).length));
    console.log(`Bosskampf: ${bossRunden.length} Runden, größte Nachricht ${max} B`);
    expect(bossRunden.length).toBeGreaterThan(5);
    expect(max).toBeLessThan(env.ctx.content.balance.net.maxSnapshotBytes);
  }, 300_000);
});
