import Fastify, { FastifyInstance } from 'fastify';
import contentPlugin from './modules/content/content.plugin';
import authPlugin from './modules/auth/auth.plugin';
import characterPlugin from './modules/character/character.plugin';
import progressPlugin from './modules/progress/progress.plugin';
import { connectRedis } from './infra/redis';

import fastifyWebsocket from '@fastify/websocket';
import battleGateway from './modules/battle/battle.gateway';

const server: FastifyInstance = Fastify({ logger: true });

// Register WebSocket support
server.register(fastifyWebsocket);

// Register plugins
server.register(contentPlugin);
server.register(authPlugin);
server.register(characterPlugin);
server.register(progressPlugin);
server.register(battleGateway);

server.get('/health', async () => {
  return { status: 'ok' };
});

const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
    server.log.info(`Server listening on ${server.server.address()}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
