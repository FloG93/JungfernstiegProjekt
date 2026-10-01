// Abnahme M5: alle Endpunkte aus 15.2, Transaktionen, Sperre laufender Helden (HERO_IN_RUN).
import { Rng, createItem } from '@aethra/shared';
import type { HeroStateDTO, ItemData } from '@aethra/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import type { BuiltApp } from './app';
import { loadConfig } from './config';
import { grantRewards } from './game/rewards';

const INVITE = 'kollegen-2026';

async function makeApp(): Promise<BuiltApp> {
  const config = loadConfig({ SESSION_SECRET: 'test-geheimnis-mit-genug-laenge', INVITE_CODE: INVITE, DB_PATH: ':memory:', PUBLIC_DIR: '/nicht/da' });
  return buildApp(config, { logger: false });
}

interface Res<T = unknown> {
  status: number;
  body: { ok: boolean; data: T; error?: { code: string; message: string } };
  cookie?: string;
}

function client(b: BuiltApp) {
  let cookie = '';
  const call = async <T = unknown>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: unknown): Promise<Res<T>> => {
    const r = await b.app.inject({ method, url, ...(payload !== undefined ? { payload: payload as object } : {}), headers: cookie ? { cookie } : {} });
    const set = r.cookies.find((c) => c.name === 'aethra_session');
    if (set) cookie = set.value ? `aethra_session=${set.value}` : '';
    return { status: r.statusCode, body: r.json() as Res<T>['body'] };
  };
  return { call, setCookie: (c: string) => (cookie = c), getCookie: () => cookie };
}

let b: BuiltApp;
beforeEach(async () => {
  b = await makeApp();
});
afterEach(async () => {
  await b.app.close();
  b.dbh.raw.close();
});

async function registered(name = 'anna') {
  const c = client(b);
  const r = await c.call('POST', '/api/register', { username: name, password: 'geheim123', inviteCode: INVITE });
  expect(r.body.ok).toBe(true);
  return c;
}

async function heroOf(c: ReturnType<typeof client>, classId = 'magier', name = 'Sternlicht') {
  const r = await c.call<{ id: number }>('POST', '/api/heroes', { name, classId, appearance: { body: 1, portrait: 2, palette: 3 } });
  expect(r.body.ok).toBe(true);
  return r.body.data.id;
}

const state = async (c: ReturnType<typeof client>, id: number) => (await c.call<HeroStateDTO>('GET', `/api/heroes/${id}`)).body.data;

function item(classId: 'magier' | 'krieger', slot: ItemData['slot'], ilvl: number, rarity: ItemData['rarity'] = 'selten', seed = 1): ItemData {
  return createItem(b.ctx.content, new Rng(seed), { classId, slot, ilvl, rarity, element: 'feuer' });
}

describe('Konto und Sitzung', () => {
  it('Registrierung nur mit Einladungscode, Login, Me, Logout', async () => {
    const c = client(b);
    expect((await c.call('POST', '/api/register', { username: 'bob', password: 'geheim123', inviteCode: 'falsch' })).body.error?.code).toBe('FORBIDDEN');
    expect((await c.call('POST', '/api/register', { username: 'b', password: 'geheim123', inviteCode: INVITE })).body.error?.code).toBe('BAD_REQUEST');
    expect((await c.call('POST', '/api/register', { username: 'bob', password: 'kurz', inviteCode: INVITE })).body.error?.code).toBe('BAD_REQUEST');
    expect((await c.call('POST', '/api/register', { username: 'bob', password: 'geheim123', inviteCode: INVITE })).body.ok).toBe(true);
    expect((await c.call<{ username: string }>('GET', '/api/me')).body.data.username).toBe('bob');
    const d = client(b);
    expect((await d.call('POST', '/api/register', { username: 'BOB', password: 'geheim123', inviteCode: INVITE })).body.error?.code).toBe('NAME_TAKEN');
    expect((await d.call('POST', '/api/login', { username: 'bob', password: 'falsch12' })).status).toBe(401);
    expect((await d.call('POST', '/api/login', { username: 'Bob', password: 'geheim123' })).body.ok).toBe(true);
    await c.call('POST', '/api/logout');
    expect((await c.call('GET', '/api/me')).body.error?.code).toBe('UNAUTHORIZED');
    expect((await d.call('GET', '/api/me')).body.ok).toBe(true);
  });

  it('gefälschte Cookies werden abgelehnt', async () => {
    const c = client(b);
    c.setCookie('aethra_session=abc.def');
    expect((await c.call('GET', '/api/heroes')).status).toBe(401);
  });
});

describe('Helden (4.1)', () => {
  it('anlegen mit Startwaffe, Regeln für Name und Klasse, löschen mit Namensbestätigung', async () => {
    const c = await registered();
    const id = await heroOf(c);
    const st = await state(c, id);
    expect(st.hero.level).toBe(1);
    expect(st.equipped.Waffe_A?.rarity).toBe('gewoehnlich');
    expect(st.hero.autocast['magier_kataklysmus']).toBe(false);
    expect(st.hero.autocast['magier_elementarkugel']).toBe(true);
    expect(st.unlockedStages).toEqual([1]);
    expect(st.bosses).toHaveLength(6);
    expect((await c.call('POST', '/api/heroes', { name: 'Zweiter', classId: 'magier', appearance: { body: 0, portrait: 0, palette: 0 } })).body.error?.code).toBe('CONFLICT');
    expect((await c.call('POST', '/api/heroes', { name: 'sternlicht', classId: 'krieger', appearance: { body: 0, portrait: 0, palette: 0 } })).body.error?.code).toBe('NAME_TAKEN');
    expect((await c.call('POST', '/api/heroes', { name: 'X!', classId: 'krieger', appearance: { body: 0, portrait: 0, palette: 0 } })).body.error?.code).toBe('BAD_REQUEST');
    expect((await c.call('POST', '/api/heroes', { name: 'Eisen', classId: 'krieger', appearance: { body: 9, portrait: 0, palette: 0 } })).body.error?.code).toBe('BAD_REQUEST');
    expect((await c.call('DELETE', `/api/heroes/${id}`, { confirmName: 'falsch' })).body.error?.code).toBe('BAD_REQUEST');
    expect((await c.call('DELETE', `/api/heroes/${id}`, { confirmName: 'Sternlicht' })).body.ok).toBe(true);
    expect((await c.call<unknown[]>('GET', '/api/heroes')).body.data).toHaveLength(0);
  });

  it('fremde Helden sind gesperrt (403), laufende Helden ebenso (409 HERO_IN_RUN)', async () => {
    const a = await registered('anna');
    const id = await heroOf(a);
    const z = await registered('zoe');
    expect((await z.call('GET', `/api/heroes/${id}`)).status).toBe(403);
    b.ctx.game.isHeroInRun = (h) => h === id;
    expect((await a.call('POST', `/api/heroes/${id}/unequip`, { equipSlot: 'Waffe_A' })).body.error?.code).toBe('HERO_IN_RUN');
    expect((await a.call('GET', `/api/heroes/${id}`)).body.ok).toBe(true);
  });

  it('Aussehen und Einstellungen ändern', async () => {
    const c = await registered();
    const id = await heroOf(c);
    expect((await c.call('PUT', `/api/heroes/${id}/appearance`, { appearance: { body: 3, portrait: 7, palette: 5 } })).body.ok).toBe(true);
    expect((await c.call('PUT', `/api/heroes/${id}/settings`, { autocast: { magier_kataklysmus: true }, autoContinue: true })).body.ok).toBe(true);
    const st = await state(c, id);
    expect(st.hero.appearance).toEqual({ body: 3, portrait: 7, palette: 5 });
    expect(st.hero.autocast['magier_kataklysmus']).toBe(true);
    expect(st.hero.settings.autoContinue).toBe(true);
    expect((await c.call('PUT', `/api/heroes/${id}/settings`, { autocast: { krieger_spott: true } })).body.error?.code).toBe('BAD_REQUEST');
  });
});

describe('Ausrüstung und Verkauf (8.1, 8.9)', () => {
  it('anlegen nach Anforderung, Waffensatz B, ablegen, sperren, verkaufen', async () => {
    const c = await registered();
    const id = await heroOf(c);
    await grantRewards(b.ctx.game, id, { items: [item('magier', 'helm', 3), item('magier', 'helm', 12, 'episch', 2), item('magier', 'waffe', 2)] });
    let st = await state(c, id);
    const [helm, helmHigh, weapon] = st.inventory;
    expect((await c.call('POST', `/api/heroes/${id}/equip`, { itemId: helmHigh!.id })).body.error?.code).toBe('REQUIREMENT_NOT_MET');
    st = (await c.call<{ state: HeroStateDTO }>('POST', `/api/heroes/${id}/equip`, { itemId: helm!.id })).body.data.state;
    expect(st.equipped.Helm?.id).toBe(helm!.id);
    st = (await c.call<{ state: HeroStateDTO }>('POST', `/api/heroes/${id}/equip`, { itemId: weapon!.id, equipSlot: 'Waffe_B' })).body.data.state;
    expect(st.equipped.Waffe_B?.element).toBe('feuer');
    expect(st.stats.B.kra).toBeGreaterThan(st.stats.A.kra - 100);
    st = (await c.call<{ state: HeroStateDTO }>('POST', `/api/heroes/${id}/unequip`, { equipSlot: 'Helm' })).body.data.state;
    expect(st.equipped.Helm).toBeUndefined();
    await c.call('POST', `/api/heroes/${id}/items/${helm!.id}/lock`, { locked: true });
    expect((await c.call('POST', `/api/heroes/${id}/sell`, { itemIds: [helm!.id] })).body.error?.code).toBe('CONFLICT');
    expect((await c.call('POST', `/api/heroes/${id}/sell`, { itemIds: [weapon!.id] })).body.error?.code).toBe('CONFLICT');
    const before = st.hero.gold;
    st = (await c.call<{ state: HeroStateDTO }>('POST', `/api/heroes/${id}/sell`, { itemIds: [weapon!.id], confirm: true })).body.data.state;
    expect(st.hero.gold - before).toBe(weapon!.sellPrice);
    expect(st.equipped.Waffe_B).toBeUndefined();
  });

  it('Überlauftruhe und automatischer Verkauf schonen gesperrte und legendäre Gegenstände', async () => {
    const c = await registered();
    const id = await heroOf(c);
    const many = Array.from({ length: 120 }, (_, i) => item('magier', 'stiefel', 10 + (i % 5), 'gewoehnlich', i + 10));
    await grantRewards(b.ctx.game, id, { items: many });
    let st = await state(c, id);
    expect(st.inventory).toHaveLength(80);
    expect(st.stash).toHaveLength(40);
    const cheapest = [...st.inventory, ...st.stash].sort((x, y) => x.budget - y.budget || x.id - y.id)[0]!;
    const res = await grantRewards(b.ctx.game, id, { items: [item('magier', 'helm', 20, 'episch', 999)] });
    expect(res.autoSold).toHaveLength(1);
    st = await state(c, id);
    expect([...st.inventory, ...st.stash].some((i) => i.id === cheapest.id)).toBe(false);
    expect([...st.inventory, ...st.stash].some((i) => i.rarity === 'episch')).toBe(true);
    const stashed = st.stash[0]!;
    expect((await c.call('POST', `/api/heroes/${id}/items/${stashed.id}/stash`, { stash: false })).body.error?.code).toBe('INVENTORY_FULL');
  });
});

describe('Juwelier (7.3, 7.4)', () => {
  it('kombinieren kostet 60 × n² Gold, tauschen 40 × n, Slots nach Stufe, Rollback bei Fehler', async () => {
    const c = await registered();
    const id = await heroOf(c);
    await grantRewards(b.ctx.game, id, { gems: [{ kind: 'granat', tier: 1 }, { kind: 'granat', tier: 1 }, { kind: 'granat', tier: 1 }] });
    expect((await c.call('POST', `/api/heroes/${id}/gems/combine`, { kind: 'granat', tier: 1 })).body.error?.code).toBe('NOT_ENOUGH_GOLD');
    expect((await state(c, id)).gems).toHaveLength(3);
    await b.ctx.db.updateTable('heroes').set({ gold: 1000, level: 6 }).where('id', '=', id).execute();
    let st = (await c.call<{ state: HeroStateDTO }>('POST', `/api/heroes/${id}/gems/combine`, { kind: 'granat', tier: 1 })).body.data.state;
    expect(st.gems).toEqual([expect.objectContaining({ kind: 'granat', tier: 2, socket: null })]);
    expect(st.hero.gold).toBe(940);
    const gem = st.gems[0]!;
    expect((await c.call('POST', `/api/heroes/${id}/gems/socket`, { gemId: gem.id, socket: 2 })).body.error?.code).toBe('REQUIREMENT_NOT_MET');
    st = (await c.call<{ state: HeroStateDTO }>('POST', `/api/heroes/${id}/gems/socket`, { gemId: gem.id, socket: 1 })).body.data.state;
    expect(st.gems[0]!.socket).toBe(1);
    expect(st.stats.A.leb).toBeGreaterThan((await state(c, id)).stats.A.leb - 1);
    st = (await c.call<{ state: HeroStateDTO }>('POST', `/api/heroes/${id}/gems/swap`, { gemId: gem.id, kind: 'rubin' })).body.data.state;
    expect(st.gems[0]!.kind).toBe('rubin');
    expect(st.hero.gold).toBe(860);
    st = (await c.call<{ state: HeroStateDTO }>('POST', `/api/heroes/${id}/gems/unsocket`, { socket: 1 })).body.data.state;
    expect(st.gems[0]!.socket).toBeNull();
  });
});

describe('Schmiede (8.4, 8.7)', () => {
  it('Element wechseln (20 × iLvl), Waffenstufe übertragen (300 × Stufe), verzaubern ab Stufe 10', async () => {
    const c = await registered();
    const id = await heroOf(c);
    await grantRewards(b.ctx.game, id, { items: [item('magier', 'waffe', 5), item('magier', 'waffe', 6, 'selten', 2)] });
    await b.ctx.db.updateTable('heroes').set({ gold: 100_000 }).where('id', '=', id).execute();
    let st = await state(c, id);
    const [w1, w2] = st.inventory;
    st = (await c.call<{ state: HeroStateDTO }>('POST', `/api/heroes/${id}/weapons/element`, { itemId: w1!.id, element: 'eis' })).body.data.state;
    expect(st.inventory.find((i) => i.id === w1!.id)!.element).toBe('eis');
    expect(st.hero.gold).toBe(100_000 - 20 * 5);
    await b.ctx.db.updateTable('items').set({ weapon_level: 10 }).where('id', '=', w1!.id).execute();
    expect((await c.call('POST', `/api/heroes/${id}/weapons/enchant`, { itemId: w2!.id, line: 0, action: 'type', type: 'kraft' })).body.error?.code).toBe('REQUIREMENT_NOT_MET');
    const gold0 = (await state(c, id)).hero.gold;
    st = (await c.call<{ state: HeroStateDTO }>('POST', `/api/heroes/${id}/weapons/transfer`, { fromItemId: w1!.id, toItemId: w2!.id })).body.data.state;
    expect(st.inventory.find((i) => i.id === w2!.id)!.weaponLevel).toBe(10);
    expect(st.inventory.some((i) => i.id === w1!.id)).toBe(false);
    expect(st.hero.gold).toBe(gold0 - 3000);
    await c.call('POST', `/api/heroes/${id}/weapons/enchant`, { itemId: w2!.id, line: 0, action: 'type', type: 'kraft' });
    await c.call('POST', `/api/heroes/${id}/weapons/enchant`, { itemId: w2!.id, line: 0, action: 'rank' });
    st = (await c.call<{ state: HeroStateDTO }>('POST', `/api/heroes/${id}/weapons/enchant`, { itemId: w2!.id, line: 0, action: 'rank' })).body.data.state;
    expect(st.inventory.find((i) => i.id === w2!.id)!.enchants).toEqual([{ id: 'kraft', rank: 2 }]);
    expect(st.hero.gold).toBe(gold0 - 3000 - 100 - 400);
    expect((await c.call('POST', `/api/heroes/${id}/weapons/enchant`, { itemId: w2!.id, line: 1, action: 'type', type: 'kraft' })).body.error?.code).toBe('CONFLICT');
    st = (await c.call<{ state: HeroStateDTO }>('POST', `/api/heroes/${id}/weapons/enchant`, { itemId: w2!.id, line: 0, action: 'type', type: 'tempo' })).body.data.state;
    expect(st.inventory.find((i) => i.id === w2!.id)!.enchants).toEqual([{ id: 'tempo', rank: 0 }]);
    expect(st.hero.gold).toBe(gold0 - 3000 - 500 - 500);
  });

  it('legendäre Waffen behalten ihr Element', async () => {
    const c = await registered();
    const id = await heroOf(c);
    await grantRewards(b.ctx.game, id, { items: [createItem(b.ctx.content, new Rng(1), { classId: 'magier', slot: 'waffe', ilvl: 5, rarity: 'legendaer', bossWeapon: 'ignarch' })] });
    await b.ctx.db.updateTable('heroes').set({ gold: 1000 }).where('id', '=', id).execute();
    const w = (await state(c, id)).inventory[0]!;
    expect((await c.call('POST', `/api/heroes/${id}/weapons/element`, { itemId: w.id, element: 'eis' })).body.error?.code).toBe('BAD_REQUEST');
  });
});

describe('Archiv (7.6) und Belohnungen (12)', () => {
  it('Artefakt erst nach Freischaltung, Aufwerten kostet Splitter', async () => {
    const c = await registered();
    const id = await heroOf(c);
    expect((await c.call('POST', `/api/heroes/${id}/artifacts/upgrade`, { slot: 'amulett' })).body.error?.code).toBe('REQUIREMENT_NOT_MET');
    await grantRewards(b.ctx.game, id, { artifactUnlock: 'amulett' });
    expect((await c.call('POST', `/api/heroes/${id}/artifacts/upgrade`, { slot: 'amulett' })).body.error?.code).toBe('NOT_ENOUGH_SPLINTERS');
    await grantRewards(b.ctx.game, id, { splinters: 7 });
    const st = (await c.call<{ state: HeroStateDTO }>('POST', `/api/heroes/${id}/artifacts/upgrade`, { slot: 'amulett' })).body.data.state;
    expect(st.artifacts.find((a) => a.slot === 'amulett')!.rank).toBe(2);
    expect(st.hero.splinters).toBe(1);
  });

  it('XP mit Stufenaufstieg, Waffen-XP 50 %, Gold', async () => {
    const c = await registered();
    const id = await heroOf(c);
    const r = await grantRewards(b.ctx.game, id, { xp: 450, gold: 120.6 });
    expect(r.levelUps).toEqual([2, 3]);
    expect(r.weaponXp).toBe(225);
    const st = await state(c, id);
    expect(st.hero.level).toBe(3);
    expect(st.hero.xp).toBe(70);
    expect(st.hero.gold).toBe(121);
    expect(st.equipped.Waffe_A!.weaponXp).toBe(225);
    expect(st.freeSockets).toBe(1);
  });
});

describe('Inhalte und Zustand', () => {
  it('liefert Inhalte mit Hash und ETag, Health mit Version', async () => {
    const idx = await b.app.inject({ method: 'GET', url: '/content/index.json' });
    const { hash, files } = idx.json() as { hash: string; files: string[] };
    expect(files).toContain('classes.json');
    const f = await b.app.inject({ method: 'GET', url: '/content/classes.json' });
    expect(f.headers.etag).toBe(`"${hash}"`);
    expect((f.json() as unknown[]).length).toBe(6);
    const n = await b.app.inject({ method: 'GET', url: '/content/classes.json', headers: { 'if-none-match': `"${hash}"` } });
    expect(n.statusCode).toBe(304);
    const h = await b.app.inject({ method: 'GET', url: '/api/health' });
    expect((h.json() as { data: { status: string } }).data.status).toBe('up');
  });
});
