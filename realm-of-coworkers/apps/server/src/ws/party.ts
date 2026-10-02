// Lobby-Service (2.3, 11.1 bis 11.3): Parties, Codes, Einladungen, Stage-Wahl, Bereit, Start, Chat, Auto-Weiter.
import { randomInt, randomUUID } from 'node:crypto';
import type { PartyMemberDTO, PartyStateDTO } from '@aethra/shared';
import { heroSetup, setSettings } from '../game/heroes';
import { bossEligibility } from '../game/rewards';
import { fail } from '../http/errors';
import type { Client } from './client';
import { bossStatus, stageAllowed } from './heroinfo';
import type { Hub } from './hub';
import { RunInstance } from './run';
import type { EndReason, RunPlayerInit } from './run';

const MS_PER_S = 1000;

export interface Member {
  accountId: number;
  username: string;
  heroId: number | null;
  ready: boolean;
  joinedAt: number;
  /** Zeitpunkt des Verbindungsverlusts, null wenn verbunden. */
  disconnectedAt: number | null;
}

export class Party {
  readonly members: Member[] = [];
  stage: number | null = null;
  /** Ende des Start-Countdowns (Serverzeit), null ohne Countdown (11.3). */
  startsAt: number | null = null;
  run: RunInstance | null = null;
  launching = false;
  /** Auto-Weiter: Start der nächsten Stage nach dem Beute-Bildschirm (E-023). */
  autoContinueAt: number | null = null;

  constructor(readonly id: string, readonly code: string, public leader: number, public autoContinue: boolean) {}

  member(accountId: number): Member | undefined {
    return this.members.find((m) => m.accountId === accountId);
  }
}

interface Invite {
  id: string;
  partyId: string;
  from: number;
  fromName: string;
  to: number;
  expiresAt: number;
}

export class Lobby {
  readonly parties = new Map<string, Party>();
  private readonly byAccount = new Map<number, Party>();
  private readonly byCode = new Map<string, Party>();
  private readonly invites = new Map<string, Invite>();

  constructor(private readonly hub: Hub) {}

  private get content() {
    return this.hub.ctx.content;
  }

  partyOf(accountId: number): Party | undefined {
    return this.byAccount.get(accountId);
  }

  private own(cl: Client): Party {
    const p = this.byAccount.get(cl.accountId);
    if (!p) fail('CONFLICT', 'Du bist in keiner Party.');
    return p;
  }

  private leaderParty(cl: Client): Party {
    const p = this.own(cl);
    if (p.leader !== cl.accountId) fail('FORBIDDEN', 'Das darf nur der Anführer.');
    return p;
  }

  private newCode(): string {
    const { codeAlphabet, codeLength } = this.content.engine.party;
    for (;;) {
      let code = '';
      for (let i = 0; i < codeLength; i++) code += codeAlphabet[randomInt(codeAlphabet.length)];
      if (!this.byCode.has(code)) return code;
    }
  }

  // ---------- Zustand ----------

  state(p: Party): PartyStateDTO {
    const c = this.content;
    const now = this.hub.now();
    const def = p.stage !== null ? (c.stages[p.stage - 1] ?? null) : null;
    const infos = p.members.map((m) => (m.heroId !== null ? this.hub.info(m.heroId) : undefined));
    const choices = new Set<number>();
    for (const i of infos) if (i) for (const s of i.unlocked) choices.add(s);
    const anyUnlocked = def ? infos.some((i) => i?.unlocked.has(def.stage)) : false;
    const members = p.members.map((m, k): PartyMemberDTO => {
      const i = infos[k];
      const rp = p.run?.players.get(m.accountId);
      return {
        accountId: m.accountId,
        username: m.username,
        heroId: m.heroId,
        heroName: i?.name ?? null,
        classId: i?.classId ?? null,
        level: i?.level ?? null,
        element: i?.element ?? null,
        ready: m.ready,
        connected: !!this.hub.client(m.accountId),
        allowed: !!(def && i && stageAllowed(c, i, def, anyUnlocked)),
        helper: !!(def?.boss && i && !bossStatus(i, def.boss, now).eligible),
        inRun: !!rp && (rp.unitId !== null || rp.joining),
        rejoin: !!rp && rp.unitId === null && rp.wantsRejoin,
      };
    });
    return {
      t: 'party.state', id: p.id, code: p.code, leader: p.leader, members, stage: p.stage,
      choices: [...choices].sort((a, b) => a - b), startsAt: p.startsAt, inRun: !!p.run, autoContinue: p.autoContinue,
    };
  }

  broadcast(p: Party): void {
    if (!this.parties.has(p.id)) return;
    const json = JSON.stringify(this.state(p));
    for (const m of p.members) this.hub.client(m.accountId)?.sendRaw(json);
  }

  // ---------- Mitgliedschaft ----------

  create(cl: Client): Party {
    if (this.byAccount.has(cl.accountId)) fail('CONFLICT', 'Du bist schon in einer Party.');
    const info = cl.heroId !== null ? this.hub.info(cl.heroId) : undefined;
    const p = new Party(randomUUID(), this.newCode(), cl.accountId, info?.autoContinue ?? false);
    this.parties.set(p.id, p);
    this.byCode.set(p.code, p);
    this.addMember(p, cl);
    this.broadcast(p);
    return p;
  }

  private addMember(p: Party, cl: Client): void {
    p.members.push({
      accountId: cl.accountId, username: cl.username, heroId: cl.heroId, ready: false, joinedAt: this.hub.now(), disconnectedAt: null,
    });
    this.byAccount.set(cl.accountId, p);
    // Wer den Run vorher verlassen hat, steigt am nächsten Checkpoint wieder ein (11.5)
    const rp = p.run?.players.get(cl.accountId);
    if (rp && rp.heroId === cl.heroId && rp.unitId === null) p.run!.rejoin(cl.accountId, true);
  }

  private enter(cl: Client, p: Party): void {
    const cur = this.byAccount.get(cl.accountId);
    if (cur === p) return;
    if (p.members.length >= this.content.balance.party.maxSize) fail('CONFLICT', 'Die Party ist voll.');
    if (cur?.run?.players.get(cl.accountId)?.unitId != null) fail('CONFLICT', 'Verlasse zuerst deinen Run.');
    if (cur) this.leave(cl.accountId, 'leave');
    this.addMember(p, cl);
    this.broadcast(p);
  }

  join(cl: Client, code: string): void {
    if (!this.hub.ctx.limiter.allow(`code:${cl.accountId}`, 'partyCode')) fail('RATE_LIMITED', 'Bitte kurz warten.');
    const p = this.byCode.get(code.trim().toUpperCase());
    if (!p) fail('NOT_FOUND', 'Diesen Party-Code gibt es nicht.');
    this.enter(cl, p);
  }

  invite(cl: Client, target: number): void {
    if (target === cl.accountId) fail('BAD_REQUEST', 'Du kannst dich nicht selbst einladen.');
    const to = this.hub.client(target);
    if (!to) fail('NOT_FOUND', 'Dieser Spieler ist nicht online.');
    if (!this.hub.ctx.limiter.allow(`invite:${cl.accountId}`, 'chat')) fail('RATE_LIMITED', 'Bitte kurz warten.');
    const p = this.byAccount.get(cl.accountId) ?? this.create(cl);
    if (p.member(target)) fail('CONFLICT', 'Der Spieler ist schon in deiner Party.');
    if (p.members.length >= this.content.balance.party.maxSize) fail('CONFLICT', 'Die Party ist voll.');
    const ttl = this.content.balance.session.inviteTtlS * MS_PER_S;
    const info = cl.heroId !== null ? this.hub.info(cl.heroId) : undefined;
    const inv: Invite = {
      id: randomUUID(), partyId: p.id, from: cl.accountId, fromName: info?.name ?? cl.username, to: target,
      expiresAt: this.hub.now() + ttl,
    };
    this.invites.set(inv.id, inv);
    to.send({ t: 'party.invited', inviteId: inv.id, from: inv.fromName, fromAccountId: cl.accountId, expiresIn: ttl });
  }

  answer(cl: Client, inviteId: string, accept: boolean): void {
    const inv = this.invites.get(inviteId);
    if (!inv || inv.to !== cl.accountId || inv.expiresAt <= this.hub.now()) fail('NOT_FOUND', 'Die Einladung ist abgelaufen.');
    this.invites.delete(inviteId);
    if (!accept) return;
    const p = this.parties.get(inv.partyId);
    if (!p) fail('NOT_FOUND', 'Diese Party gibt es nicht mehr.');
    this.enter(cl, p);
  }

  /** Verlassen, Entfernen oder Frist abgelaufen. Neuer Anführer: am längsten anwesend (11.2). */
  leave(accountId: number, why: 'leave' | 'kick' | 'timeout'): void {
    const p = this.byAccount.get(accountId);
    if (!p) return;
    if (p.run?.players.has(accountId)) p.run.leave(accountId, why === 'kick' ? 'kick' : 'left');
    const idx = p.members.findIndex((m) => m.accountId === accountId);
    if (idx >= 0) p.members.splice(idx, 1);
    this.byAccount.delete(accountId);
    this.hub.client(accountId)?.send({ t: 'party.left' });
    if (p.members.length === 0) {
      this.dissolve(p);
      return;
    }
    if (p.leader === accountId) {
      p.leader = p.members[0]!.accountId;
      p.startsAt = null;
      p.autoContinueAt = null;
    }
    this.broadcast(p);
  }

  kick(cl: Client, target: number): void {
    const p = this.leaderParty(cl);
    if (target === cl.accountId) fail('BAD_REQUEST', 'Zum Verlassen „Party verlassen“ wählen.');
    if (!p.member(target)) fail('NOT_FOUND', 'Kein Mitglied dieser Party.');
    this.leave(target, 'kick');
  }

  private dissolve(p: Party): void {
    this.parties.delete(p.id);
    this.byCode.delete(p.code);
    for (const inv of [...this.invites.values()]) if (inv.partyId === p.id) this.invites.delete(inv.id);
    if (p.run && !p.run.ended) void p.run.end('empty');
  }

  // ---------- Stage, Bereit, Start ----------

  setStage(cl: Client, stage: number): void {
    const p = this.leaderParty(cl);
    if (p.run || p.launching) fail('CONFLICT', 'Der Run läuft noch.');
    if (!this.state(p).choices.includes(stage)) fail('REQUIREMENT_NOT_MET', 'Diese Stage hat noch niemand in der Party freigeschaltet.');
    p.stage = stage;
    p.startsAt = null;
    p.autoContinueAt = null;
    for (const m of p.members) m.ready = false;
    this.broadcast(p);
  }

  ready(cl: Client, ready: boolean): void {
    const p = this.own(cl);
    const m = p.member(cl.accountId)!;
    m.ready = ready;
    // Sind alle bereit, startet der Countdown (11.3)
    const connected = p.members.filter((x) => this.hub.client(x.accountId));
    if (ready && p.stage !== null && !p.run && p.startsAt === null && connected.length > 0 && connected.every((x) => x.ready)) {
      this.startCountdown(p);
      return;
    }
    this.broadcast(p);
  }

  start(cl: Client): void {
    const p = this.leaderParty(cl);
    if (p.run || p.launching) fail('CONFLICT', 'Der Run läuft schon.');
    if (p.stage === null) fail('BAD_REQUEST', 'Bitte zuerst eine Stage wählen.');
    if (!this.state(p).members.some((m) => m.allowed && m.connected)) fail('REQUIREMENT_NOT_MET', 'Niemand in der Party darf diese Stage betreten.');
    if (this.hub.runCount() >= this.content.balance.net.maxRuns) fail('SERVER_BUSY', 'Server ausgelastet, bitte gleich noch einmal.');
    this.startCountdown(p);
  }

  private startCountdown(p: Party): void {
    p.startsAt = this.hub.now() + this.content.engine.party.startCountdownS * MS_PER_S;
    p.autoContinueAt = null;
    this.broadcast(p);
  }

  /** Nach dem Beute-Bildschirm (9.1): Weiter mit einer Stage oder zurück ins Lager (null). */
  next(cl: Client, stage: number | null): void {
    const p = this.leaderParty(cl);
    if (p.run) fail('CONFLICT', 'Der Run läuft noch.');
    p.autoContinueAt = null;
    if (stage === null) {
      p.startsAt = null;
      this.broadcast(p);
      return;
    }
    this.setStage(cl, stage);
    this.start(cl);
  }

  async setAutoContinue(cl: Client, on: boolean): Promise<void> {
    const p = this.leaderParty(cl);
    p.autoContinue = on;
    if (!on) p.autoContinueAt = null;
    this.broadcast(p);
    if (cl.heroId !== null) await setSettings(this.hub.ctx.game, cl.accountId, cl.heroId, { autoContinue: on });
  }

  chat(cl: Client, text: string): void {
    const p = this.own(cl);
    const t = text.trim();
    if (t.length === 0) return;
    if (t.length > this.content.balance.session.chatMaxLen) fail('BAD_REQUEST', 'Die Nachricht ist zu lang.');
    if (!this.hub.ctx.limiter.allow(`chat:${cl.accountId}`, 'chat')) fail('RATE_LIMITED', 'Eine Nachricht pro Sekunde.');
    const info = cl.heroId !== null ? this.hub.info(cl.heroId) : undefined;
    const json = JSON.stringify({ t: 'chat', from: cl.accountId, name: info?.name ?? cl.username, text: t });
    for (const m of p.members) this.hub.client(m.accountId)?.sendRaw(json);
  }

  // ---------- Run ----------

  /** Countdown abgelaufen: Teilnehmer laden und Run anlegen. Werte gelten ab jetzt (11.3). */
  private async launch(p: Party): Promise<void> {
    if (p.launching || p.run || p.stage === null) return;
    p.launching = true;
    p.startsAt = null;
    const c = this.content;
    const g = this.hub.ctx.game;
    try {
      if (this.hub.runCount() >= c.balance.net.maxRuns) fail('SERVER_BUSY', 'Server ausgelastet, bitte gleich noch einmal.');
      const stage = p.stage;
      const def = c.stages[stage - 1]!;
      const cands: { accountId: number; heroId: number; ready: boolean }[] = [];
      for (const m of p.members) {
        if (m.heroId === null || !this.hub.client(m.accountId)) continue;
        await this.hub.refreshInfo(m.heroId);
        cands.push({ accountId: m.accountId, heroId: m.heroId, ready: m.ready });
      }
      const infos = cands.map((x) => this.hub.info(x.heroId));
      const anyUnlocked = infos.some((i) => i?.unlocked.has(stage));
      const inits: RunPlayerInit[] = [];
      let kampfstufe = 0;
      for (const [k, x] of cands.entries()) {
        const info = infos[k];
        if (!info || !stageAllowed(c, info, def, anyUnlocked)) continue;
        const setup = await heroSetup(g, x.heroId, String(x.accountId));
        const bs = def.boss ? await bossEligibility(g, x.heroId, def.boss) : null;
        // Kampfstufe: höchstes K unter den beute-berechtigten Spielern (10.9)
        if (bs && bs.eligible && !bs.first) kampfstufe = Math.max(kampfstufe, bs.kampfstufe);
        inits.push({
          accountId: x.accountId, setup, helper: bs ? !bs.eligible : false, first: bs?.first ?? false,
          kampfstufe: bs?.kampfstufe ?? 0, repeat: info.cleared.has(stage), autopilot: !x.ready && x.accountId !== p.leader,
        });
      }
      if (inits.length === 0) fail('REQUIREMENT_NOT_MET', 'Niemand in der Party darf diese Stage betreten.');
      const run = new RunInstance(this.hub, p, { id: randomUUID(), stage, seed: this.hub.newSeed(), players: inits, kampfstufe });
      await run.open();
      p.run = run;
      this.hub.addRun(run);
      for (const m of p.members) m.ready = false;
      this.hub.log.info({ runId: run.id, seed: run.seed, stage, players: inits.length }, 'Run gestartet');
    } catch (err) {
      const e = err as { code?: string; message?: string };
      for (const m of p.members) {
        this.hub.client(m.accountId)?.send({ t: 'error', code: e.code ?? 'CONFLICT', message: e.message ?? 'Start fehlgeschlagen.' });
      }
      if (!e.code) this.hub.log.error({ err }, 'Run-Start fehlgeschlagen');
    } finally {
      p.launching = false;
      this.broadcast(p);
    }
  }

  runEnded(run: RunInstance, reason: EndReason, next: number | null): void {
    const p = run.party;
    if (p.run === run) p.run = null;
    if (!this.parties.has(p.id)) return;
    if (reason === 'win' && next !== null) {
      p.stage = next;
      if (p.autoContinue) p.autoContinueAt = this.hub.now() + this.content.engine.idle.autoContinueDelayS * MS_PER_S;
    }
    for (const m of p.members) m.ready = false;
    this.broadcast(p);
  }

  // ---------- Verbindungen ----------

  onHello(cl: Client): void {
    const p = this.byAccount.get(cl.accountId);
    if (p) {
      const m = p.member(cl.accountId)!;
      m.disconnectedAt = null;
      const rp = p.run?.players.get(cl.accountId);
      if (rp && rp.heroId === cl.heroId) p.run!.connect(cl.accountId);
      else if (rp) rp.wantsRejoin = false;
      if (m.heroId !== cl.heroId && !(rp && rp.unitId !== null)) {
        m.heroId = cl.heroId;
        m.ready = false;
      }
      this.broadcast(p);
    }
    const now = this.hub.now();
    for (const inv of this.invites.values()) {
      if (inv.to === cl.accountId && inv.expiresAt > now) {
        cl.send({ t: 'party.invited', inviteId: inv.id, from: inv.fromName, fromAccountId: inv.from, expiresIn: inv.expiresAt - now });
      }
    }
  }

  onDisconnect(accountId: number): void {
    const p = this.byAccount.get(accountId);
    if (!p) return;
    const m = p.member(accountId);
    if (m) {
      m.disconnectedAt = this.hub.now();
      m.ready = false;
    }
    p.run?.disconnect(accountId);
    this.broadcast(p);
  }

  /** Läuft jeden Tick: Countdown, Auto-Weiter, Einladungen, getrennte Mitglieder. */
  update(now: number): void {
    for (const inv of [...this.invites.values()]) if (inv.expiresAt <= now) this.invites.delete(inv.id);
    const grace = this.content.balance.net.disconnectGraceS * MS_PER_S;
    for (const p of [...this.parties.values()]) {
      if (!p.run && !p.launching) {
        if (p.startsAt !== null && now >= p.startsAt) void this.launch(p);
        else if (p.autoContinueAt !== null && now >= p.autoContinueAt) {
          p.autoContinueAt = null;
          void this.launch(p);
        }
      }
      for (const m of [...p.members]) {
        if (m.disconnectedAt === null || now - m.disconnectedAt < grace) continue;
        const rp = p.run?.players.get(m.accountId);
        if (rp && (rp.unitId !== null || rp.wantsRejoin)) continue;
        this.leave(m.accountId, 'timeout');
      }
    }
  }
}
