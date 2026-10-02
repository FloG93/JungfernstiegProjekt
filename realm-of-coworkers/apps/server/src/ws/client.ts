// Eine WebSocket-Verbindung (15.3). Der Zustand eines Spielers hängt am Konto, nicht an der Verbindung (11.9).
import type { ServerMsg } from '@aethra/shared';

/** Minimale Schnittstelle eines Sockets (ws im Betrieb, Attrappe in Tests). */
export interface Sock {
  send(data: string): void;
  close(code: number, reason: string): void;
}

export const CLOSE_PROTOCOL = 4001;
export const CLOSE_REPLACED = 4002;
export const CLOSE_SHUTDOWN = 1001;

export class Client {
  heroId: number | null = null;
  hello = false;
  closed = false;
  lastActiveAt: number;
  /** Nachrichten eines Clients laufen nacheinander, auch wenn eine davon auf die Datenbank wartet. */
  queue: Promise<void> = Promise.resolve();
  bytesOut = 0;
  msgsOut = 0;

  constructor(
    readonly id: number,
    readonly accountId: number,
    readonly username: string,
    private readonly sock: Sock,
    now: number,
  ) {
    this.lastActiveAt = now;
  }

  send(msg: ServerMsg): void {
    this.sendRaw(JSON.stringify(msg));
  }

  sendRaw(data: string): void {
    if (this.closed) return;
    this.bytesOut += data.length;
    this.msgsOut++;
    try {
      this.sock.send(data);
    } catch {
      // Verbindung ist bereits geschlossen; das close-Ereignis räumt auf
    }
  }

  close(code: number, reason: string): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.sock.close(code, reason);
    } catch {
      // bereits geschlossen
    }
  }
}
