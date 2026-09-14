import { AuthService } from './auth.service';
import { FastifyRequest, FastifyReply } from 'fastify';
import { RegisterRequestSchema, LoginRequestSchema, ErrorCodes } from '@nythera/shared';
import { logger } from '../../infra/logger';
import { rateLimiter } from '../../infra/ratelimit';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  async register(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = RegisterRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400).send({
        success: false,
        error: 'Invalid request',
        details: parseResult.error.format(),
      });
      return;
    }
    const { email, password } = parseResult.data;

    try {
      const ipAttempts = await rateLimiter.increment(`register_ip:${request.ip}`, 900);
      if (ipAttempts > 20) {
        reply.status(429).send({ success: false, error: 'Too many registration attempts, try again later' });
        return;
      }
      const attemptsKey = `register_attempts:${email}`;
      const attemptCount = await rateLimiter.increment(attemptsKey, 900);
      if (attemptCount > 5) {
        reply.status(429).send({
          success: false,
          error: 'Too many registration attempts, try again later',
        });
        return;
      }

      const user = await this.authService.register(email, password);
      await rateLimiter.reset(attemptsKey);

      reply.status(201).send({ success: true, data: user });
    } catch (error) {
      if ((error as { code?: string }).code === ErrorCodes.AUTH_USER_EXISTS) {
        reply.status(409).send({
          success: false,
          error: (error as Error).message,
        });
      } else {
        logger.error({ err: error }, 'Error in register');
        reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = LoginRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.status(400).send({
        success: false,
        error: 'Invalid request',
        details: parseResult.error.format(),
      });
      return;
    }
    const { email, password } = parseResult.data;
    request.log.info({ email }, 'Tentativa de login recebida');

    try {
      const ipAttempts = await rateLimiter.increment(`login_ip:${request.ip}`, 900);
      if (ipAttempts > 30) {
        reply.status(429).send({ success: false, error: 'Too many login attempts, try again later' });
        return;
      }
      const result = await this.authService.login(email, password);
      request.log.info({ email, userId: result.user.id }, 'Login realizado com sucesso');
      reply.send({ success: true, data: result });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === ErrorCodes.AUTH_INVALID_CREDENTIALS || code === ErrorCodes.AUTH_RATE_LIMIT_EXCEEDED) {
        request.log.warn({ email, errMessage: (error as Error).message }, 'Falha na autenticação do login');
        reply.status(code === ErrorCodes.AUTH_RATE_LIMIT_EXCEEDED ? 429 : 401).send({
          success: false,
          error: (error as Error).message,
        });
      } else {
        logger.error({ err: error }, 'Error in login');
        reply.status(500).send({ success: false, error: 'Internal server error' });
      }
    }
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      reply.status(401).send({ success: false, error: 'Missing token' });
      return;
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
      reply.status(401).send({ success: false, error: 'Missing token' });
      return;
    }

    try {
      await this.authService.logout(token);
      reply.send({ success: true, data: { success: true } });
    } catch (error) {
      logger.error({ err: error }, 'Error in logout');
      reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user?.id;
    if (!userId) {
      reply.status(401).send({ success: false, error: 'Invalid token' });
      return;
    }

    try {
      const user = await this.authService.getUserById(userId);
      reply.send({ success: true, data: user });
    } catch (error) {
      logger.error({ err: error }, 'Error in me');
      reply.status(404).send({ success: false, error: 'User not found' });
    }
  }

  async updateVip(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user?.id;
    if (!userId) {
      reply.status(401).send({ success: false, error: 'Unauthorized' });
      return;
    }

    const body = (request.body || {}) as { action?: number; days?: number };
    const action = typeof body.action === 'number' ? body.action : 1;
    const days = typeof body.days === 'number' ? body.days : 7;

    try {
      const requester = await this.authService.getUserById(userId);
      if (requester.role !== 'admin') {
        reply.status(403).send({ success: false, error: 'Admin authorization required' });
        return;
      }
      const result = await this.authService.updateVipStatus(userId, action, days);
      reply.send(result);
    } catch (error: any) {
      logger.error({ err: error }, 'Error in updateVip');
      reply.status(500).send({ success: false, error: error.message || 'Internal server error' });
    }
  }
}
