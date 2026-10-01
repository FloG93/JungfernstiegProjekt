// Start des Servers (16.6): docker compose up oder pnpm dev.
import { buildApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const { app, ctx } = await buildApp(config);
const { attachRealtime } = await import('./ws/realtime');
attachRealtime(app, ctx);
await app.listen({ port: config.port, host: '0.0.0.0' });
app.log.info(`Aethra läuft auf Port ${config.port}, Inhalte ${ctx.contentFiles.hash}`);
