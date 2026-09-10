import { FastifyInstance } from 'fastify';
import progressController from './progress.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

export default async function progressPlugin(fastify: FastifyInstance) {
  // All progress routes are prefixed and protected
  fastify.register(async (childServer) => {
    childServer.addHook('preHandler', authMiddleware);
    childServer.register(progressController);
  }, { prefix: '/progress' });
}
