// Was Runs und Lobby vom Gateway brauchen (2.3).
import type { FastifyBaseLogger } from 'fastify';
import type { AppCtx } from '../context';
import type { Client } from './client';
import type { Party } from './party';
import type { EndReason, RunInstance } from './run';

export interface HubApi {
  readonly ctx: AppCtx;
  readonly log: FastifyBaseLogger;
  now(): number;
  /** Verbundener und angemeldeter Client eines Kontos, sonst undefined. */
  client(accountId: number): Client | undefined;
  runEnded(run: RunInstance, reason: EndReason, next: number | null): void;
  partyChanged(party: Party): void;
  /** Werte eines Helden haben sich geändert (Stufe, Beute, Abschluss). */
  heroChanged(heroId: number): void;
  /** Lädt die Angaben eines Helden neu (Party, Online-Liste). */
  refreshInfo(heroId: number): Promise<unknown>;
}
