import { FastifyPluginAsync } from 'fastify';
import { AuthController } from './auth.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import fp from 'fastify-plugin';

const authPlugin: FastifyPluginAsync = async (fastify) => {
  const authController = new AuthController();

  fastify.post('/auth/register', authController.register.bind(authController));
  fastify.post('/auth/login', authController.login.bind(authController));
  fastify.post(
    '/auth/logout',
    { preHandler: [authMiddleware] },
    authController.logout.bind(authController)
  );
  fastify.get('/me', { preHandler: [authMiddleware] }, authController.me.bind(authController));
  fastify.post('/user/vip', { preHandler: [authMiddleware] }, authController.updateVip.bind(authController));
};

export default fp(authPlugin, { name: 'auth' });