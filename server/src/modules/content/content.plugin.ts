import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { ContentController } from './content.controller';
import fp from 'fastify-plugin';

const adminKeyAuth = (request: FastifyRequest, reply: FastifyReply): void => {
  const providedKey = request.headers['x-admin-key'];
  const expectedKey = process.env.ADMIN_API_KEY;
  if (!providedKey || providedKey !== expectedKey) {
    reply.status(401).send({ success: false, error: 'Unauthorized' });
  }
};

const contentPlugin: FastifyPluginAsync = async (fastify) => {
  const contentController = new ContentController();

  fastify.post(
    '/admin/content/import',
    { preHandler: [adminKeyAuth] },
    contentController.importContent.bind(contentController)
  );
  fastify.post(
    '/admin/content/publish',
    { preHandler: [adminKeyAuth] },
    contentController.publishContent.bind(contentController)
  );
  fastify.get(
    '/admin/content/active',
    { preHandler: [adminKeyAuth] },
    contentController.getActiveContent.bind(contentController)
  );
  fastify.get(
    '/content/version',
    contentController.getActiveVersion.bind(contentController)
  );
};

export default fp(contentPlugin, { name: 'content' });