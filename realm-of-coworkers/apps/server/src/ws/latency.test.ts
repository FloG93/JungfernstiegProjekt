// Abnahme M9: 6 kopflose Clients mit 150 und 400 ms Rundlaufzeit spielen eine Stage gemeinsam (2.3, 11.7).
import { deflateRawSync } from 'node:zlib';
import { xpToNext } from '@aethra/shared';
import type { SnapshotMsg } from '@aethra/shared';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { addPlayer, makeEnv } from './testkit';
import type { TestEnv, TestPlayer } from './testkit';

const MIN = 60_000;
const STEP_MS = 50;
const INPUT_EVERY_MS = 2000;
const PULSE_EVERY = 5;
const PULSE_MS = 250;
const CLASSES = ['krieger', 'magier', 'waldlaeufer', 'schurke', 'kleriker', 'runenweber'] as const;

let env: TestEnv;
beforeEach(async () => {
  env = await makeEnv();
});
afterEach(async () => {
  await env.close();
});

/** Positionen und Leben eines vollständigen Snapshots (eigene Abklingzeiten ausgenommen). */
function fingerprint(s: SnapshotMsg): string {
  return JSON.stringify([...s.ents].sort((a, b) => a.id - b.id).map((e) => [e.id, e.x, e.y, e.hp, e.state]));
}

it('6 Clients (3 × 150 ms, 3 × 400 ms): gleicher Start, bestätigte Eingaben, gleiche Welt, Bandbreite, gemeinsames Ende', { timeout: 300_000 }, async () => {
  const ps: TestPlayer[] = [];
  for (const [i, cls] of CLASSES.entries()) {
    ps.push(await addPlayer(env, `spieler${i + 1}`, cls, { latencyMs: i < 3 ? 150 : 400, level: 2, gear: { ilvl: 5 }, cleared: [1] }));
  }
  const [lead, ...rest] = ps as [TestPlayer, ...TestPlayer[]];
  lead.send({ t: 'party.create' });
  await env.clock.until(() => lead.has('party.state'), 2000);
  const code = lead.last('party.state')!.code;
  for (const p of rest) p.send({ t: 'party.join', code });
  await env.clock.until(() => lead.last('party.state')!.members.length === 6, 3000);
  lead.send({ t: 'party.setStage', stage: 2 });
  await env.clock.until(() => lead.last('party.state')!.stage === 2, 2000);
  for (const p of ps) p.send({ t: 'party.ready', ready: true });
  await env.clock.until(() => ps.every((p) => p.has('run.start')), 8000);

  // Gleicher Start für alle
  const starts = ps.map((p) => p.last('run.start')!);
  expect(new Set(starts.map((s) => s.runId)).size).toBe(1);
  expect(new Set(starts.map((s) => s.seed)).size).toBe(1);
  expect(starts[0]!.roster.length).toBe(6);
  expect(starts[0]!.n).toBe(6);
  const t0 = env.clock.now();
  const bytes0 = ps.map((p) => p.sock.bytes);

  // Spielen wie nebenbei: alle 2 s eine Aktion ohne Bewegung (Fokus), alle 10 s ein kurzer Stick-Impuls (6.5)
  const sent = ps.map(() => new Map<number, number>());
  const ackDelay = ps.map(() => [] as number[]);
  let nextInput = env.clock.now();
  let round = 0;
  const done = () => ps.every((p) => p.has('run.end'));
  for (let t = 0; t < 20 * MIN && !done(); t += STEP_MS) {
    if (env.clock.now() >= nextInput) {
      nextInput += INPUT_EVERY_MS;
      round++;
      ps.forEach((p, i) => {
        const pulse = (round + i) % PULSE_EVERY === 0;
        sent[i]!.set(p.input(0, pulse ? (i % 2 === 0 ? 1 : -1) : 0, [{ k: 'focus', targetId: null }]), env.clock.now());
        if (pulse) env.clock.after(PULSE_MS, () => p.input(0, 0));
      });
    }
    await env.clock.advance(STEP_MS);
    ps.forEach((p, i) => {
      const ack = p.last('run.ack');
      if (!ack) return;
      for (const [seq, at] of sent[i]!) {
        if (seq <= ack.seq) {
          ackDelay[i]!.push(env.clock.now() - at);
          sent[i]!.delete(seq);
        }
      }
    });
  }
  expect(done()).toBe(true);
  const seconds = (env.clock.now() - t0) / 1000;

  // Eingaben: bestätigt nach Rundlaufzeit plus höchstens zwei Ticks (plus Messraster)
  ps.forEach((p, i) => {
    expect(ackDelay[i]!.length).toBeGreaterThan(10);
    expect(Math.max(...ackDelay[i]!)).toBeLessThanOrEqual(p.latencyMs + 2 * 50 + STEP_MS);
  });

  // Snapshots: höchstens 8 KB, Delta im Mittel klein, alle 5 s vollständig (11.7)
  const max = env.ctx.content.balance.net.maxSnapshotBytes;
  for (const p of ps) {
    const snaps = p.of('run.snapshot');
    const sizes = snaps.map((s) => JSON.stringify(s).length);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(max);
    expect(snaps.filter((s) => s.full).length).toBeGreaterThanOrEqual(Math.floor(seconds / 5) - 1);
  }

  // Bandbreite: unter 30 KB/s je Client mit permessage-deflate (jede Nachricht einzeln komprimiert = obere Schranke)
  ps.forEach((p, i) => {
    const raw = p.sock.inbox.filter((m) => m.at >= t0);
    const deflated = raw.reduce((sum, m) => sum + deflateRawSync(m.data).length, 0);
    const rawKbS = (p.sock.bytes - bytes0[i]!) / 1024 / seconds;
    const zipKbS = deflated / 1024 / seconds;
    expect(zipKbS).toBeLessThan(30);
    expect(rawKbS).toBeLessThan(120);
  });

  // Alle sehen dieselbe Welt: vollständige Snapshots desselben Ticks stimmen überein
  const fulls = ps.map((p) => new Map(p.of('run.snapshot').filter((s) => s.full).map((s) => [s.tick, fingerprint(s)])));
  const common = [...fulls[0]!.keys()].filter((tick) => fulls.every((f) => f.has(tick)));
  expect(common.length).toBeGreaterThan(10);
  for (const tick of common) for (const f of fulls) expect(f.get(tick)).toBe(fulls[0]!.get(tick));

  // Gemeinsames Ende: jeder erhält den vollen Topf und seine eigene Truhe (12.3, 12.8)
  const ends = ps.map((p) => p.last('run.end')!);
  for (const e of ends) {
    expect(e.result).toBe('win');
    expect(e.xp).toBe(xpToNext(env.ctx.content.balance, 2));
    expect(e.loot.length).toBeGreaterThanOrEqual(2);
  }
  const lootIds = ends.flatMap((e) => e.loot.map((x) => x.id));
  expect(new Set(lootIds).size).toBe(lootIds.length);
  // Beute ist persönlich: jeder sieht nur seine eigenen Beute-Ereignisse (11.4)
  ps.forEach((p) => {
    const loot = p.of('run.events').flatMap((m) => m.list).filter((e) => e.e === 'loot');
    expect(loot.every((e) => e.e === 'loot' && e.heroId === p.heroId)).toBe(true);
  });
});
