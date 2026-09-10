import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../modules/auth/auth.service';
import { ErrorCodes } from '@nythera/shared';

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string };
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    reply.status(401).send({ success: false, error: ErrorCodes.AUTH_TOKEN_INVALID });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    reply.status(401).send({ success: false, error: ErrorCodes.AUTH_TOKEN_INVALID });
    return;
  }

  const authService = new AuthService();
  const payload = await authService.validateToken(token);
  if (!payload) {
    reply.status(401).send({ success: false, error: ErrorCodes.AUTH_TOKEN_INVALID });
    return;
  }

  request.user = { id: payload.userId };
}