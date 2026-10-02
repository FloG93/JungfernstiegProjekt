// HTTP-Schnittstelle (15.2). Erfolg { ok: true, data }, Fehler { ok: false, error: { code, message } }.
import {
  AppearanceReq, ArtifactUpgradeReq, CombineReq, CreateHeroReq, DeleteHeroReq, ElementReq, EnchantReq, EquipReq,
  LockReq, LoginReq, RegisterReq, SellReq, SettingsReq, SocketReq, StashReq, StorySeenReq, SwapGemReq, TransferReq,
  UnequipReq, UnsocketReq,
} from '@aethra/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';
import {
  SESSION_COOKIE, checkPassword, createSession, deleteSession, hashPassword, sessionFromToken, sessionMaxAgeS,
  validateCredentials,
} from '../auth';
import type { SessionInfo } from '../auth';
import type { AppCtx } from '../context';
import {
  changeElement, combineGems, createHero, deleteHero, enchant, equip, heroState, listHeroes, lockItem, markStorySeen,
  ownHero, sell, setAppearance, setSettings, socketGem, stashItem, swapGem, transferLevel, unequip, unsocketGem,
  upgradeArtifact, bossBoard,
} from '../game/heroes';
import { ApiError, fail } from './errors';

declare module 'fastify' {
  interface FastifyRequest {
    session?: SessionInfo;
  }
}

function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data ?? {});
  if (!r.success) {
    const i = r.error.issues[0];
    fail('BAD_REQUEST', i ? `${i.path.join('.') || 'Eingabe'}: ${i.message}` : 'Ungültige Eingabe.');
  }
  return r.data;
}

function heroIdParam(req: FastifyRequest): number {
  const id = Number((req.params as { id?: string }).id);
  if (!Number.isInteger(id) || id <= 0) fail('BAD_REQUEST', 'Ungültige Helden-ID.');
  return id;
}

function itemIdParam(req: FastifyRequest): number {
  const id = Number((req.params as { itemId?: string }).itemId);
  if (!Number.isInteger(id) || id <= 0) fail('BAD_REQUEST', 'Ungültige Gegenstands-ID.');
  return id;
}

const ok = <T>(data: T) => ({ ok: true as const, data });

export function cookieOptions(ctx: AppCtx) {
  return {
    path: '/', httpOnly: true, sameSite: 'lax' as const, secure: ctx.config.cookieSecure, signed: true,
    maxAge: sessionMaxAgeS(ctx.content),
  };
}

/** Liest die Sitzung aus dem signierten Cookie (auch für das WebSocket-Upgrade). */
export async function sessionOf(ctx: AppCtx, req: FastifyRequest): Promise<SessionInfo | null> {
  const raw = req.cookies[SESSION_COOKIE];
  if (!raw) return null;
  const u = req.unsignCookie(raw);
  if (!u.valid || !u.value) return null;
  return sessionFromToken(ctx.db, u.value, ctx.now());
}

export function registerRoutes(app: FastifyInstance, ctx: AppCtx): void {
  const g = ctx.game;

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ApiError) {
      void reply.status(err.status).send({ ok: false, error: { code: err.code, message: err.message } });
      return;
    }
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode && e.statusCode < 500) {
      void reply.status(e.statusCode).send({ ok: false, error: { code: 'BAD_REQUEST', message: e.message ?? 'Fehlerhafte Anfrage.' } });
      return;
    }
    req.log.error(err);
    void reply.status(500).send({ ok: false, error: { code: 'CONFLICT', message: 'Interner Fehler, bitte erneut versuchen.' } });
  });

  const auth = async (req: FastifyRequest) => {
    const s = await sessionOf(ctx, req);
    if (!s) fail('UNAUTHORIZED', 'Bitte neu anmelden.');
    req.session = s;
    ctx.onActivity?.(s.accountId);
  };
  const acc = (req: FastifyRequest) => req.session!.accountId;

  // ---------- Konto ----------
  app.post('/api/register', async (req, reply) => {
    const b = parse(RegisterReq, req.body);
    ctx.limiter.check(`auth:${req.ip}`, 'auth');
    if (b.inviteCode.trim() !== ctx.config.inviteCode) fail('FORBIDDEN', 'Dieser Einladungscode gilt nicht.');
    validateCredentials(ctx.content, b.username, b.password);
    const exists = await ctx.db.selectFrom('accounts').select('id').where('username', '=', b.username.trim()).executeTakeFirst();
    if (exists) fail('NAME_TAKEN', 'Diesen Benutzernamen gibt es schon.');
    const now = ctx.now();
    const r = await ctx.db.insertInto('accounts').values({
      username: b.username.trim(), pw_hash: await hashPassword(b.password), created_at: now, last_login: now,
    }).returning('id').executeTakeFirstOrThrow();
    const s = await createSession(ctx.db, ctx.content, r.id, now);
    void reply.setCookie(SESSION_COOKIE, s.token, cookieOptions(ctx));
    return ok({ accountId: r.id, username: b.username.trim() });
  });

  app.post('/api/login', async (req, reply) => {
    const b = parse(LoginReq, req.body);
    ctx.limiter.check(`auth:${req.ip}`, 'auth');
    const a = await ctx.db.selectFrom('accounts').selectAll().where('username', '=', b.username.trim()).executeTakeFirst();
    if (!a || !(await checkPassword(a.pw_hash, b.password))) fail('UNAUTHORIZED', 'Benutzername oder Passwort stimmt nicht.');
    const now = ctx.now();
    await ctx.db.updateTable('accounts').set({ last_login: now }).where('id', '=', a.id).execute();
    const s = await createSession(ctx.db, ctx.content, a.id, now);
    void reply.setCookie(SESSION_COOKIE, s.token, cookieOptions(ctx));
    return ok({ accountId: a.id, username: a.username });
  });

  app.post('/api/logout', async (req, reply) => {
    const s = await sessionOf(ctx, req);
    if (s) await deleteSession(ctx.db, s.tokenHash);
    void reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return ok({});
  });

  app.get('/api/me', { preHandler: auth }, async (req) => ok({ accountId: acc(req), username: req.session!.username }));

  // ---------- Helden ----------
  app.get('/api/heroes', { preHandler: auth }, async (req) => ok(await listHeroes(g, acc(req))));

  app.post('/api/heroes', { preHandler: auth }, async (req) => {
    const b = parse(CreateHeroReq, req.body);
    return ok(await createHero(g, acc(req), b.name, b.classId, b.appearance));
  });

  app.delete('/api/heroes/:id', { preHandler: auth }, async (req) => {
    const b = parse(DeleteHeroReq, req.body);
    await deleteHero(g, acc(req), heroIdParam(req), b.confirmName);
    return ok({});
  });

  app.get('/api/heroes/:id', { preHandler: auth }, async (req) => {
    const id = heroIdParam(req);
    await ownHero(g, acc(req), id, false);
    return ok(await heroState(g, id));
  });

  app.put('/api/heroes/:id/appearance', { preHandler: auth }, async (req) => {
    const b = parse(AppearanceReq, req.body);
    await setAppearance(g, acc(req), heroIdParam(req), b.appearance);
    return ok({});
  });

  app.put('/api/heroes/:id/settings', { preHandler: auth }, async (req) => {
    const b = parse(SettingsReq, req.body);
    const id = heroIdParam(req);
    await setSettings(g, acc(req), id, b);
    const change: Parameters<NonNullable<AppCtx['onSettingsChanged']>>[1] = {};
    if (b.autocast) change.autocast = b.autocast;
    if (b.autoPotion !== undefined) change.autoPotion = b.autoPotion;
    if (b.autoDodge !== undefined) change.autoDodge = b.autoDodge;
    if (b.autoContinue !== undefined) change.autoContinue = b.autoContinue;
    ctx.onSettingsChanged?.(id, change);
    if (b.activeSet) ctx.onHeroChanged?.(id);
    return ok({});
  });

  // Mutationen geben den neuen Zustand zurück, damit der Client nur einmal lädt
  const mutate = (path: string, run: (req: FastifyRequest, id: number) => Promise<unknown>) => {
    app.post(path, { preHandler: auth }, async (req) => {
      const id = heroIdParam(req);
      const extra = await run(req, id);
      ctx.onHeroChanged?.(id);
      return ok({ result: extra ?? null, state: await heroState(g, id) });
    });
  };

  mutate('/api/heroes/:id/equip', (req, id) => {
    const b = parse(EquipReq, req.body);
    return equip(g, acc(req), id, b.itemId, b.equipSlot);
  });
  mutate('/api/heroes/:id/unequip', (req, id) => unequip(g, acc(req), id, parse(UnequipReq, req.body).equipSlot));
  mutate('/api/heroes/:id/sell', (req, id) => {
    const b = parse(SellReq, req.body);
    return sell(g, acc(req), id, b.itemIds, b.confirm ?? false);
  });
  mutate('/api/heroes/:id/items/:itemId/lock', (req, id) => lockItem(g, acc(req), id, itemIdParam(req), parse(LockReq, req.body).locked));
  mutate('/api/heroes/:id/items/:itemId/stash', (req, id) => stashItem(g, acc(req), id, itemIdParam(req), parse(StashReq, req.body).stash));
  mutate('/api/heroes/:id/gems/socket', (req, id) => {
    const b = parse(SocketReq, req.body);
    return socketGem(g, acc(req), id, b.gemId, b.socket);
  });
  mutate('/api/heroes/:id/gems/unsocket', (req, id) => unsocketGem(g, acc(req), id, parse(UnsocketReq, req.body).socket));
  mutate('/api/heroes/:id/gems/combine', (req, id) => {
    const b = parse(CombineReq, req.body);
    return combineGems(g, acc(req), id, b.kind, b.tier);
  });
  mutate('/api/heroes/:id/gems/swap', (req, id) => {
    const b = parse(SwapGemReq, req.body);
    return swapGem(g, acc(req), id, b.gemId, b.kind);
  });
  mutate('/api/heroes/:id/weapons/element', (req, id) => {
    const b = parse(ElementReq, req.body);
    return changeElement(g, acc(req), id, b.itemId, b.element);
  });
  mutate('/api/heroes/:id/weapons/transfer', (req, id) => {
    const b = parse(TransferReq, req.body);
    return transferLevel(g, acc(req), id, b.fromItemId, b.toItemId);
  });
  mutate('/api/heroes/:id/weapons/enchant', (req, id) => {
    const b = parse(EnchantReq, req.body);
    return enchant(g, acc(req), id, b.itemId, b.line, b.action, b.type);
  });
  mutate('/api/heroes/:id/artifacts/upgrade', (req, id) => upgradeArtifact(g, acc(req), id, parse(ArtifactUpgradeReq, req.body).slot));

  app.post('/api/heroes/:id/story/seen', { preHandler: auth }, async (req) => {
    const id = heroIdParam(req);
    await ownHero(g, acc(req), id, false);
    await markStorySeen(g, id, parse(StorySeenReq, req.body).textId);
    return ok({});
  });

  app.get('/api/heroes/:id/bosses', { preHandler: auth }, async (req) => {
    const id = heroIdParam(req);
    await ownHero(g, acc(req), id, false);
    return ok(await bossBoard(g, id));
  });

  app.get('/api/online', { preHandler: auth }, async () => ok(ctx.online()));

  // ---------- Inhalte und Zustand ----------
  app.get('/content/index.json', async (_req, reply) => {
    void reply.header('etag', `"${ctx.contentFiles.hash}"`).header('cache-control', 'no-cache');
    return { hash: ctx.contentFiles.hash, files: Object.keys(ctx.contentFiles.text) };
  });

  app.get('/content/*', async (req: FastifyRequest, reply: FastifyReply) => {
    const file = (req.params as { '*': string })['*'];
    const text = ctx.contentFiles.text[file];
    if (text === undefined) fail('NOT_FOUND', 'Datei nicht gefunden.');
    const etag = `"${ctx.contentFiles.hash}"`;
    if (req.headers['if-none-match'] === etag) return reply.status(304).send();
    return reply.header('etag', etag).header('cache-control', 'no-cache').type('application/json; charset=utf-8').send(text);
  });

  app.get('/api/health', async () => ok({
    status: 'up', version: ctx.version, contentHash: ctx.contentFiles.hash, runs: ctx.runCount(),
    memoryMb: Math.round(process.memoryUsage().rss / 1048576),
  }));
}
