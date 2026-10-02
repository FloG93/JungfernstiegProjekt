// Aufbau des Servers: Inhalte laden und prüfen, Datenbank migrieren, HTTP-Routen, Client ausliefern.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { loadContent } from '@aethra/shared';
import { readContentFiles } from '@aethra/shared/node';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { Config } from './config';
import type { AppCtx } from './context';
import { migrate, openDb } from './db/db';
import type { OpenedDb } from './db/db';
import { RateLimiter } from './limiter';
import { registerRoutes } from './http/routes';

export const VERSION = '0.1.0';
const AUTH_WINDOW_MS = 60_000;
const AUTH_MAX = 20;
const MS_PER_S = 1000;
const API_MAX = 120; // OPEN-045
const API_WINDOW_MS = 10_000;

export interface BuiltApp {
  app: FastifyInstance;
  ctx: AppCtx;
  dbh: OpenedDb;
}

export async function buildApp(config: Config, o: { logger?: boolean; now?: () => number } = {}): Promise<BuiltApp> {
  const files = readContentFiles(config.contentDir);
  const content = loadContent(files.raw); // Startabbruch bei Fehlern (2.3)
  const dbh = openDb(config.dbPath);
  await migrate(dbh.db);
  const now = o.now ?? (() => Date.now());
  const net = content.balance.net;
  const limiter = new RateLimiter({
    auth: { max: AUTH_MAX, windowMs: AUTH_WINDOW_MS },
    msg: { max: net.maxMsgsPerS, windowMs: MS_PER_S },
    input: { max: net.maxInputsPerS, windowMs: MS_PER_S },
    chat: { max: 1, windowMs: MS_PER_S },
    partyCode: { max: 1, windowMs: MS_PER_S },
    // Allgemeine Grenze für die HTTP-Schnittstelle je Adresse (11.9, 16.3)
    api: { max: API_MAX, windowMs: API_WINDOW_MS },
  }, now);
  const ctx: AppCtx = {
    config, content, contentFiles: files, db: dbh.db, limiter, version: VERSION, now,
    game: { db: dbh.db, content, bossTimerScale: config.bossTimerScale, isHeroInRun: () => false, now },
    online: () => [],
    runCount: () => 0,
  };
  const app = Fastify({
    logger: o.logger === false ? false : { level: config.logLevel },
    trustProxy: true,
    bodyLimit: 64 * 1024,
  });
  await app.register(fastifyCookie, { secret: config.sessionSecret });
  registerRoutes(app, ctx);
  if (existsSync(join(config.publicDir, 'index.html'))) {
    await app.register(fastifyStatic, { root: config.publicDir, prefix: '/', wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api') && !req.url.startsWith('/content') && !req.url.startsWith('/ws')) {
        return reply.sendFile('index.html');
      }
      return reply.status(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Nicht gefunden.' } });
    });
  }
  return { app, ctx, dbh };
}
