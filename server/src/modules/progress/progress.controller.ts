import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ProgressService } from './progress.service';
import { SetRouteRequestSchema, SetStrategyRequestSchema } from '@nythera/shared';
import { prisma } from '../../infra/prisma';

export default async function progressController(fastify: FastifyInstance) {
  const service = new ProgressService();

  // Helper to extract characterId from logged in user
  async function getCharacterId(userId: string) {
    const char = await prisma.character.findFirst({
      where: { user_id: userId }
    });
    if (!char) throw new Error('No character found');
    return char.id;
  }

  fastify.get('/idle-status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const charId = await getCharacterId((request as any).user.id);
      const status = await service.getIdleStatus(charId);
      reply.send(status);
    } catch (err: any) {
      reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/claim-offline', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const charId = await getCharacterId((request as any).user.id);
      const result = await service.claimOffline(charId);
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/set-route', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const charId = await getCharacterId((request as any).user.id);
      const data = SetRouteRequestSchema.parse(request.body);
      await service.setRoute(charId, data.routeId);
      reply.send({ success: true });
    } catch (err: any) {
      reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/set-strategy', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const charId = await getCharacterId((request as any).user.id);
      const data = SetStrategyRequestSchema.parse(request.body);
      await service.setStrategy(charId, data.strategy);
      reply.send({ success: true });
    } catch (err: any) {
      reply.status(400).send({ error: err.message });
    }
  });
}
