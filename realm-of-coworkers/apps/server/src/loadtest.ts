// Lasttest (16.4, 11.10): 10 Runs mit je 6 Helden über 10 Minuten Spielzeit. Gemessen wird die Rechenzeit // OPEN-046
// des Servers je Sekunde Spielzeit (Anteil eines CPU-Kerns) samt JSON und Kompression der Nachrichten.
// Aufruf: pnpm --filter @aethra/server loadtest   (RUNS, SECONDS als Umgebungsvariablen)
import { deflateRawSync } from 'node:zlib';
import { PROTOCOL_VERSION } from '@aethra/shared';
import type { ClassId } from '@aethra/shared';
import { createHero } from './game/heroes';
import type { Sock } from './ws/client';
import { gearUp, makeEnv } from './ws/testkit';

const RUNS = Number(process.env['RUNS'] ?? 10);
const SECONDS = Number(process.env['SECONDS'] ?? 600);
const PLAYERS = 6;
const STAGE = 13;
const CLASSES: ClassId[] = ['krieger', 'magier', 'waldlaeufer', 'schurke', 'kleriker', 'runenweber'];
/** Jede n-te Nachricht wird zusätzlich komprimiert, um die Kosten von permessage-deflate zu schätzen. */
const DEFLATE_SAMPLE = 10;

class CountingSock implements Sock {
  bytes = 0;
  msgs = 0;
  deflated = 0;
  sampled = 0;
  readonly seen: Record<string, number> = {};
  send(data: string): void {
    this.bytes += data.length;
    this.msgs++;
    const t = /"t":"([a-z.]+)"/.exec(data)?.[1] ?? '?';
    this.seen[t] = (this.seen[t] ?? 0) + 1;
    if (this.msgs % DEFLATE_SAMPLE === 0) {
      this.deflated += deflateRawSync(data).length;
      this.sampled += data.length;
    }
  }
  close(): void {}
}

const env = await makeEnv({ LOG_LEVEL: 'silent' });
const players: { acc: number; hero: number; sock: CountingSock; cl: ReturnType<typeof env.hub.connect> }[] = [];
const now = env.clock.now();
for (let i = 0; i < RUNS * PLAYERS; i++) {
  const acc = await env.ctx.db.insertInto('accounts').values({ username: `last${i}`, pw_hash: 'x', created_at: now, last_login: now })
    .returning('id').executeTakeFirstOrThrow();
  const cls = CLASSES[i % PLAYERS]!;
  const h = await createHero(env.ctx.game, acc.id, `Last ${i}`, cls, { body: 0, portrait: 0, palette: 0 });
  await env.ctx.db.updateTable('heroes').set({ level: STAGE }).where('id', '=', h.id).execute();
  await gearUp(env, h.id, cls, STAGE);
  for (let s = 1; s < STAGE + 6; s++) {
    await env.ctx.db.insertInto('stage_progress').values({ hero_id: h.id, stage: s, clears: 1, best_time_ms: null }).execute();
  }
  const sock = new CountingSock();
  const cl = env.hub.connect(sock, { accountId: acc.id, username: `last${i}` });
  env.hub.message(cl, JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, heroId: h.id }));
  players.push({ acc: acc.id, hero: h.id, sock, cl });
}
await env.clock.advance(200);
const send = (i: number, m: object) => env.hub.message(players[i]!.cl, JSON.stringify(m));
for (let r = 0; r < RUNS; r++) {
  const lead = r * PLAYERS;
  send(lead, { t: 'party.create' });
  await env.clock.advance(50);
  const code = env.hub.lobby.partyOf(players[lead]!.acc)!.code;
  for (let k = 1; k < PLAYERS; k++) send(lead + k, { t: 'party.join', code });
  await env.clock.advance(1100);
  send(lead, { t: 'party.autoContinue', on: true });
  send(lead, { t: 'party.setStage', stage: STAGE });
  await env.clock.advance(50);
  for (let k = 0; k < PLAYERS; k++) send(lead + k, { t: 'party.ready', ready: true });
}
await env.clock.advance(5200);
console.log(`Laufende Runs: ${env.ctx.runCount()} mit je ${PLAYERS} Helden`);
const bytes0 = players.reduce((a, p) => a + p.sock.bytes, 0);
const cpu0 = process.cpuUsage();
const wall0 = performance.now();
let seq = 0;
for (let s = 0; s < SECONDS; s++) {
  if (s % 2 === 0) {
    for (let i = 0; i < players.length; i++) send(i, { t: 'run.input', seq: ++seq, mx: 0, my: 0, act: [{ k: 'focus', targetId: null }] });
  }
  await env.clock.advance(1000);
}
const cpu = process.cpuUsage(cpu0);
const cpuS = (cpu.user + cpu.system) / 1e6;
const wall = (performance.now() - wall0) / 1000;
const bytes = players.reduce((a, p) => a + p.sock.bytes, 0) - bytes0;
const sampled = players.reduce((a, p) => a + p.sock.sampled, 0);
const deflated = players.reduce((a, p) => a + p.sock.deflated, 0);
const ratio = sampled > 0 ? deflated / sampled : 1;
const ends = players.reduce((a, p) => a + (p.sock.seen['run.end'] ?? 0), 0);
console.log(`Spielzeit ${SECONDS} s, Rechenzeit ${cpuS.toFixed(1)} s (Wanduhr ${wall.toFixed(1)} s)`);
console.log(`CPU-Anteil eines Kerns bei Echtzeit: ${((cpuS / SECONDS) * 100).toFixed(1)} % für ${RUNS} Runs, ${((cpuS / SECONDS / RUNS) * 100).toFixed(2)} % je Run`);
console.log(`Daten je Client: ${(bytes / players.length / SECONDS / 1024).toFixed(1)} KB/s roh, etwa ${((bytes * ratio) / players.length / SECONDS / 1024).toFixed(1)} KB/s komprimiert`);
console.log(`Abgeschlossene Stages (Ergebnisse an Spieler): ${ends}, Speicher ${Math.round(process.memoryUsage().rss / 1048576)} MB`);
await env.close();
