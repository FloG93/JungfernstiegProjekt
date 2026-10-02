// WebSocket zum Server (15.3): hello, Wiederverbinden mit Wartezeit (14.10), Rundlaufzeit aus den Bestätigungen.
import { PROTOCOL_VERSION } from '@aethra/shared';
import type { ClientMsg, ServerMsg } from '@aethra/shared';
import { Store } from './store';

export type NetState = 'off' | 'connecting' | 'online' | 'lost' | 'replaced' | 'outdated';

export interface NetStatus {
  state: NetState;
  /** Zeitpunkt des Verbindungsverlusts (Date.now). */
  lostAt: number | null;
  /** Nächster Verbindungsversuch (Date.now). */
  retryAt: number | null;
  /** Geglättete Rundlaufzeit in ms. */
  rtt: number | null;
}

const RETRY_MS = [1000, 2000, 3000, 5000];
const CLOSE_PROTOCOL = 4001;
const CLOSE_REPLACED = 4002;
const RTT_SMOOTH = 0.2;

type Handler = (m: ServerMsg) => void;

export class Net {
  readonly status = new Store<NetStatus>({ state: 'off', lostAt: null, retryAt: null, rtt: null });
  private ws: WebSocket | null = null;
  private heroId = 0;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly handlers = new Set<Handler>();
  private readonly sentAt = new Map<number, number>();
  private wanted = false;

  on(h: Handler): () => void {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }

  connect(heroId: number): void {
    this.heroId = heroId;
    this.wanted = true;
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) {
      // Anderer Held: erneut anmelden
      if (this.ws.readyState === WebSocket.OPEN) this.sendRaw({ t: 'hello', v: PROTOCOL_VERSION, heroId });
      return;
    }
    this.open();
  }

  disconnect(): void {
    this.wanted = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.ws?.close(1000, 'bye');
    this.ws = null;
    this.status.patch({ state: 'off', lostAt: null, retryAt: null });
  }

  /** Sofort neu verbinden (Schaltfläche „Erneut versuchen“). */
  retryNow(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.wanted = true;
    this.open();
  }

  private open(): void {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    if (this.status.get().state !== 'lost') this.status.patch({ state: 'connecting' });
    ws.onopen = () => {
      this.sendRaw({ t: 'hello', v: PROTOCOL_VERSION, heroId: this.heroId });
    };
    ws.onmessage = (e: MessageEvent<string>) => {
      let m: ServerMsg;
      try {
        m = JSON.parse(e.data) as ServerMsg;
      } catch {
        return;
      }
      if (m.t === 'welcome') {
        this.attempt = 0;
        this.status.patch({ state: 'online', lostAt: null, retryAt: null });
      } else if (m.t === 'run.ack') {
        this.measure(m.seq);
      }
      for (const h of [...this.handlers]) h(m);
    };
    ws.onclose = (e: CloseEvent) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (e.code === CLOSE_PROTOCOL) {
        this.wanted = false;
        this.status.patch({ state: 'outdated' });
        return;
      }
      if (e.code === CLOSE_REPLACED) {
        this.wanted = false;
        this.status.patch({ state: 'replaced' });
        return;
      }
      if (!this.wanted) return;
      const delay = RETRY_MS[Math.min(this.attempt, RETRY_MS.length - 1)]!;
      this.attempt++;
      const st = this.status.get();
      this.status.patch({ state: 'lost', lostAt: st.lostAt ?? Date.now(), retryAt: Date.now() + delay });
      this.timer = setTimeout(() => {
        this.timer = null;
        if (this.wanted) this.open();
      }, delay);
    };
  }

  private measure(seq: number): void {
    const at = this.sentAt.get(seq);
    if (at === undefined) return;
    for (const k of [...this.sentAt.keys()]) if (k <= seq) this.sentAt.delete(k);
    const rtt = performance.now() - at;
    const old = this.status.get().rtt;
    this.status.patch({ rtt: old === null ? rtt : old + (rtt - old) * RTT_SMOOTH });
  }

  private sendRaw(m: ClientMsg): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(m));
    return true;
  }

  send(m: ClientMsg): boolean {
    if (m.t === 'run.input') this.sentAt.set(m.seq, performance.now());
    return this.sendRaw(m);
  }
}

export const net = new Net();
