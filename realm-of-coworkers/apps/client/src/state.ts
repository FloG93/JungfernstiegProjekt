// Zustand des Clients: Sitzung, Held, Lobby, Run und Hinweise. Nachrichten des Servers landen hier.
import { storyLines } from '@aethra/shared';
import type {
  BossId, ClassId, ElementId, GameEvent, HeroStateDTO, HeroSummaryDTO, MeDTO, OnlineEntry, PartyStateDTO, RunEndMsg,
  RunStateDTO, ServerMsg, StoryLine,
} from '@aethra/shared';
import { api, ApiError } from './lib/api';
import { play } from './lib/audio';
import { content, contentHash, loadGameContent } from './lib/content';
import { t } from './lib/i18n';
import { net } from './lib/net';
import { Store } from './lib/store';
import { Controls } from './game/controls';
import { RunView } from './game/runview';

export type Screen = 'boot' | 'login' | 'heroes' | 'camp' | 'run' | 'loot';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error' | 'good' | 'loot';
}

export interface Invite {
  inviteId: string;
  from: string;
  fromAccountId: number;
  expiresAt: number;
}

export interface ChatLine {
  id: number;
  from: number;
  name: string;
  text: string;
}

export interface Banner {
  id: number;
  text: string;
  sub?: string;
  kind: 'info' | 'danger' | 'good' | 'phase';
  until: number;
}

export interface Frame {
  id: number;
  acc: number | null;
  name: string;
  cls: ClassId;
  level: number;
  hp: number;
  maxHp: number;
  shield: number;
  dead: boolean;
  own: boolean;
  fx: { id: string; stacks: number; ms: number }[];
  el: ElementId;
}

export interface RunHud {
  runId: string;
  stage: number;
  run: RunStateDTO;
  me: (NonNullable<RunStateDTO['me']> & { hp: number; maxHp: number; shield: number; cd: Record<string, number>; el: ElementId; dead: boolean; cls: ClassId; level: number }) | null;
  frames: Frame[];
  boss: { id: number; bossId: BossId; hp: number; maxHp: number; shield: number; el: ElementId; fx: Frame['fx'] } | null;
  leader: boolean;
  solo: boolean;
  /** Clientzeit, zu der der Countdown endet. */
  countdownAt: number | null;
  rtt: number | null;
}

export interface Story {
  title: string;
  lines: StoryLine[];
  textId: string | null;
}

export const screen = new Store<Screen>('boot');
export const me = new Store<MeDTO | null>(null);
export const heroes = new Store<HeroSummaryDTO[]>([]);
export const heroState = new Store<HeroStateDTO | null>(null);
export const presence = new Store<OnlineEntry[]>([]);
export const party = new Store<PartyStateDTO | null>(null);
export const invites = new Store<Invite[]>([]);
export const chat = new Store<ChatLine[]>([]);
export const hud = new Store<RunHud | null>(null);
export const loot = new Store<RunEndMsg | null>(null);
export const toasts = new Store<Toast[]>([]);
export const banners = new Store<Banner[]>([]);
export const story = new Store<Story | null>(null);
/** Serverzeit minus Clientzeit (für Countdowns aus party.state). */
export let serverOffset = 0;

let nextId = 1;
let view: RunView | null = null;
let events: GameEvent[] = [];
const pendingTelegraphs = new Set<number>();
export const controls = new Controls((m) => net.send(m));

export function currentView(): RunView | null {
  return view;
}

export function drainEvents(): GameEvent[] {
  const e = events;
  events = [];
  return e;
}

export function toast(text: string, kind: Toast['kind'] = 'info', ms = 3500): void {
  const id = nextId++;
  toasts.set((l) => [...l.slice(-4), { id, text, kind }]);
  setTimeout(() => toasts.set((l) => l.filter((x) => x.id !== id)), ms);
}

export function banner(text: string, kind: Banner['kind'] = 'info', ms = 2200, sub?: string): void {
  const id = nextId++;
  const b: Banner = { id, text, kind, until: Date.now() + ms };
  if (sub) b.sub = sub;
  banners.set((l) => [...l.filter((x) => x.until > Date.now()).slice(-2), b]);
  setTimeout(() => banners.set((l) => l.filter((x) => x.id !== id)), ms);
}

export function errorToast(e: unknown): void {
  play('error');
  toast(e instanceof ApiError ? e.message : t('error.CONFLICT'), 'error');
}

// ---------- Held ----------

export async function refreshHero(): Promise<void> {
  const id = selectedHeroId();
  if (id === null) return;
  try {
    heroState.set(await api.state(id));
  } catch (e) {
    errorToast(e);
  }
}

const HERO_KEY = 'aethra.hero';

export function selectedHeroId(): number | null {
  const s = heroState.get();
  if (s) return s.hero.id;
  const raw = localStorage.getItem(HERO_KEY);
  return raw ? Number(raw) : null;
}

export async function chooseHero(id: number): Promise<void> {
  try {
    localStorage.setItem(HERO_KEY, String(id));
  } catch {
    // ohne Speicher wählt man beim nächsten Mal erneut
  }
  heroState.set(await api.state(id));
  net.connect(id);
  screen.set('camp');
}

/** Wendet das Ergebnis einer Änderung (HTTP) an. */
export function applyState(s: HeroStateDTO): void {
  heroState.set(s);
}

// ---------- Start ----------

export async function boot(): Promise<void> {
  try {
    await loadGameContent();
  } catch (e) {
    toast(String(e), 'error', 10_000);
    return;
  }
  try {
    me.set(await api.me());
  } catch {
    screen.set('login');
    return;
  }
  await afterLogin();
}

export async function afterLogin(): Promise<void> {
  const list = await api.heroes();
  heroes.set(list);
  const last = Number(localStorage.getItem(HERO_KEY));
  const h = list.find((x) => x.id === last) ?? (list.length === 1 ? list[0] : undefined);
  if (h) await chooseHero(h.id);
  else screen.set('heroes');
}

export async function logout(): Promise<void> {
  net.disconnect();
  try {
    await api.logout();
  } catch {
    // Sitzung ist ohnehin weg
  }
  me.set(null);
  heroState.set(null);
  party.set(null);
  screen.set('login');
}

// ---------- Run-Anzeige ----------

function deriveHud(v: RunView): RunHud | null {
  const run = v.run;
  if (!run) return null;
  const frames: Frame[] = [];
  let boss: RunHud['boss'] = null;
  for (const e of v.ents.values()) {
    if (e.removedAt !== null) continue;
    if (e.kind === 'hero') {
      frames.push({
        id: e.id, acc: e.meta.acc ?? null, name: e.meta.name ?? '?', cls: (e.meta.cls ?? 'krieger') as ClassId, level: e.meta.level ?? 1,
        hp: e.cur.hp, maxHp: e.cur.maxHp, shield: e.cur.shield ?? 0, dead: e.cur.state === 'dead', own: e.id === v.ownId,
        fx: e.cur.fx ?? [], el: (e.cur.el ?? 'physisch') as ElementId,
      });
    } else if (e.kind === 'boss') {
      boss = {
        id: e.id, bossId: (e.meta.boss ?? 'ignarch') as BossId, hp: e.cur.hp, maxHp: e.cur.maxHp, shield: e.cur.shield ?? 0,
        el: (e.cur.el ?? 'physisch') as ElementId, fx: e.cur.fx ?? [],
      };
    }
  }
  frames.sort((a, b) => Number(b.own) - Number(a.own) || a.id - b.id);
  const own = v.own();
  const p = party.get();
  const myAcc = me.get()?.accountId ?? -1;
  const ownFrame = frames.find((f) => f.own);
  return {
    runId: v.start.runId,
    stage: v.start.stage,
    run,
    me: run.me && own ? {
      ...run.me, hp: own.cur.hp, maxHp: own.cur.maxHp, shield: own.cur.shield ?? 0, cd: own.cur.cd ?? {},
      el: (own.cur.el ?? 'physisch') as ElementId, dead: own.cur.state === 'dead', cls: ownFrame?.cls ?? 'krieger', level: ownFrame?.level ?? 1,
    } : null,
    frames,
    boss,
    leader: p?.leader === myAcc,
    solo: v.start.roster.length === 1 && (p?.members.length ?? 1) === 1,
    countdownAt: run.countdownEndsIn !== null ? performance.now() + run.countdownEndsIn : null,
    rtt: net.status.get().rtt,
  };
}

function onRunEvents(list: GameEvent[]): void {
  const v = view;
  for (const ev of list) {
    switch (ev.e) {
      case 'encounter':
        if (ev.state === 'start') banner(t('hud.encounter', { n: ev.index + 1, total: v?.run?.encounters ?? 6 }), 'danger', 1600);
        break;
      case 'checkpoint':
        banner(t('hud.checkpoint'), 'good');
        play('checkpoint');
        break;
      case 'wipe':
        banner(t('hud.wipe'), 'danger', 3000);
        play('wipe');
        break;
      case 'levelup': {
        const mine = ev.heroId === heroState.get()?.hero.id;
        banner(t('progress.levelUp', { level: ev.level }), 'good', 2500, mine ? undefined : nameOfHero(ev.heroId));
        play('levelup');
        if (mine) void refreshHero();
        break;
      }
      case 'phase': {
        const el = ev.el as ElementId;
        banner(t('boss.phase', { n: ev.phase, element: t(`element.${el}`) }), 'phase', 5000);
        play('phase');
        break;
      }
      case 'telegraph':
        pendingTelegraphs.add(ev.zone);
        break;
      case 'death':
        if (ev.id === v?.ownId) play('death');
        break;
      case 'revive':
        if (ev.id === v?.ownId) play('revive');
        break;
      case 'potion':
        if (ev.id === v?.ownId) play('potion');
        break;
      case 'roll':
        if (ev.id === v?.ownId) play('roll');
        break;
      case 'swap':
        if (ev.id === v?.ownId) play('swap');
        break;
      case 'hit':
        if (ev.src === v?.ownId || ev.dst === v?.ownId) play(ev.crit ? 'crit' : ev.el && ev.el !== 'physisch' ? 'hitElement' : 'hit');
        break;
      case 'heal':
        if (ev.dst === v?.ownId && ev.amount >= 1) play('heal');
        break;
      case 'ping':
        play('ping');
        break;
      case 'stage':
        if (ev.phase === 'countdown') showBossDialog('before');
        break;
      case 'bossDefeated':
        play('victory');
        break;
      default:
        break;
    }
  }
}

function nameOfHero(heroId: number): string {
  const r = view?.start.roster.find((x) => x.heroId === heroId);
  return r?.name ?? '';
}

function showBossDialog(which: 'before' | 'after'): void {
  const v = view;
  const bossId = v?.start.config.bossId;
  if (!v || !bossId) return;
  const c = content();
  const b = c.bossById[bossId as BossId];
  const key = b.dialog[which];
  const lines = storyLines(c, b.chapter, key);
  if (lines.length > 0) story.set({ title: b.name, lines, textId: key });
}

function showIntro(stage: number): void {
  const c = content();
  const def = c.stages[stage - 1];
  if (!def) return;
  const text = c.story[def.chapter - 1]?.stageIntros[def.introId];
  if (!text) return;
  story.set({ title: t('stageSelect.stage', { chapter: def.chapter, index: ((stage - 1) % 5) + 1 }), lines: [{ speaker: '', text }], textId: def.introId });
}

function onSnapshot(): void {
  const v = view;
  if (!v) return;
  if (pendingTelegraphs.size > 0) {
    for (const z of v.zones) {
      if (pendingTelegraphs.has(z.z.id)) {
        pendingTelegraphs.delete(z.z.id);
        if (z.z.hostile) play('telegraph');
      }
    }
    pendingTelegraphs.clear();
  }
  hud.set(deriveHud(v));
}

// ---------- Nachrichten ----------

async function onWelcome(m: Extract<ServerMsg, { t: 'welcome' }>): Promise<void> {
  serverOffset = m.serverTime - Date.now();
  if (m.contentHash !== contentHash()) {
    try {
      await loadGameContent();
    } catch {
      toast(t('error.versionMismatch'), 'error', 10_000);
    }
  }
  const s = heroState.get();
  if (s && s.hero.id !== m.heroId) {
    heroState.set(await api.state(m.heroId));
  }
}

function onMessage(m: ServerMsg): void {
  switch (m.t) {
    case 'welcome':
      void onWelcome(m);
      break;
    case 'presence':
      presence.set(m.list);
      break;
    case 'party.state':
      party.set(m);
      break;
    case 'party.invited':
      invites.set((l) => [...l.filter((x) => x.inviteId !== m.inviteId), { inviteId: m.inviteId, from: m.from, fromAccountId: m.fromAccountId, expiresAt: Date.now() + m.expiresIn }]);
      play('ping');
      break;
    case 'party.left':
      party.set(null);
      break;
    case 'run.start': {
      const fresh = !view || view.start.runId !== m.runId;
      if (fresh) {
        const c = content();
        view = new RunView(m, c.engine.world.bandDepthPx, c.balance.movement.manual, c.balance.combat.roll.px, c.balance.combat.roll.invulnMs);
        events = [];
        loot.set(null);
        showIntro(m.stage);
      } else {
        view = new RunView(m, view!.bandDepth, view!.moveSpeed, view!.rollPx, view!.rollMs);
      }
      screen.set('run');
      break;
    }
    case 'run.snapshot':
      if (view) {
        view.onSnapshot(m, performance.now(), net.status.get().rtt ?? 0);
        onSnapshot();
      }
      break;
    case 'run.events':
      events.push(...m.list);
      onRunEvents(m.list);
      break;
    case 'run.loot':
      for (const it of m.loot.items) {
        toast(`${t('loot.newItem')}: ${it.name}`, 'loot');
        play(it.rarity === 'legendaer' ? 'legendary' : 'loot');
      }
      break;
    case 'run.end': {
      const bossStage = !!view?.start.config.bossId;
      view = null;
      hud.set(null);
      controls.releaseAll();
      void refreshHero();
      if (m.result === 'win') {
        loot.set(m);
        screen.set('loot');
        if (bossStage) showBossDialog('after');
        play(m.loot.some((i) => i.rarity === 'legendaer') ? 'legendary' : 'victory');
      } else {
        if (m.xp > 0 || m.loot.length > 0) loot.set(m);
        screen.set(m.xp > 0 || m.loot.length > 0 ? 'loot' : 'camp');
      }
      break;
    }
    case 'run.closed':
      view = null;
      hud.set(null);
      controls.releaseAll();
      toast(t(`hud.closed_${m.reason}`), 'info', 5000);
      if (screen.get() === 'run') screen.set('camp');
      void refreshHero();
      break;
    case 'chat':
      chat.set((l) => [...l.slice(-49), { id: nextId++, from: m.from, name: m.name, text: m.text }]);
      break;
    case 'error':
      play('error');
      toast(m.message, 'error');
      break;
    default:
      break;
  }
}

net.on(onMessage);

// Für Tests (Playwright) und Fehlersuche: Blick in den Zustand, ohne ihn zu ändern
(globalThis as { __aethra?: unknown }).__aethra = { view: () => view, hud: () => hud.get(), screen: () => screen.get() };
