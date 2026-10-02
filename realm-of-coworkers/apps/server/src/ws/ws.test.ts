// Abnahme M9 (Gateway): echter WebSocket unter /ws mit Sitzungs-Cookie, Origin-Prüfung, Protokollversion, Ersetzen (15.3, 11.9).
import type { AddressInfo } from 'node:net';
import { PROTOCOL_VERSION } from '@aethra/shared';
import type { ServerMsg } from '@aethra/shared';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { buildApp } from '../app';
import type { BuiltApp } from '../app';
import { loadConfig } from '../config';
import { CLOSE_PROTOCOL, CLOSE_REPLACED } from './client';
import { attachRealtime } from './realtime';

const INVITE = 'kollegen';
let b: BuiltApp;
let url = '';

beforeEach(async () => {
  b = await buildApp(loadConfig({ SESSION_SECRET: 'test-geheimnis-mit-genug-laenge', INVITE_CODE: INVITE, DB_PATH: ':memory:', PUBLIC_DIR: '/nicht/da' }), { logger: false });
  attachRealtime(b.app, b.ctx);
  await b.app.listen({ port: 0, host: '127.0.0.1' });
  url = `ws://127.0.0.1:${(b.app.server.address() as AddressInfo).port}/ws`;
});
afterEach(async () => {
  await b.app.close();
  b.dbh.raw.close();
});

async function account(name: string): Promise<{ cookie: string; heroId: number }> {
  const r = await b.app.inject({ method: 'POST', url: '/api/register', payload: { username: name, password: 'geheim123', inviteCode: INVITE } });
  const c = r.cookies.find((x) => x.name === 'aethra_session')!;
  const cookie = `aethra_session=${c.value}`;
  const h = await b.app.inject({
    method: 'POST', url: '/api/heroes', headers: { cookie },
    payload: { name: name[0]!.toUpperCase() + name.slice(1), classId: 'magier', appearance: { body: 0, portrait: 0, palette: 0 } },
  });
  return { cookie, heroId: (h.json() as { data: { id: number } }).data.id };
}

interface Conn {
  ws: WebSocket;
  msgs: ServerMsg[];
  closed: Promise<{ code: number; reason: string }>;
  next(t: ServerMsg['t']): Promise<ServerMsg>;
}

function open(headers: Record<string, string>): Promise<Conn> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers });
    const msgs: ServerMsg[] = [];
    const waiters: { t: string; res: (m: ServerMsg) => void }[] = [];
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString()) as ServerMsg;
      msgs.push(m);
      for (const w of [...waiters]) {
        if (w.t === m.t) {
          waiters.splice(waiters.indexOf(w), 1);
          w.res(m);
        }
      }
    });
    const closed = new Promise<{ code: number; reason: string }>((res) => ws.on('close', (code, reason) => res({ code, reason: reason.toString() })));
    ws.on('open', () => resolve({
      ws, msgs, closed,
      next: (t) => {
        const have = msgs.find((m) => m.t === t);
        if (have) return Promise.resolve(have);
        return new Promise((res) => waiters.push({ t, res }));
      },
    }));
    ws.on('unexpected-response', (_req, res) => reject(new Error(`HTTP ${res.statusCode}`)));
    ws.on('error', (err) => reject(err));
  });
}

it('Anmeldung über das Cookie, hello und welcome; ohne Cookie 401, fremder Origin 403', async () => {
  const anna = await account('anna');
  await expect(open({})).rejects.toThrow('HTTP 401');
  await expect(open({ cookie: 'aethra_session=gefaelscht' })).rejects.toThrow('HTTP 401');
  await expect(open({ cookie: anna.cookie, origin: 'https://boese.example' })).rejects.toThrow('HTTP 403');
  const c = await open({ cookie: anna.cookie, origin: url.replace('ws://', 'http://').replace('/ws', '') });
  c.ws.send(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, heroId: anna.heroId }));
  const w = await c.next('welcome');
  expect(w).toMatchObject({ t: 'welcome', v: PROTOCOL_VERSION, heroId: anna.heroId, contentHash: b.ctx.contentFiles.hash });
  const p = await c.next('presence');
  expect(p.t === 'presence' && p.list.map((e) => e.username)).toEqual(['anna']);
  // Die HTTP-Schnittstelle sieht die Verbindung (11.1)
  const online = await b.app.inject({ method: 'GET', url: '/api/online', headers: { cookie: anna.cookie } });
  expect((online.json() as { data: unknown[] }).data.length).toBe(1);
  c.ws.close();
  await c.closed;
});

it('falsche Protokollversion schließt mit 4001, zweite Verbindung ersetzt die erste mit 4002', async () => {
  const anna = await account('anna');
  const c1 = await open({ cookie: anna.cookie });
  c1.ws.send(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION + 7, heroId: anna.heroId }));
  expect((await c1.closed).code).toBe(CLOSE_PROTOCOL);
  const c2 = await open({ cookie: anna.cookie });
  c2.ws.send(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, heroId: anna.heroId }));
  await c2.next('welcome');
  c2.ws.send(JSON.stringify({ t: 'party.create' }));
  await c2.next('party.state');
  const c3 = await open({ cookie: anna.cookie });
  expect((await c2.closed).code).toBe(CLOSE_REPLACED);
  c3.ws.send(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, heroId: anna.heroId }));
  const w = await c3.next('welcome');
  expect(w.t === 'welcome' && w.reconnected).toBe(true);
  const st = await c3.next('party.state');
  expect(st.t === 'party.state' && st.members.length).toBe(1);
  c3.ws.close();
  await c3.closed;
});
