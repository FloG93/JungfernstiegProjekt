// Abnahme M9 (Runs): Solo bis zur Truhe, Speichern von Beute und XP, Pause, Autopilot, Wiedereinstieg, Helfer am Boss
// (2.4, 2.5, 10.9, 11.4 bis 11.6, 12).
import { goldPot, xpToNext } from '@aethra/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { equip } from '../game/heroes';
import { ApiError } from '../http/errors';
import { addPlayer, makeEnv } from './testkit';
import type { TestEnv, TestPlayer } from './testkit';

const MIN = 60_000;
let env: TestEnv;
beforeEach(async () => {
  env = await makeEnv();
});
afterEach(async () => {
  await env.close();
});

const runOf = (p: TestPlayer) => env.hub.lobby.partyOf(p.accountId)?.run ?? null;

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
  expect(leader.has('run.start')).toBe(true);
}

async function heroRow(id: number) {
  return env.ctx.db.selectFrom('heroes').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
}

describe('Solo-Run (11.6, 12)', () => {
  it('Stage 1 bis zur Truhe: Töpfe, Truhe, Abschluss gespeichert; Held im Run gesperrt', { timeout: 120_000 }, async () => {
    const a = await addPlayer(env, 'anna', 'magier', { gear: { ilvl: 5 } });
    // 95 von 100 XP: der Stufenaufstieg fällt mitten in den Run (12.1)
    await env.ctx.db.updateTable('heroes').set({ xp: 95 }).where('id', '=', a.heroId).execute();
    await party(a, [], 1);
    const start = a.last('run.start')!;
    expect(start.n).toBe(1);
    expect(start.roster[0]).toMatchObject({ accountId: a.accountId, heroId: a.heroId, classId: 'magier', helper: false });
    expect(start.config.tickMs).toBe(50);
    expect(env.ctx.game.isHeroInRun(a.heroId)).toBe(true);
    expect(env.ctx.online()[0]).toMatchObject({ status: 'stage', stage: 1 });
    const item = await env.ctx.db.selectFrom('items').select('id').where('hero_id', '=', a.heroId).where('equip_slot', '=', 'Helm').executeTakeFirstOrThrow();
    await expect(equip(env.ctx.game, a.accountId, a.heroId, item.id)).rejects.toThrow(ApiError);

    await env.clock.until(() => a.has('run.end'), 20 * MIN, 1000);
    const end = a.last('run.end')!;
    expect(end).toMatchObject({ result: 'win', stage: 1, firstClear: true, next: 2, helper: false, splinters: 2 });
    // Topf-Regel (12.3): volle Stage = xp(1) und G(1), auf ganze Zahlen gerundet
    const c = env.ctx.content;
    expect(end.xp).toBe(xpToNext(c.balance, 1));
    expect(end.gold).toBe(Math.round(goldPot(c.balance, 1)));
    expect(end.levelUps).toEqual([2]);
    expect(end.loot.length).toBeGreaterThanOrEqual(c.stageLoot.itemsPerChest);
    // Gespeichert (2.5)
    const h = await heroRow(a.heroId);
    expect(h.level).toBe(2);
    expect(h.xp).toBe(95);
    expect(h.gold).toBe(end.gold);
    expect(h.splinters).toBe(2);
    const prog = await env.ctx.db.selectFrom('stage_progress').selectAll().where('hero_id', '=', a.heroId).execute();
    expect(prog).toEqual([expect.objectContaining({ stage: 1, clears: 1 })]);
    const weapon = await env.ctx.db.selectFrom('items').selectAll().where('hero_id', '=', a.heroId).where('equip_slot', '=', 'Waffe_A').executeTakeFirstOrThrow();
    expect(weapon.weapon_xp + weapon.weapon_level * 1000).toBeGreaterThan(0);
    // Stufenaufstieg während des Runs als Ereignis für alle
    const ups = a.of('run.events').flatMap((m) => m.list).filter((e) => e.e === 'levelup');
    expect(ups).toEqual([{ e: 'levelup', heroId: a.heroId, level: 2 }]);
    // Run vorbei: Held frei, Protokoll geschrieben, Party wählt Stage 2 vor
    expect(env.ctx.game.isHeroInRun(a.heroId)).toBe(false);
    expect(env.ctx.runCount()).toBe(0);
    const log = await env.ctx.db.selectFrom('run_log').selectAll().executeTakeFirstOrThrow();
    expect(log).toMatchObject({ stage: 1, result: 'win' });
    expect(log.events).not.toBeNull();
    expect(a.last('party.state')).toMatchObject({ stage: 2, inRun: false });
    expect(a.last('party.state')!.choices).toContain(2);
    // Snapshots: höchstens 8 KB (11.7)
    for (const s of a.of('run.snapshot')) expect(JSON.stringify(s).length).toBeLessThanOrEqual(c.balance.net.maxSnapshotBytes);
  });

  it('Pause hält die Simulation an und endet nach 10 Minuten; Verbindungsverlust pausiert Solo', { timeout: 60_000 }, async () => {
    const a = await addPlayer(env, 'anna', 'krieger', { gear: { ilvl: 5 } });
    await party(a, [], 1);
    const run = runOf(a)!;
    await env.clock.advance(2000);
    a.send({ t: 'run.pause', on: true });
    await env.clock.advance(100);
    const t0 = run.world.tick;
    await env.clock.advance(5000);
    expect(run.world.tick).toBe(t0);
    expect(a.last('run.snapshot')!.run.paused).toBe(true);
    a.send({ t: 'run.pause', on: false });
    await env.clock.advance(1000);
    expect(run.world.tick).toBeGreaterThan(t0 + 15);
    // Verbindung weg: Solo hält an, Rückkehr setzt fort
    a.drop();
    await env.clock.advance(100);
    expect(run.world.paused).toBe(true);
    await env.clock.advance(3 * MIN);
    a.connect();
    a.hello();
    await env.clock.advance(200);
    expect(run.world.paused).toBe(false);
    expect(a.last('run.start')?.runId).toBe(run.id);
    expect(a.last('run.snapshot')?.full).toBe(true);
    a.send({ t: 'run.pause', on: true });
    await env.clock.advance(10 * MIN + 2000);
    expect(a.last('run.closed')?.reason).toBe('pause');
    expect(a.last('run.end')?.result).toBe('abort');
    expect(env.ctx.runCount()).toBe(0);
  });
});

describe('Idle (E-023)', () => {
  it('Auto-Weiter: nach dem Beute-Bildschirm startet die nächste Stage von selbst, am Boss-Tor wird bestätigt', { timeout: 120_000 }, async () => {
    const a = await addPlayer(env, 'anna', 'magier', { level: 5, gear: { ilvl: 5 }, cleared: [1, 2, 3] });
    a.send({ t: 'party.create' });
    await env.clock.advance(50);
    a.send({ t: 'party.autoContinue', on: true });
    a.send({ t: 'party.setStage', stage: 4 });
    a.send({ t: 'party.start' });
    await env.clock.until(() => a.has('run.end'), 20 * MIN, 1000);
    const end = a.last('run.end')!;
    expect(end).toMatchObject({ result: 'win', next: 5, autoContinueIn: 8000 });
    expect(a.last('party.state')).toMatchObject({ stage: 5, autoContinue: true, inRun: false });
    // Einstellung bleibt am Helden gespeichert
    expect(JSON.parse((await heroRow(a.heroId)).settings ?? '{}')).toMatchObject({ autoContinue: true });
    await env.clock.advance(8100);
    expect(a.of('run.start').map((r) => r.stage)).toEqual([4, 5]);
    const run = runOf(a)!;
    await env.clock.until(() => run.scenario.phase === 'gate', 10 * MIN, 500);
    expect(a.last('run.snapshot')!.run.autoReadyIn).toBeGreaterThan(0);
    // Ohne Eingabe: nach 8 s bereit, Countdown, Bosskampf
    await env.clock.advance(9000);
    expect(['countdown', 'boss']).toContain(run.scenario.phase);
  });
});

describe('Koop (2.4, 11.4, 11.5)', () => {
  it('Autopilot bei Verbindungsverlust, Übernahme, Entfernung nach 90 s, Wiedereinstieg am Checkpoint', { timeout: 120_000 }, async () => {
    const a = await addPlayer(env, 'anna', 'krieger', { gear: { ilvl: 5 } });
    const b = await addPlayer(env, 'bert', 'magier', { gear: { ilvl: 5 } });
    await party(a, [b], 1);
    const run = runOf(a)!;
    expect(run.world.n).toBe(2);
    const bUnit = () => run.world.units.find((u) => u.hero?.dbId === b.heroId);
    await env.clock.advance(1000);
    b.drop();
    await env.clock.advance(100);
    expect(bUnit()?.hero?.connected).toBe(false);
    expect(run.world.n).toBe(1);
    // Rückkehr innerhalb von 90 s: Held wird übernommen
    await env.clock.advance(30_000);
    b.connect();
    b.hello();
    await env.clock.advance(200);
    expect(b.last('welcome')?.reconnected).toBe(true);
    expect(b.last('run.start')?.runId).toBe(run.id);
    expect(bUnit()?.hero?.connected).toBe(true);
    expect(run.world.n).toBe(2);
    // Erneut weg und 90 s Frist: Held verlässt den Run, n sinkt
    b.drop();
    await env.clock.advance(92_000);
    expect(bUnit()).toBeUndefined();
    expect(env.ctx.game.isHeroInRun(b.heroId)).toBe(false);
    expect(run.world.n).toBe(1);
    // Zurück: Wiedereinstieg erst am nächsten Checkpoint (11.5)
    b.connect();
    b.hello();
    await env.clock.advance(200);
    expect(b.last('party.state')!.members.find((m) => m.accountId === b.accountId)).toMatchObject({ inRun: false, rejoin: true });
    const cp = run.scenario.checkpointIdx;
    await env.clock.until(() => run.scenario.checkpointIdx > cp || run.ended, 10 * MIN, 500);
    await env.clock.advance(200);
    expect(bUnit()).toBeDefined();
    expect(bUnit()!.hp).toBe(bUnit()!.maxHp);
    expect(Math.abs(bUnit()!.x - run.scenario.anchorX)).toBeLessThan(400);
    expect(b.last('run.start')!.roster.map((r) => r.accountId).sort()).toEqual([a.accountId, b.accountId].sort());
    expect(run.world.n).toBe(2);
  });

  it('Run verlassen: Beute bleibt, Ergebnis kommt sofort; der Rest spielt weiter', { timeout: 60_000 }, async () => {
    const a = await addPlayer(env, 'anna', 'krieger', { gear: { ilvl: 5 } });
    const b = await addPlayer(env, 'bert', 'waldlaeufer', { gear: { ilvl: 5 } });
    await party(a, [b], 1);
    const run = runOf(a)!;
    await env.clock.until(() => run.scenario.cleared.size >= 1, 5 * MIN, 500);
    b.send({ t: 'run.leave' });
    await env.clock.advance(200);
    const end = b.last('run.end')!;
    expect(end.result).toBe('abort');
    expect(end.xp).toBeGreaterThan(0);
    expect((await heroRow(b.heroId)).xp + (await heroRow(b.heroId)).level).toBeGreaterThan(1);
    expect(env.ctx.game.isHeroInRun(b.heroId)).toBe(false);
    expect(env.ctx.game.isHeroInRun(a.heroId)).toBe(true);
    expect(run.ended).toBe(false);
    // Autowalk nur durch den Anführer (9.2)
    b.send({ t: 'run.autowalk', on: false });
    a.send({ t: 'run.autowalk', on: false });
    await env.clock.advance(100);
    expect(run.scenario.autowalk).toBe(false);
    expect(b.last('error')?.code).toBe('CONFLICT');
  });

  it('Eingaben werden bestätigt und bewegen den Helden; Pings erreichen alle', { timeout: 60_000 }, async () => {
    const a = await addPlayer(env, 'anna', 'krieger', { gear: { ilvl: 5 } });
    const b = await addPlayer(env, 'bert', 'kleriker', { gear: { ilvl: 5 } });
    await party(a, [b], 1);
    const run = runOf(a)!;
    a.send({ t: 'run.autowalk', on: false });
    await env.clock.advance(500);
    const u = run.world.units.find((x) => x.hero?.dbId === a.heroId)!;
    const y0 = u.y;
    const seq = a.input(0, 1);
    await env.clock.advance(500);
    expect(a.last('run.ack')?.seq).toBe(seq);
    expect(u.y).toBeGreaterThan(y0 + 50);
    a.input(0, 0);
    a.send({ t: 'run.ping', kind: 'danger', x: 100, y: 120 });
    await env.clock.advance(200);
    const pings = b.of('run.events').flatMap((m) => m.list).filter((e) => e.e === 'ping');
    expect(pings).toEqual([{ e: 'ping', from: u.id, kind: 'danger', x: 100, y: 120 }]);
    // Auto-Cast umschalten wirkt im Run und wird gespeichert
    a.send({ t: 'run.autocast', skillId: 'krieger_wirbelhieb', on: false });
    await env.clock.advance(200);
    const sk = u.hero!.skills.find((s) => s.def.id === 'krieger_wirbelhieb');
    expect(sk?.autocast).toBe(false);
    expect(JSON.parse((await heroRow(a.heroId)).autocast ?? '{}')).toMatchObject({ krieger_wirbelhieb: false });
    // Pause ist im Mehrspielermodus verboten (11.6)
    a.send({ t: 'run.pause', on: true });
    await env.clock.advance(100);
    expect(a.last('error')?.code).toBe('FORBIDDEN');
  });
});

describe('Bosskampf (10.1, 10.8, 10.9)', () => {
  it('Helfer ohne Beute, Kampfstufe aus den Berechtigten, Timer und K nur für Berechtigte', { timeout: 180_000 }, async () => {
    const now = env.clock.now();
    const opts = { level: 5, gear: { ilvl: 5, element: 'eis' as const }, cleared: [1, 2, 3, 4] };
    const a = await addPlayer(env, 'anna', 'krieger', opts);
    const b = await addPlayer(env, 'bert', 'kleriker', { ...opts, cleared: [1, 2, 3, 4, 5] });
    const c = await addPlayer(env, 'cora', 'magier', { ...opts, cleared: [1, 2, 3, 4, 5] });
    // bert: Timer läuft (Helfer), K = 3; cora: Timer abgelaufen, K = 1
    await env.ctx.db.insertInto('boss_state').values([
      { hero_id: b.heroId, boss_id: 'ignarch', first_kill_at: now - 60 * MIN, last_kill_at: now - MIN, kampfstufe: 3 },
      { hero_id: c.heroId, boss_id: 'ignarch', first_kill_at: now - 60 * MIN, last_kill_at: now - 30 * MIN, kampfstufe: 1 },
    ]).execute();
    for (const p of [a, b, c]) {
      p.hello();
      await env.clock.advance(100);
    }
    await party(a, [b, c], 5);
    const st = a.last('party.state')!;
    expect(st.members.map((m) => m.helper)).toEqual([false, true, false]);
    const run = runOf(a)!;
    expect(a.last('run.start')!.roster.map((r) => r.helper)).toEqual([false, true, false]);
    expect(run.scenario.kampfstufe).toBe(1);
    await env.clock.until(() => run.scenario.phase === 'gate', 10 * MIN, 500);
    a.send({ t: 'run.ready' });
    b.send({ t: 'run.ready' });
    await env.clock.advance(1000);
    expect(run.scenario.phase).toBe('gate');
    expect(a.last('run.snapshot')!.run.ready.sort()).toEqual([a.accountId, b.accountId].sort());
    c.send({ t: 'run.ready' });
    await env.clock.advance(1000);
    expect(run.scenario.phase).toBe('countdown');
    await env.clock.until(() => a.has('run.end'), 15 * MIN, 1000);
    await env.clock.advance(500);
    const [ea, eb, ec] = [a.last('run.end')!, b.last('run.end')!, c.last('run.end')!];
    expect(ea.result).toBe('win');
    // Erster Sieg: Bosswaffe sicher, Artefakt in Kapitel 1, 6 Splitter (10.8)
    expect(ea.loot.some((i) => i.effectId === 'ignarch')).toBe(true);
    expect(ea.splinters).toBe(6);
    expect(ea.artifactUnlocked).not.toBeNull();
    // Helfer: keine Boss-Belohnung, nur die Töpfe der Begegnungen
    expect(eb.helper).toBe(true);
    expect(eb.loot).toEqual([]);
    expect(eb.splinters).toBe(0);
    expect(ec.splinters).toBe(3);
    const bs = await env.ctx.db.selectFrom('boss_state').selectAll().where('boss_id', '=', 'ignarch').orderBy('hero_id').execute();
    const byHero = new Map(bs.map((r) => [r.hero_id, r]));
    expect(byHero.get(a.heroId)).toMatchObject({ kampfstufe: 0 });
    expect(byHero.get(b.heroId)).toMatchObject({ kampfstufe: 3, last_kill_at: now - MIN });
    expect(byHero.get(c.heroId)?.kampfstufe).toBe(2);
    expect(ea.next).toBe(6);
  });
});
