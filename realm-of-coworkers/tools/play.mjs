// Spielen ohne Docker (OPEN-047): `pnpm play` (auch im GitHub Codespace). Baut bei Bedarf, legt beim ersten Start eine .env mit
// zufälligem Einladungscode an, startet den Server und zeigt Adresse und Code für die Kollegen.
// Im Codespace wird die weitergeleitete Adresse freigegeben (ALLOWED_ORIGINS, OPEN-047) und Port 3000 öffentlich gestellt.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomInt } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, '.env');
const NODE_MAJOR = 24;
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const SECRET_BYTES = 32;
const START_TIMEOUT_MS = 60_000;
const POLL_MS = 500;
const HEALTH_TIMEOUT_MS = 1500;

function fail(text) {
  console.error(`\n${text}\n`);
  process.exit(1);
}

function run(args) {
  console.log(`> pnpm ${args.join(' ')}`);
  const r = spawnSync('pnpm', args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.error) fail('pnpm fehlt. Einmal "corepack enable" ausführen (oder "npm install -g pnpm") und erneut starten.');
  if (r.status !== 0) fail(`"pnpm ${args.join(' ')}" ist fehlgeschlagen.`);
}

if (Number(process.versions.node.split('.')[0]) < NODE_MAJOR) fail(`Aethra braucht Node ${NODE_MAJOR} oder neuer (gefunden: ${process.version}).`);
if (!existsSync(join(root, 'node_modules'))) run(['install', '--frozen-lockfile']);
if (!existsSync(join(root, 'apps/server/dist/main.js')) || !existsSync(join(root, 'apps/client/dist/index.html'))) run(['build']);

if (!existsSync(envFile)) {
  const code = process.env.INVITE_CODE || Array.from({ length: CODE_LENGTH }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');
  writeFileSync(envFile, [
    '# Angelegt von pnpm play. Einladungscode für neue Konten, Geheimnis für die Sitzungs-Cookies (2.8).',
    `INVITE_CODE=${code}`,
    `SESSION_SECRET=${randomBytes(SECRET_BYTES).toString('hex')}`,
    'PORT=3000',
    'DB_PATH=./data/aethra.db',
    '',
  ].join('\n'));
  console.log('.env mit neuem Einladungscode angelegt.');
}

// Wie node --env-file: gesetzte Umgebungsvariablen (z. B. Codespaces-Secrets) haben Vorrang vor der Datei.
const env = { ...parseEnv(readFileSync(envFile, 'utf8')), ...process.env };
const port = Number(env.PORT || 3000);
const codespace = process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
  ? `https://${process.env.CODESPACE_NAME}-${port}.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
  : null;
if (codespace) {
  env.ALLOWED_ORIGINS = [env.ALLOWED_ORIGINS, codespace].filter(Boolean).join(',');
  env.COOKIE_SECURE ??= '1';
}

async function healthy() {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    return r.ok;
  } catch {
    return false;
  }
}

function addresses() {
  if (codespace) return [codespace];
  const lan = Object.values(networkInterfaces()).flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => `http://${n.address}:${port}   (Handys im selben WLAN)`);
  return [`http://localhost:${port}   (dieser Rechner)`, ...lan];
}

function banner(note) {
  const line = '─'.repeat(64);
  console.log(`\n${line}\n  Aethra läuft.`);
  for (const a of addresses()) console.log(`  Adresse:        ${a}`);
  console.log(`  Einladungscode: ${env.INVITE_CODE}`);
  console.log('  Adresse und Code an die Kollegen schicken, dort Konto anlegen.');
  if (note) console.log(`  ${note}`);
  console.log(`${line}\n`);
}

function publishPort() {
  const r = spawnSync('gh', ['codespace', 'ports', 'visibility', `${port}:public`, '-c', process.env.CODESPACE_NAME], { encoding: 'utf8' });
  return !r.error && r.status === 0
    ? `Port ${port} ist öffentlich: Mitspieler brauchen kein GitHub-Konto.`
    : `Bitte im Reiter PORTS: Rechtsklick auf Port ${port} > Port Visibility > Public.`;
}

if (await healthy()) {
  banner('Der Server lief bereits.');
  process.exit(0);
}

const server = spawn(process.execPath, ['--enable-source-maps', 'apps/server/dist/main.js'], { cwd: root, env, stdio: 'inherit' });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.kill(sig));
server.on('exit', (code) => process.exit(code ?? 0));

const until = Date.now() + START_TIMEOUT_MS;
while (Date.now() < until && server.exitCode === null) {
  if (await healthy()) {
    banner(codespace ? publishPort() : 'Beenden mit Strg+C.');
    break;
  }
  await new Promise((r) => setTimeout(r, POLL_MS));
}
