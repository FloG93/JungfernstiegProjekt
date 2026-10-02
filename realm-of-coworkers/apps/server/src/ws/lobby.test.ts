// Abnahme M9 (Lobby): hello, Online-Liste, Party per Code und Einladung, Anführer, Stage-Wahl, Bereit, Chat (11.1 bis 11.3, 11.9, 15.3).
import { PROTOCOL_VERSION } from '@aethra/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLOSE_PROTOCOL, CLOSE_REPLACED } from './client';
import { addPlayer, makeEnv } from './testkit';
import type { TestEnv } from './testkit';

let env: TestEnv;
beforeEach(async () => {
  env = await makeEnv();
});
afterEach(async () => {
  await env.close();
});

describe('Anmeldung (15.3, 11.9)', () => {
  it('hello mit falscher Protokollversion schließt mit 4001', async () => {
    const p = await addPlayer(env, 'anna', 'magier', { hello: false });
    p.send({ t: 'hello', v: PROTOCOL_VERSION + 1, heroId: p.heroId });
    await env.clock.advance(100);
    expect(p.sock.closed?.code).toBe(CLOSE_PROTOCOL);
    expect(p.has('welcome')).toBe(false);
  });

  it('fremder Held wird abgelehnt, eigener angenommen', async () => {
    const a = await addPlayer(env, 'anna', 'magier');
    const b = await addPlayer(env, 'bert', 'krieger', { hello: false });
    b.hello(a.heroId);
    await env.clock.advance(100);
    expect(b.last('error')?.code).toBe('FORBIDDEN');
    b.hello();
    await env.clock.advance(100);
    const w = b.last('welcome')!;
    expect(w.heroId).toBe(b.heroId);
    expect(w.contentHash).toBe(env.ctx.contentFiles.hash);
    expect(w.reconnected).toBe(false);
  });

  it('vor hello werden Befehle abgelehnt, ungültige Nachrichten verworfen', async () => {
    const p = await addPlayer(env, 'anna', 'magier', { hello: false });
    p.send({ t: 'party.create' });
    await env.clock.advance(100);
    expect(p.last('error')?.code).toBe('UNAUTHORIZED');
    env.hub.message(p.cl, '{kein json');
    env.hub.message(p.cl, JSON.stringify({ t: 'party.chat', text: 5 }));
    await env.clock.advance(100);
    expect(p.of('error').length).toBe(2);
  });

  it('eine neue Verbindung ersetzt die alte (4002)', async () => {
    const p = await addPlayer(env, 'anna', 'magier');
    const old = p.sock;
    p.send({ t: 'party.create' });
    await env.clock.advance(100);
    p.connect();
    expect(old.closed?.code).toBe(CLOSE_REPLACED);
    p.hello();
    await env.clock.advance(100);
    expect(p.last('welcome')?.reconnected).toBe(true);
    expect(p.last('party.state')?.members[0]?.connected).toBe(true);
  });

  it('Rate-Limit: höchstens 30 Nachrichten pro Sekunde (11.9)', async () => {
    const a = await addPlayer(env, 'anna', 'magier');
    a.send({ t: 'party.create' });
    await env.clock.advance(100);
    const before = a.of('error').length;
    for (let i = 0; i < 40; i++) a.send({ t: 'party.ready', ready: i % 2 === 0 });
    await env.clock.advance(10);
    const states = a.of('party.state').length;
    // 30 im Fenster; party.create zählt mit
    expect(states).toBeLessThanOrEqual(31);
    expect(a.of('error').length).toBe(before);
  });
});

describe('Online-Liste (11.1)', () => {
  it('zeigt alle Angemeldeten mit Held, Stufe und Status; Abwesend nach 10 Minuten', async () => {
    const a = await addPlayer(env, 'anna', 'magier');
    const b = await addPlayer(env, 'bert', 'krieger', { level: 7 });
    await env.clock.advance(1100);
    const list = a.last('presence')!.list;
    expect(list.map((e) => e.username)).toEqual(['anna', 'bert']);
    const bert = list.find((e) => e.username === 'bert')!;
    expect(bert).toMatchObject({ classId: 'krieger', level: 7, status: 'lager' });
    expect(env.ctx.online().length).toBe(2);
    // anna bleibt aktiv, bert nicht
    for (let i = 0; i < 11; i++) {
      a.send({ t: 'party.ready', ready: false });
      await env.clock.advance(60_000);
    }
    const later = a.last('presence')!.list;
    expect(later.find((e) => e.username === 'bert')?.status).toBe('abwesend');
    expect(later.find((e) => e.username === 'anna')?.status).toBe('lager');
    b.drop();
    await env.clock.advance(1100);
    expect(a.last('presence')!.list.map((e) => e.username)).toEqual(['anna']);
  });
});

describe('Party (11.2, 11.3)', () => {
  it('Code, Beitritt, Anführerwechsel, Entfernen, Auflösen', async () => {
    const a = await addPlayer(env, 'anna', 'magier');
    const b = await addPlayer(env, 'bert', 'krieger');
    const c = await addPlayer(env, 'cora', 'kleriker');
    a.send({ t: 'party.create' });
    await env.clock.advance(100);
    const st = a.last('party.state')!;
    expect(st.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(st.leader).toBe(a.accountId);
    b.send({ t: 'party.join', code: st.code.toLowerCase() });
    await env.clock.advance(100);
    expect(b.last('party.state')!.members.map((m) => m.username)).toEqual(['anna', 'bert']);
    // Falscher Code und Rate-Limit für Code-Versuche (11.9)
    c.send({ t: 'party.join', code: 'XXXXXX' });
    c.send({ t: 'party.join', code: st.code });
    await env.clock.advance(100);
    expect(c.errors()).toEqual(['NOT_FOUND: Diesen Party-Code gibt es nicht.', 'RATE_LIMITED: Bitte kurz warten.']);
    await env.clock.advance(1000);
    c.send({ t: 'party.join', code: st.code });
    await env.clock.advance(100);
    expect(c.last('party.state')!.members.length).toBe(3);
    // Nur der Anführer entfernt
    b.send({ t: 'party.kick', targetAccountId: c.accountId });
    await env.clock.advance(100);
    expect(b.last('error')?.code).toBe('FORBIDDEN');
    a.send({ t: 'party.kick', targetAccountId: c.accountId });
    await env.clock.advance(100);
    expect(c.has('party.left')).toBe(true);
    expect(a.last('party.state')!.members.length).toBe(2);
    // Anführer geht: das am längsten anwesende Mitglied übernimmt
    a.send({ t: 'party.leave' });
    await env.clock.advance(100);
    expect(b.last('party.state')!.leader).toBe(b.accountId);
    b.send({ t: 'party.leave' });
    await env.clock.advance(100);
    expect(env.hub.lobby.parties.size).toBe(0);
  });

  it('Einladung aus der Online-Liste: annehmen, ablehnen, verfallen nach 60 s', async () => {
    const a = await addPlayer(env, 'anna', 'magier');
    const b = await addPlayer(env, 'bert', 'krieger');
    const c = await addPlayer(env, 'cora', 'kleriker');
    a.send({ t: 'party.invite', targetAccountId: b.accountId });
    await env.clock.advance(100);
    const inv = b.last('party.invited')!;
    expect(inv.fromAccountId).toBe(a.accountId);
    expect(inv.from).toContain('Anna');
    expect(inv.expiresIn).toBe(60_000);
    expect(a.last('party.state')?.members.length).toBe(1);
    b.send({ t: 'party.answer', inviteId: inv.inviteId, accept: true });
    await env.clock.advance(100);
    expect(b.last('party.state')!.members.map((m) => m.username)).toEqual(['anna', 'bert']);
    await env.clock.advance(1000);
    a.send({ t: 'party.invite', targetAccountId: c.accountId });
    await env.clock.advance(61_000);
    c.send({ t: 'party.answer', inviteId: c.last('party.invited')!.inviteId, accept: true });
    await env.clock.advance(100);
    expect(c.last('error')?.code).toBe('NOT_FOUND');
    expect(c.has('party.state')).toBe(false);
  });

  it('höchstens 6 Mitglieder', async () => {
    const ps = [];
    for (let i = 0; i < 7; i++) ps.push(await addPlayer(env, `spieler${i}`, 'krieger'));
    ps[0]!.send({ t: 'party.create' });
    await env.clock.advance(100);
    const code = ps[0]!.last('party.state')!.code;
    for (let i = 1; i < 7; i++) {
      ps[i]!.send({ t: 'party.join', code });
      await env.clock.advance(1100);
    }
    expect(ps[0]!.last('party.state')!.members.length).toBe(6);
    expect(ps[6]!.last('error')?.message).toBe('Die Party ist voll.');
  });

  it('Stage-Wahl: frei für mindestens ein Mitglied; Nachzügler-Regel; alle bereit → Countdown 5 s', async () => {
    const a = await addPlayer(env, 'anna', 'magier', { level: 9, cleared: [1, 2, 3, 4, 5, 6, 7, 8] });
    const b = await addPlayer(env, 'bert', 'krieger', { level: 4 });
    a.send({ t: 'party.create' });
    await env.clock.advance(100);
    b.send({ t: 'party.join', code: a.last('party.state')!.code });
    await env.clock.advance(100);
    const st = a.last('party.state')!;
    expect(st.choices).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    a.send({ t: 'party.setStage', stage: 10 });
    await env.clock.advance(100);
    expect(a.last('error')?.code).toBe('REQUIREMENT_NOT_MET');
    b.send({ t: 'party.setStage', stage: 3 });
    await env.clock.advance(100);
    expect(b.last('error')?.code).toBe('FORBIDDEN');
    // Stage 7: empfohlen 7, bert Stufe 4 → 7 − 3 = 4 erlaubt; Stage 8 nicht
    a.send({ t: 'party.setStage', stage: 7 });
    await env.clock.advance(100);
    expect(b.last('party.state')!.members.map((m) => m.allowed)).toEqual([true, true]);
    a.send({ t: 'party.setStage', stage: 8 });
    await env.clock.advance(100);
    expect(b.last('party.state')!.members.map((m) => m.allowed)).toEqual([true, false]);
    a.send({ t: 'party.setStage', stage: 7 });
    a.send({ t: 'party.ready', ready: true });
    await env.clock.advance(100);
    expect(a.last('party.state')!.startsAt).toBeNull();
    b.send({ t: 'party.ready', ready: true });
    await env.clock.advance(100);
    const startsAt = a.last('party.state')!.startsAt!;
    expect(startsAt - env.clock.now()).toBeGreaterThan(4500);
    expect(a.has('run.start')).toBe(false);
    await env.clock.advance(5000);
    expect(a.last('run.start')?.stage).toBe(7);
    expect(b.last('run.start')?.roster.length).toBe(2);
    expect(env.ctx.runCount()).toBe(1);
  });

  it('Chat: höchstens 200 Zeichen, eine Nachricht pro Sekunde, nur für die Party', async () => {
    const a = await addPlayer(env, 'anna', 'magier');
    const b = await addPlayer(env, 'bert', 'krieger');
    const c = await addPlayer(env, 'cora', 'kleriker');
    a.send({ t: 'party.create' });
    await env.clock.advance(100);
    b.send({ t: 'party.join', code: a.last('party.state')!.code });
    await env.clock.advance(100);
    a.send({ t: 'party.chat', text: '  <b>Hallo</b>  ' });
    a.send({ t: 'party.chat', text: 'zu schnell' });
    await env.clock.advance(1100);
    a.send({ t: 'party.chat', text: 'x'.repeat(201) });
    await env.clock.advance(100);
    expect(b.of('chat').map((m) => m.text)).toEqual(['<b>Hallo</b>']);
    expect(a.errors()).toEqual(['RATE_LIMITED: Eine Nachricht pro Sekunde.', 'BAD_REQUEST: Die Nachricht ist zu lang.']);
    expect(c.has('chat')).toBe(false);
  });

  it('getrennte Mitglieder fallen nach 90 s aus der Party', async () => {
    const a = await addPlayer(env, 'anna', 'magier');
    const b = await addPlayer(env, 'bert', 'krieger');
    a.send({ t: 'party.create' });
    await env.clock.advance(100);
    b.send({ t: 'party.join', code: a.last('party.state')!.code });
    await env.clock.advance(100);
    b.drop();
    await env.clock.advance(100);
    expect(a.last('party.state')!.members[1]?.connected).toBe(false);
    await env.clock.advance(90_000);
    expect(a.last('party.state')!.members.length).toBe(1);
  });
});
