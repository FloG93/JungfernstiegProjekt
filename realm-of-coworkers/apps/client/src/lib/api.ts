// HTTP-Schnittstelle (15.2). Fehler kommen als ApiError mit Code und Text vom Server.
import type {
  Appearance, ArtifactSlot, BossBoardEntry, ClassId, ElementId, EquipSlot, GemDTO, GemId, HeroStateDTO,
  HeroSummaryDTO, MeDTO, OnlineEntry,
} from '@aethra/shared';
import { t } from './i18n';

export class ApiError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'content-type': 'application/json' } : {},
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError('OFFLINE', t('error.connectionPoor'));
  }
  let j: { ok: boolean; data?: T; error?: { code: string; message: string } };
  try {
    j = (await r.json()) as typeof j;
  } catch {
    throw new ApiError('CONFLICT', t('error.CONFLICT'));
  }
  if (!j.ok) throw new ApiError(j.error?.code ?? 'CONFLICT', j.error?.message ?? t('error.CONFLICT'));
  return j.data as T;
}

export interface Mutation<R = unknown> {
  result: R;
  state: HeroStateDTO;
}

const hero = (id: number) => `/api/heroes/${id}`;
const post = <R>(id: number, path: string, body: unknown) => call<Mutation<R>>('POST', `${hero(id)}/${path}`, body);

export const api = {
  register: (username: string, password: string, inviteCode: string) => call<MeDTO>('POST', '/api/register', { username, password, inviteCode }),
  login: (username: string, password: string) => call<MeDTO>('POST', '/api/login', { username, password }),
  logout: () => call<object>('POST', '/api/logout', {}),
  me: () => call<MeDTO>('GET', '/api/me'),
  heroes: () => call<HeroSummaryDTO[]>('GET', '/api/heroes'),
  createHero: (name: string, classId: ClassId, appearance: Appearance) => call<HeroSummaryDTO>('POST', '/api/heroes', { name, classId, appearance }),
  deleteHero: (id: number, confirmName: string) => call<object>('DELETE', hero(id), { confirmName }),
  state: (id: number) => call<HeroStateDTO>('GET', hero(id)),
  appearance: (id: number, appearance: Appearance) => call<object>('PUT', `${hero(id)}/appearance`, { appearance }),
  settings: (id: number, s: { autocast?: Record<string, boolean>; autoPotion?: boolean; autoDodge?: boolean; autoContinue?: boolean; activeSet?: 'A' | 'B' }) =>
    call<object>('PUT', `${hero(id)}/settings`, s),
  equip: (id: number, itemId: number, equipSlot?: EquipSlot) => post(id, 'equip', equipSlot ? { itemId, equipSlot } : { itemId }),
  unequip: (id: number, equipSlot: EquipSlot) => post(id, 'unequip', { equipSlot }),
  sell: (id: number, itemIds: number[], confirm = false) => post<{ sold: number[]; gold: number }>(id, 'sell', { itemIds, confirm }),
  lock: (id: number, itemId: number, locked: boolean) => post(id, `items/${itemId}/lock`, { locked }),
  stash: (id: number, itemId: number, stash: boolean) => post(id, `items/${itemId}/stash`, { stash }),
  socket: (id: number, gemId: number, socket: number) => post(id, 'gems/socket', { gemId, socket }),
  unsocket: (id: number, socket: number) => post(id, 'gems/unsocket', { socket }),
  combine: (id: number, kind: GemId, tier: number) => post<GemDTO>(id, 'gems/combine', { kind, tier }),
  swapGem: (id: number, gemId: number, kind: GemId) => post(id, 'gems/swap', { gemId, kind }),
  element: (id: number, itemId: number, element: ElementId) => post(id, 'weapons/element', { itemId, element }),
  transfer: (id: number, fromItemId: number, toItemId: number) => post(id, 'weapons/transfer', { fromItemId, toItemId }),
  enchant: (id: number, itemId: number, line: number, action: 'rank' | 'type', type?: string) =>
    post(id, 'weapons/enchant', type ? { itemId, line, action, type } : { itemId, line, action }),
  upgradeArtifact: (id: number, slot: ArtifactSlot) => post(id, 'artifacts/upgrade', { slot }),
  storySeen: (id: number, textId: string) => call<object>('POST', `${hero(id)}/story/seen`, { textId }),
  bosses: (id: number) => call<BossBoardEntry[]>('GET', `${hero(id)}/bosses`),
  online: () => call<OnlineEntry[]>('GET', '/api/online'),
};
