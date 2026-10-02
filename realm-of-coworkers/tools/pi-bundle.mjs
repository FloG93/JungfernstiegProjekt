// Paket für den Raspberry Pi und andere Rechner ohne Docker (OPEN-048): pnpm pi:bundle → dist/aethra-pi.tar.gz
// Enthält den gebündelten Server, den gebauten Client, die Inhalte, die Laufzeit-Pakete (package.json mit
// package-lock.json für npm ci auf dem Gerät) und deploy/pi (install.sh, Dienst, Verwaltung).
// Mit --no-build wird der vorhandene Build verpackt.
import { execFileSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');
const stage = join(out, 'pi', 'aethra');
const archive = join(out, 'aethra-pi.tar.gz');
const sh = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
const text = (cmd, args) => execFileSync(cmd, args, { cwd: root, encoding: 'utf8' }).trim();

if (!process.argv.includes('--no-build')) sh('pnpm', ['build']);
for (const f of ['apps/server/dist/main.js', 'apps/server/dist/admin.js', 'apps/client/dist/index.html']) {
  if (!existsSync(join(root, f))) throw new Error(`${f} fehlt, bitte zuerst pnpm build`);
}

rmSync(join(out, 'pi'), { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
cpSync(join(root, 'apps/server/dist'), join(stage, 'dist'), { recursive: true });
cpSync(join(root, 'apps/client/dist'), join(stage, 'public'), { recursive: true });
cpSync(join(root, 'packages/content'), join(stage, 'content'), {
  recursive: true,
  filter: (src) => !src.includes('node_modules'),
});
for (const f of ['install.sh', 'aethra.service', 'aethra-admin', 'LIESMICH.md']) cpSync(join(root, 'deploy/pi', f), join(stage, f));
chmodSync(join(stage, 'install.sh'), 0o755);
chmodSync(join(stage, 'aethra-admin'), 0o755);

// Laufzeit-Pakete: alles, was apps/server/build.mjs nicht mitbündelt (die Workspace-Pakete sind gebündelt)
const server = JSON.parse(readFileSync(join(root, 'apps/server/package.json'), 'utf8'));
const dependencies = Object.fromEntries(Object.entries(server.dependencies).filter(([, v]) => !String(v).startsWith('workspace:')));
writeFileSync(join(stage, 'package.json'), `${JSON.stringify({
  name: 'aethra-server',
  version: server.version,
  private: true,
  type: 'module',
  engines: { node: '>=22' },
  dependencies,
}, null, 2)}\n`);
// pnpm reicht eigene npm_config_*-Variablen weiter, die npm nicht kennt (Warnungen); Netz-Einstellungen bleiben
const NPM_KEEP = /^npm_config_(registry|proxy|https_proxy|http_proxy|no_proxy|noproxy|cafile|ca|strict_ssl|userconfig|cache)$/i;
const npmEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^npm_config_/i.test(k) || NPM_KEEP.test(k)));
execFileSync('npm', ['install', '--package-lock-only', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], {
  cwd: stage, stdio: 'inherit', env: npmEnv, shell: process.platform === 'win32',
});

let commit = 'ohne git';
try {
  commit = text('git', ['log', '-1', '--format=%h vom %cs']);
} catch {
  // kein git (z. B. entpacktes Archiv)
}
writeFileSync(join(stage, 'VERSION'), `Aethra ${server.version} (${commit})\n`);

rmSync(archive, { force: true });
sh('tar', ['-czf', archive, '-C', dirname(stage), 'aethra']);
console.log(`\nPaket: ${archive}\nAuf dem Pi: tar xzf aethra-pi.tar.gz && sudo ./aethra/install.sh\n`);
