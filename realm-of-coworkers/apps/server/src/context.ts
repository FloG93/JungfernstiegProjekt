// Gemeinsamer Zustand des Servers für HTTP und WebSocket.
import type { Content, OnlineEntry } from '@aethra/shared';
import type { RawContentFiles } from '@aethra/shared/node';
import type { Config } from './config';
import type { Db } from './db/db';
import type { GameCtx } from './game/heroes';
import type { RateLimiter } from './limiter';

export interface AppCtx {
  config: Config;
  content: Content;
  contentFiles: RawContentFiles;
  db: Db;
  game: GameCtx;
  limiter: RateLimiter;
  version: string;
  now: () => number;
  online: () => OnlineEntry[];
  runCount: () => number;
  onSettingsChanged?: (heroId: number, s: { autocast?: Record<string, boolean>; autoPotion?: boolean; autoDodge?: boolean; autoContinue?: boolean }) => void;
  /** Ausrüstung, Stufe oder Fortschritt eines Helden geändert (Party-Anzeige, 11.3). */
  onHeroChanged?: (heroId: number) => void;
  /** Eingabe eines Kontos über HTTP (Abwesend-Status, 11.1). */
  onActivity?: (accountId: number) => void;
}
