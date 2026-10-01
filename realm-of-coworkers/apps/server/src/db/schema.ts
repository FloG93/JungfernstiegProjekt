// Tabellen der Datenbank (15.1). Zeiten in UTC-Millisekunden, JSON-Spalten als Text.
import type { Generated } from 'kysely';

export interface AccountsTable {
  id: Generated<number>;
  username: string;
  pw_hash: string;
  created_at: number;
  last_login: number | null;
}

export interface SessionsTable {
  token_hash: string;
  account_id: number;
  created_at: number;
  expires_at: number;
}

export interface HeroesTable {
  id: Generated<number>;
  account_id: number;
  name: string;
  class: string;
  appearance: string;
  level: number;
  xp: number;
  gold: number;
  splinters: number;
  active_set: 'A' | 'B';
  autocast: string;
  /** Ergänzung (E-023): Auto-Trank, Auto-Ausweichen, Auto-Weiter. */
  settings: string;
  created_at: number;
}

export interface ItemsTable {
  id: Generated<number>;
  hero_id: number;
  slot: string;
  ilvl: number;
  rarity: string;
  budget: number;
  stats: string;
  ele: number;
  name: string;
  element: string | null;
  weapon_level: number;
  weapon_xp: number;
  enchants: string;
  effect_id: string | null;
  equip_slot: string | null;
  stash: number;
  locked: number;
  created_at: number;
}

export interface GemsTable {
  id: Generated<number>;
  hero_id: number;
  kind: string;
  tier: number;
  socket: number | null;
}

export interface ArtifactsTable {
  hero_id: number;
  slot: string;
  rank: number;
}

export interface BossStateTable {
  hero_id: number;
  boss_id: string;
  first_kill_at: number | null;
  last_kill_at: number | null;
  kampfstufe: number;
}

export interface StageProgressTable {
  hero_id: number;
  stage: number;
  clears: number;
  best_time_ms: number | null;
}

export interface StorySeenTable {
  hero_id: number;
  text_id: string;
}

export interface RunLogTable {
  id: Generated<number>;
  seed: number;
  party: string;
  stage: number;
  started_at: number;
  ended_at: number | null;
  result: string | null;
  events: Buffer | null;
}

export interface DB {
  accounts: AccountsTable;
  sessions: SessionsTable;
  heroes: HeroesTable;
  items: ItemsTable;
  gems: GemsTable;
  artifacts: ArtifactsTable;
  boss_state: BossStateTable;
  stage_progress: StageProgressTable;
  story_seen: StorySeenTable;
  run_log: RunLogTable;
}
