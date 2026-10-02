// pnpm balance (M10): Referenzmodell aus den Inhaltsdateien nachrechnen, Grenzen aus 13.9 prüfen und K mit der
// echten Simulation messen (13.10). Exit-Code 1, wenn eine Grenze verletzt ist.
import { CLASS_IDS, measureK } from '@aethra/shared';
import { loadContentFromDir } from '@aethra/shared/node';
import { runChecks } from './checks';
import { ASSUMPTIONS, Model } from './model';
import { buildReport, f } from './report';

const K_TOLERANCE = 0.1;
const K_SECONDS = 600;

const args = new Set(process.argv.slice(2));
const dir = process.env['CONTENT_DIR'];
const content = dir ? loadContentFromDir(dir) : loadContentFromDir();
const model = new Model(content);
const report = buildReport(model);
if (!args.has('--quiet')) for (const l of report.lines) console.log(l);

console.log('\nPrüfungen (13.9):');
const checks = runChecks(report);
if (!args.has('--no-sim')) {
  // 13.10: K aus den echten Fähigkeitsdaten, höchstens 10 % Abweichung vom Modell
  for (const cl of CLASS_IDS) {
    const k = measureK(content, cl, K_SECONDS).k;
    const want = ASSUMPTIONS.k[cl];
    const dev = (k - want) / want;
    checks.push({
      name: `K gemessen (${cl})`, value: `${f(k, 3)} (Modell ${want}, ${dev >= 0 ? '+' : ''}${f(dev * 100, 1)} %)`,
      limit: '±10 %', ok: Math.abs(dev) <= K_TOLERANCE,
    });
  }
}
for (const c of checks) console.log(`  ${c.ok ? 'OK  ' : 'FEHL'} ${c.name}: ${c.value} (Grenze ${c.limit})`);
const failed = checks.filter((c) => !c.ok);
if (failed.length > 0) {
  console.log(`\n${failed.length} Prüfung(en) verletzt.`);
  process.exitCode = 1;
} else {
  console.log('\nAlle Prüfungen bestanden.');
}
