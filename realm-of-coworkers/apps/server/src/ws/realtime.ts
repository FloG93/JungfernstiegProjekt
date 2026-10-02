// WebSocket unter /ws (15.3): Anmeldung über das Sitzungs-Cookie beim Upgrade, eine Verbindung je Konto (11.9).
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { SESSION_COOKIE, sessionFromToken } from '../auth';
import type { SessionInfo } from '../auth';
import type { AppCtx } from '../context';
import type { Sock } from './client';
import { systemClock } from './clock';
import type { Clock } from './clock';
import { Hub } from './hub';

/** Größte erlaubte Nachricht eines Clients (Eingaben, Chat). */
const MAX_PAYLOAD = 16 * 1024;
/** Kleinere Nachrichten werden nicht komprimiert (11.7: permessage-deflate). */
const DEFLATE_THRESHOLD = 256;

/** Sitzung aus dem Cookie-Header des Upgrades (signiertes Cookie wie bei HTTP). */
export async function sessionFromCookieHeader(app: FastifyInstance, ctx: AppCtx, header: string | undefined): Promise<SessionInfo | null> {
  if (!header) return null;
  const raw = app.parseCookie(header)[SESSION_COOKIE];
  if (!raw) return null;
  const u = app.unsignCookie(raw);
  if (!u.valid || !u.value) return null;
  return sessionFromToken(ctx.db, u.value, ctx.now());
}

/** Browser schicken Origin mit; er muss zum Host passen (Schutz vor fremden Seiten). */
export function originAllowed(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const host = new URL(origin).host;
    const fwd = req.headers['x-forwarded-host'];
    return host === req.headers.host || (typeof fwd === 'string' && fwd.split(',').some((h) => h.trim() === host));
  } catch {
    return false;
  }
}

function reject(socket: Duplex, status: number, text: string): void {
  socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

function wrap(ws: WebSocket): Sock {
  return {
    send: (data) => {
      if (ws.readyState === ws.OPEN) ws.send(data);
    },
    close: (code, reason) => ws.close(code, reason),
  };
}

export interface RealtimeOptions {
  clock?: Clock;
}

export function attachRealtime(app: FastifyInstance, ctx: AppCtx, o: RealtimeOptions = {}): Hub {
  const hub = new Hub(ctx, o.clock ?? systemClock(ctx.now), app.log);
  ctx.online = () => hub.online();
  ctx.runCount = () => hub.runCount();
  ctx.game.isHeroInRun = (heroId) => hub.isHeroInRun(heroId);
  ctx.onSettingsChanged = (heroId, s) => hub.onSettingsChanged(heroId, s);
  ctx.onHeroChanged = (heroId) => hub.onHeroChanged(heroId);
  ctx.onActivity = (accountId) => hub.onActivity(accountId);

  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_PAYLOAD,
    perMessageDeflate: { threshold: DEFLATE_THRESHOLD },
  });
  const sockets = new Set<WebSocket>();

  const upgrade = async (req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> => {
    const path = (req.url ?? '/').split('?')[0];
    if (path !== '/ws') {
      socket.destroy();
      return;
    }
    if (!originAllowed(req)) {
      reject(socket, 403, 'Forbidden');
      return;
    }
    const session = await sessionFromCookieHeader(app, ctx, req.headers.cookie);
    if (!session) {
      reject(socket, 401, 'Unauthorized');
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      sockets.add(ws);
      const cl = hub.connect(wrap(ws), { accountId: session.accountId, username: session.username });
      ws.on('message', (data, isBinary) => {
        if (isBinary) return;
        hub.message(cl, data.toString());
      });
      ws.on('close', () => {
        sockets.delete(ws);
        hub.disconnect(cl);
      });
      ws.on('error', () => ws.terminate());
    });
  };

  app.server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    upgrade(req, socket, head).catch((err: unknown) => {
      app.log.error({ err }, 'WS: Upgrade fehlgeschlagen');
      socket.destroy();
    });
  });
  app.addHook('preClose', async () => {
    await hub.stop();
    for (const ws of sockets) ws.terminate();
    wss.close();
  });
  hub.start();
  return hub;
}
