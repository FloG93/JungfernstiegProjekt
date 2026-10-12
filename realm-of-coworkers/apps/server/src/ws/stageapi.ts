// Gemeinsame Schnittstelle der laufenden Stage (2.3). Gateway, Lobby und Party sprechen nur hierüber,
// damit Echtzeitkampf (run.ts) und Rundenkampf (rundenlauf.ts) nebeneinander laufen können (OPEN-053).
import type { ClientMsg } from '@aethra/shared';
import type { Party } from './party';
import type { RunPlayer } from './spieler';

export type EndReason = 'win' | 'camp' | 'empty' | 'pause' | 'server' | 'left';

/** Nachrichten des Spielers, die zur laufenden Stage gehören. */
export type LaufMsg = Exclude<Extract<ClientMsg, { t: `run.${string}` | `runde.${string}` }>, { t: 'run.next' }>;

export interface LaufendeStage {
  readonly id: string;
  readonly stage: number;
  readonly seed: number;
  readonly party: Party;
  readonly players: Map<number, RunPlayer>;
  /** Boss-Arena: für die Online-Liste (11.1). */
  readonly inArena: boolean;
  /** Vergangene Spielzeit in ms (Protokoll, Bestzeit). */
  readonly zeitMs: number;
  ended: boolean;
  nextTickAt: number;
  open(): Promise<void>;
  tick(now: number): void;
  end(reason: EndReason): Promise<void>;
  hasHero(heroId: number): boolean;
  connect(accountId: number): void;
  disconnect(accountId: number): void;
  leave(accountId: number, why?: 'left' | 'kick'): void;
  rejoin(accountId: number, on: boolean): void;
  applySettings(accountId: number, s: { autocast?: Record<string, boolean>; autoPotion?: boolean; autoDodge?: boolean }): void;
  /** Eine Nachricht des Spielers; jede Kampfart kennt ihre eigenen und weist fremde ab. */
  nachricht(accountId: number, m: LaufMsg): void;
}
