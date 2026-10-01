// HTTP-Schnittstelle (15.2): Anfragen als Zod-Schemas, Antworten als Typen. Client und Server teilen sie.
import { z } from 'zod';
import { ARTIFACT_SLOTS, CLASS_IDS, ELEMENT_IDS, EQUIP_SLOTS, GEM_IDS } from './content/ids';
import type {
  ArtifactSlot, BossId, ClassId, ElementId, EquipSlot, GemId, RarityId, SlotId,
} from './content/ids';
import type { StatBlock } from './stats';

export const ERROR_CODES = [
  'BAD_REQUEST', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'HERO_IN_RUN', 'NOT_ENOUGH_GOLD',
  'NOT_ENOUGH_SPLINTERS', 'INVENTORY_FULL', 'REQUIREMENT_NOT_MET', 'NAME_TAKEN', 'RATE_LIMITED', 'SERVER_BUSY',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string } };

const id = z.number().int().positive();
const str = (max: number) => z.string().max(max);

export const RegisterReq = z.strictObject({ username: str(64), password: str(200), inviteCode: str(200) });
export const LoginReq = z.strictObject({ username: str(64), password: str(200) });

export const AppearanceSchema = z.strictObject({
  body: z.number().int().min(0).max(31),
  portrait: z.number().int().min(0).max(31),
  palette: z.number().int().min(0).max(31),
});
export type Appearance = z.infer<typeof AppearanceSchema>;

export const CreateHeroReq = z.strictObject({ name: str(64), classId: z.enum(CLASS_IDS), appearance: AppearanceSchema });
export const DeleteHeroReq = z.strictObject({ confirmName: str(64) });
export const AppearanceReq = z.strictObject({ appearance: AppearanceSchema });
export const EquipReq = z.strictObject({ itemId: id, equipSlot: z.enum(EQUIP_SLOTS).optional() });
export const UnequipReq = z.strictObject({ equipSlot: z.enum(EQUIP_SLOTS) });
export const SellReq = z.strictObject({ itemIds: z.array(id).min(1).max(200), confirm: z.boolean().optional() });
export const LockReq = z.strictObject({ locked: z.boolean() });
export const StashReq = z.strictObject({ stash: z.boolean() });
export const SocketReq = z.strictObject({ gemId: id, socket: z.number().int().min(0).max(8) });
export const UnsocketReq = z.strictObject({ socket: z.number().int().min(0).max(8) });
export const CombineReq = z.strictObject({ kind: z.enum(GEM_IDS), tier: z.number().int().min(1).max(4) });
export const SwapGemReq = z.strictObject({ gemId: id, kind: z.enum(GEM_IDS) });
export const ElementReq = z.strictObject({ itemId: id, element: z.enum(ELEMENT_IDS) });
export const TransferReq = z.strictObject({ fromItemId: id, toItemId: id });
export const ENCHANT_IDS = ['waffenschaden', 'kraft', 'kritschaden', 'tempo', 'vitalitaet', 'panzerung'] as const;
export const EnchantReq = z.strictObject({
  itemId: id,
  line: z.number().int().min(0).max(2),
  action: z.enum(['rank', 'type']),
  type: z.enum(ENCHANT_IDS).optional(),
});
export const ArtifactUpgradeReq = z.strictObject({ slot: z.enum(ARTIFACT_SLOTS) });
export const SettingsReq = z.strictObject({
  autocast: z.record(z.string().max(64), z.boolean()).optional(),
  autoPotion: z.boolean().optional(),
  autoDodge: z.boolean().optional(),
  autoContinue: z.boolean().optional(),
  activeSet: z.enum(['A', 'B']).optional(),
});
export const StorySeenReq = z.strictObject({ textId: str(64) });

export interface HeroSettings {
  autoPotion: boolean;
  autoDodge: boolean;
  autoContinue: boolean;
}

export interface ItemDTO {
  id: number;
  slot: SlotId;
  ilvl: number;
  rarity: RarityId;
  budget: number;
  stats: Record<'leb' | 'kra' | 'rue' | 'res' | 'tmp' | 'krt', number>;
  ele: number;
  name: string;
  element: ElementId | null;
  weaponLevel: number;
  weaponXp: number;
  enchants: { id: (typeof ENCHANT_IDS)[number]; rank: number }[];
  effectId: BossId | null;
  equipSlot: EquipSlot | null;
  stash: boolean;
  locked: boolean;
  requirement: number;
  sellPrice: number;
}

export interface GemDTO {
  id: number;
  kind: GemId;
  tier: number;
  socket: number | null;
}

export interface ArtifactDTO {
  slot: ArtifactSlot;
  id: string;
  name: string;
  rank: number;
  unlocked: boolean;
}

export interface BossBoardEntry {
  bossId: BossId;
  name: string;
  chapter: number;
  defeated: boolean;
  /** Zeitpunkt, ab dem der Boss wieder Beute gibt (null: offen oder bereit). */
  readyAt: number | null;
  kampfstufe: number;
  phases: { element: ElementId; weakTo: ElementId | null }[];
}

export interface HeroSummaryDTO {
  id: number;
  name: string;
  classId: ClassId;
  level: number;
  appearance: Appearance;
}

export interface HeroStateDTO {
  hero: HeroSummaryDTO & {
    xp: number;
    xpToNext: number;
    gold: number;
    splinters: number;
    activeSet: 'A' | 'B';
    autocast: Record<string, boolean>;
    settings: HeroSettings;
  };
  /** Werte je Waffensatz mit Obergrenzen (5.5). */
  stats: { A: StatBlock; B: StatBlock };
  equipped: Partial<Record<EquipSlot, ItemDTO>>;
  inventory: ItemDTO[];
  stash: ItemDTO[];
  gems: GemDTO[];
  freeSockets: number;
  artifacts: ArtifactDTO[];
  bosses: BossBoardEntry[];
  cleared: { stage: number; clears: number; bestTimeMs: number | null }[];
  unlockedStages: number[];
  storySeen: string[];
  inRun: boolean;
}

export interface MeDTO {
  accountId: number;
  username: string;
}

export interface OnlineEntry {
  accountId: number;
  username: string;
  heroName: string | null;
  classId: ClassId | null;
  level: number | null;
  status: 'lager' | 'stage' | 'boss' | 'abwesend';
  stage?: number;
}

/** Ergebnis eines Verkaufs oder automatischen Verkaufs (8.9). */
export interface SellResultDTO {
  sold: number[];
  gold: number;
}
