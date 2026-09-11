import Fastify, { type FastifyInstance } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import authPlugin from './modules/auth/auth.plugin';
import characterPlugin from './modules/character/character.plugin';
import contentPlugin from './modules/content/content.plugin';
import progressPlugin from './modules/progress/progress.plugin';
import battleGateway from './modules/battle/battle.gateway';
import { prisma } from './infra/prisma';
import { RedisService } from './infra/redis';
import { loadConfig, type AppConfig } from './core/config';

export async function buildServer(config: AppConfig = loadConfig()): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' }, requestIdHeader: 'x-request-id' });
  const redis = new RedisService({ enabled: config.redisEnabled, connected: false, required: config.redisRequired });
  await redis.connect();
  app.decorate('runtimeConfig', config);
  app.decorate('redisService', redis);

  // CORS support for RPG Maker client (web/NW.js)
  app.addHook('onRequest', async (req, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-key');
    if (req.method === 'OPTIONS') {
      return reply.status(204).send();
    }
  });

  await app.register(fastifyWebsocket, { options: { maxPayload: 16 * 1024 } });
  await app.register(contentPlugin);
  await app.register(authPlugin);
  await app.register(characterPlugin);
  await app.register(progressPlugin);
  await app.register(battleGateway);
  app.get('/health', async () => ({ status: 'ok', environment: config.nodeEnv, databaseProvider: config.databaseProvider, redis: redis.describe().connected ? 'connected' : 'local' }));
  app.get('/ready', async (request, reply) => {
    try { await prisma.$queryRaw`SELECT 1`; }
    catch (error) { request.log.error({ err: error }, 'database readiness check failed'); return reply.code(503).send({ status: 'not_ready', dependency: 'database' }); }
    if (!redis.isReady()) return reply.code(503).send({ status: 'not_ready', dependency: 'redis' });
    return { status: 'ready', databaseProvider: config.databaseProvider };
  });
  app.addHook('onClose', async () => { await redis.disconnect(); await prisma.$disconnect(); });
  return app;
}

declare module 'fastify' { interface FastifyInstance { runtimeConfig: AppConfig; redisService: RedisService; } }

async function start() {
  const config = loadConfig();
  const app = await buildServer(config);
  const close = async (signal: string) => { app.log.info({ signal }, 'shutting down'); await app.close(); process.exit(0); };
  process.once('SIGINT', () => void close('SIGINT')); process.once('SIGTERM', () => void close('SIGTERM'));
  await app.listen({ port: config.port, host: config.host });
}
if (require.main === module) start().catch((error) => { console.error(error); process.exit(1); });
