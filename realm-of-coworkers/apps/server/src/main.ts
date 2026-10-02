// Start des Servers (16.6): docker compose up oder pnpm dev.
import { buildApp } from './app';
import { Backups } from './backup';
import { loadConfig } from './config';

const config = loadConfig();
const { app, ctx, dbh } = await buildApp(config);
const { attachRealtime } = await import('./ws/realtime');
attachRealtime(app, ctx);
if (config.dbPath !== ':memory:') {
  // Sicherung beim Start (= vor jedem Deployment) und nächtlich (16.6)
  const backups = new Backups(dbh.raw, config.backupDir, config.backupKeepDays, config.backupHour, app.log);
  await backups.run('start').catch((err: unknown) => app.log.error({ err }, 'Sicherung beim Start fehlgeschlagen'));
  backups.schedule();
  app.addHook('onClose', async () => backups.stop());
}
const shutdown = (signal: string) => {
  app.log.info(`${signal}: Server fährt herunter, laufende Runs werden beendet (2.5)`);
  void app.close().then(() => process.exit(0));
};
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
await app.listen({ port: config.port, host: '0.0.0.0' });
app.log.info(`Aethra läuft auf Port ${config.port}, Inhalte ${ctx.contentFiles.hash}`);
