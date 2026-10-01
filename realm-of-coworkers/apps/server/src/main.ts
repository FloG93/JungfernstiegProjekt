import Fastify from 'fastify';

const app = Fastify({ logger: { level: process.env['LOG_LEVEL'] ?? 'info' } });
app.get('/api/health', () => ({ ok: true, data: { status: 'up' } }));

const port = Number(process.env['PORT'] ?? 3000);
await app.listen({ port, host: '0.0.0.0' });
