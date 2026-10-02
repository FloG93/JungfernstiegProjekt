// WebSocket-Protokoll (15.3, 15.4). Jede Nachricht ist JSON mit `t`. Client → Server wird mit Zod geprüft.
import { z } from 'zod';
import type { ClassId, ElementId, StatusId } from './content/ids';
import type { GemDrop } from './loot';
import type { GameEvent, StagePhase, UnitKind, UnitState } from './sim/types';
import type { ItemDTO, OnlineEntry } from './api';

const MAX_TEXT = 500;
const coord = z.number().finite().min(-100_000).max(100_000);

export const HeroActionSchema = z.discriminatedUnion('k', [
  z.strictObject({ k: z.literal('skill'), id: z.string().max(64), target: z.number().int().optional(), x: coord.optional(), y: coord.optional() }),
  z.strictObject({ k: z.literal('roll') }),
  z.strictObject({ k: z.literal('swap') }),
  z.strictObject({ k: z.literal('potion') }),
  z.strictObject({ k: z.literal('focus'), targetId: z.number().int().nullable() }),
  z.strictObject({ k: z.literal('revive'), targetId: z.number().int() }),
]);

export const ClientMsgSchema = z.discriminatedUnion('t', [
  z.strictObject({ t: z.literal('hello'), v: z.number().int(), heroId: z.number().int().positive() }),
  z.strictObject({ t: z.literal('party.create') }),
  z.strictObject({ t: z.literal('party.join'), code: z.string().max(16) }),
  z.strictObject({ t: z.literal('party.invite'), targetAccountId: z.number().int().positive() }),
  z.strictObject({ t: z.literal('party.answer'), inviteId: z.string().max(64), accept: z.boolean() }),
  z.strictObject({ t: z.literal('party.leave') }),
  z.strictObject({ t: z.literal('party.kick'), targetAccountId: z.number().int().positive() }),
  z.strictObject({ t: z.literal('party.setStage'), stage: z.number().int().min(1).max(30) }),
  z.strictObject({ t: z.literal('party.ready'), ready: z.boolean() }),
  z.strictObject({ t: z.literal('party.start') }),
  z.strictObject({ t: z.literal('party.chat'), text: z.string().max(MAX_TEXT) }),
  /** Ergänzung (E-023): Auto-Weiter für die Party (Anführer). */
  z.strictObject({ t: z.literal('party.autoContinue'), on: z.boolean() }),
  z.strictObject({
    t: z.literal('run.input'), seq: z.number().int().min(0), mx: z.number().min(-1).max(1), my: z.number().min(-1).max(1),
    tx: coord.optional(), ty: coord.optional(), act: z.array(HeroActionSchema).max(8).optional(),
  }),
  z.strictObject({ t: z.literal('run.autocast'), skillId: z.string().max(64), on: z.boolean() }),
  z.strictObject({ t: z.literal('run.settings'), autoPotion: z.boolean().optional(), autoDodge: z.boolean().optional() }),
  z.strictObject({ t: z.literal('run.ping'), kind: z.enum(['hint', 'danger', 'help']), x: coord, y: coord }),
  z.strictObject({ t: z.literal('run.autowalk'), on: z.boolean() }),
  z.strictObject({ t: z.literal('run.pause'), on: z.boolean() }),
  z.strictObject({ t: z.literal('run.ready') }),
  z.strictObject({ t: z.literal('run.leave') }),
  /** Ergänzung (11.5): nach Entfernung oder Verlassen am nächsten Checkpoint bzw. Boss-Tor wieder einsteigen. */
  z.strictObject({ t: z.literal('run.rejoin'), on: z.boolean() }),
  /** Nach dem Beute-Bildschirm: nächste Stage (oder eine bestimmte) bzw. zurück ins Lager (9.1). */
  z.strictObject({ t: z.literal('run.next'), stage: z.number().int().min(1).max(30).nullable() }),
]);
export type ClientMsg = z.infer<typeof ClientMsgSchema>;

// ---------- Server → Client ----------

export interface PartyMemberDTO {
  accountId: number;
  username: string;
  heroId: number | null;
  heroName: string | null;
  classId: ClassId | null;
  level: number | null;
  element: ElementId | null;
  ready: boolean;
  connected: boolean;
  /** Stage für dieses Mitglied freigeschaltet bzw. per Nachzügler-Regel erlaubt (3.4). */
  allowed: boolean;
  /** Boss: Helfer-Modus, weil der Timer noch läuft (10.9). */
  helper: boolean;
  /** Held steckt gerade im laufenden Run der Party. */
  inRun: boolean;
  /** Wartet auf den Wiedereinstieg am nächsten Checkpoint bzw. Boss-Tor (11.5). */
  rejoin: boolean;
}

export interface PartyStateDTO {
  t: 'party.state';
  id: string;
  code: string;
  leader: number;
  members: PartyMemberDTO[];
  stage: number | null;
  /** Stages, die der Anführer wählen kann (für mindestens ein Mitglied frei, 11.2). */
  choices: number[];
  startsAt: number | null;
  inRun: boolean;
  autoContinue: boolean;
}

export interface EntityMeta {
  name?: string;
  cls?: ClassId;
  acc?: number;
  type?: string;
  elite?: boolean;
  affix?: string;
  boss?: string;
  level?: number;
  /** Aussehen eines Helden: Körperform und Farbpalette (4.1). */
  look?: [number, number];
}

/** Einheit im Snapshot (15.4); `meta` nur beim ersten Auftauchen und in vollständigen Snapshots. */
export interface SnapEntity {
  id: number;
  kind: UnitKind | 'proj';
  x: number;
  y: number;
  face: -1 | 1;
  hp: number;
  maxHp: number;
  shield?: number;
  state: UnitState;
  fx?: { id: StatusId | string; stacks: number; ms: number }[];
  el?: ElementId;
  cd?: Record<string, number>;
  meta?: EntityMeta;
}

export interface SnapZone {
  id: number;
  shape: 'circle' | 'line' | 'cone';
  x: number;
  y: number;
  w: number;
  h: number;
  ang?: number;
  /** Restzeit in ms bis zur Auslösung bzw. zum Ende. */
  endsIn: number;
  total: number;
  kind: 'telegraph' | 'hazard' | 'aura' | 'trap';
  label?: string;
  /** Feindlich für Helden (rot) oder eigene Fläche (Falle, Kataklysmus). */
  hostile: boolean;
}

export interface RunStateDTO {
  phase: StagePhase;
  anchorX: number;
  cameraX: number;
  arena: boolean;
  worldWidth: number;
  encounter: number;
  encounters: number;
  checkpoint: number;
  autowalk: boolean;
  paused: boolean;
  countdownEndsIn: number | null;
  bossId: string | null;
  bossPhase: number;
  enrageIn: number | null;
  wipes: number;
  /** Kampfstufe des Bosskampfes (10.9). */
  kampfstufe: number;
  /** Konten, die am Boss-Tor „Bereit“ bestätigt haben (10.1). */
  ready: number[];
  /** Auto-Weiter: Restzeit bis zur automatischen Bereitschaft am Boss-Tor (E-023). */
  autoReadyIn: number | null;
  /** Eigener Held: Tränke, Rolle, Wechsel, Fokus (nur für den Empfänger). */
  me?: {
    unitId: number;
    potions: number;
    potionCd: number;
    rollCd: number;
    swapCd: number;
    activeSet: 'A' | 'B';
    setElements: { A: ElementId; B: ElementId | null };
    autocast: Record<string, boolean>;
    autoPotion: boolean;
    autoDodge: boolean;
    focusId: number | null;
    helper: boolean;
    reviveDoneIn: number | null;
    /** Autopilot (2.4, 11.3): nur Automatikangriff, bis der Spieler eingreift. */
    autopilot: boolean;
  };
}

export interface SnapshotMsg {
  t: 'run.snapshot';
  tick: number;
  full: boolean;
  ents: SnapEntity[];
  rm: number[];
  zones: SnapZone[];
  run: RunStateDTO;
}

export interface RosterEntry {
  unitId: number;
  accountId: number;
  heroId: number;
  name: string;
  classId: ClassId;
  level: number;
  helper: boolean;
}

export interface RunStartMsg {
  t: 'run.start';
  runId: string;
  seed: number;
  stage: number;
  roster: RosterEntry[];
  n: number;
  config: { tickMs: number; snapshotEveryTicks: number; introId: string; bossId: string | null };
}

export interface LootEntry {
  items: ItemDTO[];
  gems: GemDrop[];
  splinters: number;
  autoSold: { name: string; gold: number }[];
}

export interface RunEndMsg {
  t: 'run.end';
  result: 'win' | 'abort';
  stage: number;
  xp: number;
  weaponXp: number;
  gold: number;
  loot: ItemDTO[];
  gems: GemDrop[];
  splinters: number;
  levelUps: number[];
  weaponLevelUps: number[];
  autoSold: { name: string; gold: number }[];
  artifactUnlocked: string | null;
  helper: boolean;
  firstClear: boolean;
  timeMs: number;
  /** Nächste Stage, die der Anführer starten kann (Weiter), sonst null. */
  next: number | null;
  autoContinueIn: number | null;
}

export type ServerMsg =
  | { t: 'welcome'; v: number; serverTime: number; contentHash: string; accountId: number; heroId: number; reconnected: boolean }
  | { t: 'presence'; list: OnlineEntry[] }
  | PartyStateDTO
  | { t: 'party.invited'; inviteId: string; from: string; fromAccountId: number; expiresIn: number }
  | { t: 'party.left' }
  | RunStartMsg
  | SnapshotMsg
  | { t: 'run.events'; tick: number; list: GameEvent[] }
  | { t: 'run.ack'; seq: number }
  | RunEndMsg
  | { t: 'run.loot'; loot: LootEntry; source: 'elite' | 'chest' | 'boss' }
  | { t: 'run.closed'; reason: 'camp' | 'empty' | 'pause' | 'server' | 'left' }
  | { t: 'chat'; from: number; name: string; text: string; quick?: boolean }
  | { t: 'error'; code: string; message: string };
